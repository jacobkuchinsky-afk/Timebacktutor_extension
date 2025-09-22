// AlphaTutor Popup Script
// Handles popup interface and communication with background script

(function() {
    'use strict';
    
    // DOM elements
    let statusText, statusLoader, chatMessages, questionInput, submitBtn, clearBtn, refreshBtn;
    let inputHelpText, buttonText, buttonLoader;
    
    // State
    let hasExtractedText = false;
    let isProcessing = false;
    
    // Initialize popup when DOM is loaded
    document.addEventListener('DOMContentLoaded', initialize);
    
    function initialize() {
        // Get DOM elements
        statusText = document.getElementById('status-text');
        statusLoader = document.getElementById('status-loader');
        chatMessages = document.getElementById('chat-messages');
        questionInput = document.getElementById('question-input');
        submitBtn = document.getElementById('submit-btn');
        clearBtn = document.getElementById('clear-btn');
        refreshBtn = document.getElementById('refresh-btn');
        inputHelpText = document.getElementById('input-help-text');
        buttonText = submitBtn.querySelector('.button-text');
        buttonLoader = submitBtn.querySelector('.button-loader');
        
        // Add event listeners
        submitBtn.addEventListener('click', handleSubmitQuestion);
        clearBtn.addEventListener('click', handleClearChat);
        refreshBtn.addEventListener('click', handleRefreshContent);
        questionInput.addEventListener('keypress', handleKeyPress);
        
        // Initialize popup state
        checkExtractedText();
        loadConversationHistory();
        
        console.log('AlphaTutor popup initialized');
    }
    
    // Handle Enter key press in input field
    function handleKeyPress(event) {
        if (event.key === 'Enter' && !submitBtn.disabled && !isProcessing) {
            handleSubmitQuestion();
        }
    }
    
    // Check if we have extracted text and update UI accordingly
    async function checkExtractedText() {
        try {
            showStatus('Checking for extracted content...', 'loading');
            
            const response = await chrome.runtime.sendMessage({
                action: 'getExtractedText'
            });
            
            if (response.success && response.hasText) {
                hasExtractedText = true;
                enableInput();
                showStatus(`Content loaded from ${new URL(response.url).hostname}`, 'success');
            } else {
                hasExtractedText = false;
                disableInput();
                showStatus('Click the floating button on Math Academy to get started', 'info');
            }
            
        } catch (error) {
            console.error('Error checking extracted text:', error);
            showStatus('Error checking content. Please try refreshing.', 'error');
            disableInput();
        }
    }
    
    // Load and display conversation history
    async function loadConversationHistory() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getConversationHistory'
            });
            
            if (response.success && response.conversations.length > 0) {
                // Clear existing messages
                chatMessages.innerHTML = '';
                
                // Display conversation history
                response.conversations.forEach(conversation => {
                    addUserMessage(conversation.userQuestion);
                    addAIMessage(conversation.aiResponse);
                });
                
                // Enable clear button if we have conversations
                clearBtn.disabled = false;
                
                // Scroll to bottom
                scrollToBottom();
            }
            
        } catch (error) {
            console.error('Error loading conversation history:', error);
        }
    }
    
    // Handle question submission
    async function handleSubmitQuestion() {
        const question = questionInput.value.trim();
        
        if (!question) {
            showStatus('Please enter a question', 'error');
            return;
        }
        
        if (!hasExtractedText) {
            showStatus('Please extract page content first', 'error');
            return;
        }
        
        if (isProcessing) {
            return;
        }
        
        try {
            isProcessing = true;
            setSubmitButtonLoading(true);
            showStatus('Processing your question...', 'loading');
            
            // Add user message to chat
            addUserMessage(question);
            
            // Clear input
            questionInput.value = '';
            
            // Send question to background script
            const response = await chrome.runtime.sendMessage({
                action: 'submitQuestion',
                question: question
            });
            
            if (response.success) {
                // Add AI response to chat
                addAIMessage(response.response);
                
                // Enable clear button
                clearBtn.disabled = false;
                
                showStatus('Response complete!', 'success');
                
                // Auto-hide success status after 3 seconds
                setTimeout(() => {
                    if (statusText.textContent === 'Response complete!') {
                        showStatus(`Content loaded from Math Academy`, 'info');
                    }
                }, 3000);
                
            } else {
                showStatus(response.error || 'Failed to get AI response', 'error');
            }
            
        } catch (error) {
            console.error('Error submitting question:', error);
            showStatus('Error processing question. Please try again.', 'error');
        } finally {
            isProcessing = false;
            setSubmitButtonLoading(false);
            questionInput.focus();
        }
    }
    
    // Handle clear chat
    async function handleClearChat() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'clearConversation'
            });
            
            if (response.success) {
                // Clear chat messages
                chatMessages.innerHTML = '';
                
                // Disable clear button
                clearBtn.disabled = true;
                
                showStatus('Chat cleared', 'success');
                
                // Auto-hide success status
                setTimeout(() => {
                    if (hasExtractedText) {
                        showStatus('Content loaded from Math Academy', 'info');
                    } else {
                        showStatus('Click the floating button on Math Academy to get started', 'info');
                    }
                }, 2000);
                
            } else {
                showStatus('Failed to clear chat', 'error');
            }
            
        } catch (error) {
            console.error('Error clearing chat:', error);
            showStatus('Error clearing chat', 'error');
        }
    }
    
    // Handle refresh content
    async function handleRefreshContent() {
        try {
            showStatus('Refreshing content...', 'loading');
            
            // Get current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url.includes('mathacademy.com')) {
                showStatus('Please navigate to Math Academy first', 'error');
                return;
            }
            
            // Send message to content script to re-extract text
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'getPageText'
            });
            
            if (response && response.success) {
                // Send extracted text to background
                await chrome.runtime.sendMessage({
                    action: 'extractText',
                    text: response.text,
                    url: tab.url
                });
                
                hasExtractedText = true;
                enableInput();
                showStatus('Content refreshed successfully', 'success');
                
                // Auto-hide success status
                setTimeout(() => {
                    showStatus('Content loaded from Math Academy', 'info');
                }, 2000);
                
            } else {
                showStatus('Failed to refresh content', 'error');
            }
            
        } catch (error) {
            console.error('Error refreshing content:', error);
            showStatus('Error refreshing content. Make sure you\'re on Math Academy.', 'error');
        }
    }
    
    // Add user message to chat
    function addUserMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = message;
        
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        
        scrollToBottom();
    }
    
    // Add AI message to chat
    function addAIMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = renderMarkdown(message);
        
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        
        // Re-render MathJax for new mathematical expressions
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([contentDiv]).catch((err) => {
                console.error('MathJax rendering error:', err);
            });
        }
        
        scrollToBottom();
    }
    
    // Render markdown to HTML (simplified version from original app)
    function renderMarkdown(text) {
        // Normalize the text first
        text = text.trim();
        
        // First, protect LaTeX expressions from processing
        const mathExpressions = [];
        let mathIndex = 0;
        
        // Store inline math expressions
        text = text.replace(/\$([^$]+)\$/g, (match, content) => {
            const placeholder = `__MATH_INLINE_${mathIndex}__`;
            mathExpressions[mathIndex] = match;
            mathIndex++;
            return placeholder;
        });
        
        // Store display math expressions
        text = text.replace(/\$\$([^$]+)\$\$/g, (match, content) => {
            const placeholder = `__MATH_DISPLAY_${mathIndex}__`;
            mathExpressions[mathIndex] = match;
            mathIndex++;
            return placeholder;
        });
        
        // Store code blocks to protect them from processing
        const codeBlocks = [];
        let codeIndex = 0;
        text = text.replace(/```([\s\S]*?)```/g, (match, content) => {
            const placeholder = `__CODE_BLOCK_${codeIndex}__`;
            codeBlocks[codeIndex] = `<pre><code>${content}</code></pre>`;
            codeIndex++;
            return placeholder;
        });
        
        // Store inline code
        const inlineCodes = [];
        let inlineIndex = 0;
        text = text.replace(/`([^`]+)`/g, (match, content) => {
            const placeholder = `__INLINE_CODE_${inlineIndex}__`;
            inlineCodes[inlineIndex] = `<code>${content}</code>`;
            inlineIndex++;
            return placeholder;
        });
        
        // Now do basic markdown rendering
        let html = text
            // Headers
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Handle lists properly
        html = html.replace(/^[\s]*[-*+]\s+(.*$)/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
        
        // Handle paragraphs and line breaks more intelligently
        const paragraphs = html.split(/\n\s*\n/);
        html = paragraphs.map(paragraph => {
            paragraph = paragraph.trim();
            if (!paragraph) return '';
            
            // Don't wrap headers, lists, or already wrapped content in paragraphs
            if (paragraph.match(/^<(h[1-6]|ul|ol|li|pre|code)/)) {
                return paragraph.replace(/\n/g, '<br>');
            }
            
            // For regular text, convert single newlines to line breaks and wrap in paragraph
            const processedParagraph = paragraph.replace(/\n/g, '<br>');
            return `<p>${processedParagraph}</p>`;
        }).filter(p => p).join('\n\n');
        
        // Restore protected content
        // Restore code blocks
        codeBlocks.forEach((codeBlock, index) => {
            html = html.replace(`__CODE_BLOCK_${index}__`, codeBlock);
        });
        
        // Restore inline code
        inlineCodes.forEach((inlineCode, index) => {
            html = html.replace(`__INLINE_CODE_${index}__`, inlineCode);
        });
        
        // Restore math expressions
        mathExpressions.forEach((mathExpr, index) => {
            html = html.replace(`__MATH_INLINE_${index}__`, mathExpr);
            html = html.replace(`__MATH_DISPLAY_${index}__`, mathExpr);
        });

        return html;
    }
    
    // Show status message
    function showStatus(message, type = 'info') {
        statusText.textContent = message;
        
        // Handle loading state
        if (type === 'loading') {
            statusLoader.style.display = 'inline-block';
        } else {
            statusLoader.style.display = 'none';
        }
        
        // Update status styling
        const statusMessage = document.getElementById('status-message');
        statusMessage.className = `status-message ${type}`;
    }
    
    // Enable input controls
    function enableInput() {
        questionInput.disabled = false;
        submitBtn.disabled = false;
        inputHelpText.textContent = 'Ask a question about the math content';
        questionInput.placeholder = "What's your question?";
        questionInput.focus();
    }
    
    // Disable input controls
    function disableInput() {
        questionInput.disabled = true;
        submitBtn.disabled = true;
        inputHelpText.textContent = 'Extract page content first by clicking the floating button';
        questionInput.placeholder = 'Extract content first...';
    }
    
    // Set submit button loading state
    function setSubmitButtonLoading(loading) {
        if (loading) {
            buttonText.style.display = 'none';
            buttonLoader.style.display = 'inline-block';
            submitBtn.disabled = true;
            questionInput.disabled = true;
        } else {
            buttonText.style.display = 'inline';
            buttonLoader.style.display = 'none';
            submitBtn.disabled = !hasExtractedText;
            questionInput.disabled = !hasExtractedText;
        }
    }
    
    // Scroll chat to bottom
    function scrollToBottom() {
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);
    }
    
})();
