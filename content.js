// AlphaTutor Content Script
// Injects floating button and handles on-page chat interface on mathacademy.com

(function() {
    'use strict';
    
    // Prevent multiple injections
    if (window.alphaTutorInjected) {
        return;
    }
    window.alphaTutorInjected = true;
    
    // State variables
    let hasExtractedText = false;
    let isProcessing = false;
    let chatOpen = false;
    
    // Create floating button
    function createFloatingButton() {
        const button = document.createElement('button');
        button.id = 'alphatutor-floating-btn';
        button.innerHTML = `
            <span class="button-text">I NEED HELPPP</span>
            <span class="loading-spinner" style="display: none;"></span>
        `;
        
        // Add button to page
        document.body.appendChild(button);
        
        // Add click handler
        button.addEventListener('click', handleButtonClick);
        
        return button;
    }
    
    // Create chat interface overlay
    function createChatInterface() {
        const chatOverlay = document.createElement('div');
        chatOverlay.id = 'alphatutor-chat-overlay';
        chatOverlay.className = 'alphatutor-chat-overlay hidden';
        
        chatOverlay.innerHTML = `
            <div class="alphatutor-chat-container">
                <!-- Header -->
                <div class="alphatutor-chat-header">
                    <h1>AlphaTutor</h1>
                    <p class="subtitle">AI Math Helper</p>
                    <button id="alphatutor-close-btn" class="alphatutor-close-btn">×</button>
                </div>
                
                <!-- Status Section -->
                <div class="alphatutor-status-section">
                    <div id="alphatutor-status-message" class="alphatutor-status-message info">
                        <span id="alphatutor-status-text">Content extracted successfully!</span>
                        <div id="alphatutor-status-loader" class="alphatutor-status-loader" style="display: none;"></div>
                    </div>
                </div>
                
                <!-- Chat Messages Area -->
                <div id="alphatutor-chat-messages" class="alphatutor-chat-messages">
                    <!-- Messages will be dynamically added here -->
                </div>
                
                <!-- Input Section -->
                <div class="alphatutor-input-section">
                    <div class="alphatutor-input-container">
                        <input 
                            type="text" 
                            id="alphatutor-question-input" 
                            placeholder="What's your question?"
                        >
                        <button id="alphatutor-submit-btn">
                            <span class="button-text">Send</span>
                            <div class="button-loader" style="display: none;"></div>
                        </button>
                    </div>
                    <div class="alphatutor-input-help">
                        <span>Ask a question about the math content on this page</span>
                    </div>
                </div>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(chatOverlay);
        
        // Add event listeners
        document.getElementById('alphatutor-close-btn').addEventListener('click', closeChatInterface);
        document.getElementById('alphatutor-submit-btn').addEventListener('click', handleSubmitQuestion);
        document.getElementById('alphatutor-question-input').addEventListener('keypress', handleKeyPress);
        
        return chatOverlay;
    }
    
    // Handle button click - extract text and open chat
    async function handleButtonClick() {
        const button = document.getElementById('alphatutor-floating-btn');
        const buttonText = button.querySelector('.button-text');
        const spinner = button.querySelector('.loading-spinner');
        
        // Show loading state
        button.disabled = true;
        buttonText.style.display = 'none';
        spinner.style.display = 'inline-block';
        
        try {
            // Extract page text
            const pageText = extractPageText();
            
            // Send text to background script
            const response = await chrome.runtime.sendMessage({
                action: 'extractText',
                text: pageText,
                url: window.location.href
            });
            
            if (response.success) {
                hasExtractedText = true;
                openChatInterface();
                showChatStatus('Content extracted successfully! Ask a question.', 'success');
            } else {
                console.error('Failed to extract text:', response.error);
                showNotification('Failed to extract text. Please try again.', 'error');
            }
            
        } catch (error) {
            console.error('Error in button click handler:', error);
            showNotification('An error occurred. Please try again.', 'error');
        } finally {
            // Reset button state
            button.disabled = false;
            buttonText.style.display = 'inline';
            spinner.style.display = 'none';
        }
    }
    
    // Open chat interface
    function openChatInterface() {
        const chatOverlay = document.getElementById('alphatutor-chat-overlay');
        if (chatOverlay) {
            chatOverlay.classList.remove('hidden');
            chatOpen = true;
            
            // Focus on input
            const input = document.getElementById('alphatutor-question-input');
            if (input) {
                setTimeout(() => input.focus(), 100);
            }
            
            // Load conversation history
            loadConversationHistory();
        }
    }
    
    // Close chat interface
    function closeChatInterface() {
        const chatOverlay = document.getElementById('alphatutor-chat-overlay');
        if (chatOverlay) {
            chatOverlay.classList.add('hidden');
            chatOpen = false;
        }
    }
    
    // Handle Enter key press in input field
    function handleKeyPress(event) {
        if (event.key === 'Enter' && !isProcessing) {
            handleSubmitQuestion();
        }
    }
    
    // Handle question submission
    async function handleSubmitQuestion() {
        const input = document.getElementById('alphatutor-question-input');
        const submitBtn = document.getElementById('alphatutor-submit-btn');
        const buttonText = submitBtn.querySelector('.button-text');
        const buttonLoader = submitBtn.querySelector('.button-loader');
        
        const question = input.value.trim();
        
        if (!question) {
            showChatStatus('Please enter a question', 'error');
            return;
        }
        
        if (!hasExtractedText) {
            showChatStatus('Please extract page content first', 'error');
            return;
        }
        
        if (isProcessing) {
            return;
        }
        
        try {
            isProcessing = true;
            
            // Show loading state
            buttonText.style.display = 'none';
            buttonLoader.style.display = 'inline-block';
            submitBtn.disabled = true;
            input.disabled = true;
            
            showChatStatus('Processing your question...', 'loading');
            
            // Add user message to chat
            addUserMessage(question);
            
            // Clear input
            input.value = '';
            
            // Send question to background script
            const response = await chrome.runtime.sendMessage({
                action: 'submitQuestion',
                question: question
            });
            
            if (response.success) {
                // Add AI response to chat
                addAIMessage(response.response);
                showChatStatus('Response complete!', 'success');
                
                // Auto-hide success status after 3 seconds
                setTimeout(() => {
                    showChatStatus('Ask another question or close the chat', 'info');
                }, 3000);
                
            } else {
                showChatStatus(response.error || 'Failed to get AI response', 'error');
            }
            
        } catch (error) {
            console.error('Error submitting question:', error);
            showChatStatus('Error processing question. Please try again.', 'error');
        } finally {
            isProcessing = false;
            
            // Reset button state
            buttonText.style.display = 'inline';
            buttonLoader.style.display = 'none';
            submitBtn.disabled = false;
            input.disabled = false;
            input.focus();
        }
    }
    
    // Load and display conversation history
    async function loadConversationHistory() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getConversationHistory'
            });
            
            if (response.success && response.conversations.length > 0) {
                const chatMessages = document.getElementById('alphatutor-chat-messages');
                
                // Clear existing messages
                chatMessages.innerHTML = '';
                
                // Display conversation history with proper async handling
                for (const conversation of response.conversations) {
                    addUserMessage(conversation.userQuestion);
                    await addAIMessage(conversation.aiResponse);
                }
                
                // Scroll to bottom
                scrollToBottom();
            }
            
        } catch (error) {
            console.error('Error loading conversation history:', error);
        }
    }
    
    // Add user message to chat
    function addUserMessage(message) {
        const chatMessages = document.getElementById('alphatutor-chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'alphatutor-message alphatutor-user-message';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'alphatutor-message-content';
        contentDiv.textContent = message;
        
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        
        scrollToBottom();
    }
    
    // Add AI message to chat
    async function addAIMessage(message) {
        const chatMessages = document.getElementById('alphatutor-chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'alphatutor-message alphatutor-ai-message';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'alphatutor-message-content';
        contentDiv.innerHTML = renderMarkdown(message);
        
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        
        // Render MathJax for new mathematical expressions
        await renderMathInElement(contentDiv);
        
        scrollToBottom();
    }
    
    // Simplified MathJax rendering function
    async function renderMathInElement(element) {
        try {
            console.log('AlphaTutor: renderMathInElement called');
            
            // Check if element contains math expressions
            const hasMath = element.innerHTML.includes('$');
            
            if (!hasMath) {
                console.log('AlphaTutor: No math expressions found');
                return;
            }
            
            console.log('AlphaTutor: Found math expressions, attempting to render...');
            
            // Ensure MathJax is loaded
            if (!window.MathJax || !window.MathJax.typesetPromise) {
                console.log('AlphaTutor: Loading MathJax...');
                await loadMathJax();
                // Wait a bit more for MathJax to be fully ready
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Simple rendering approach
            try {
                console.log('AlphaTutor: Calling MathJax.typesetPromise...');
                await window.MathJax.typesetPromise([element]);
                console.log('AlphaTutor: MathJax rendering successful!');
            } catch (renderError) {
                console.error('AlphaTutor: MathJax rendering failed:', renderError);
                addMathFallbackStyling(element);
            }
            
        } catch (error) {
            console.error('AlphaTutor: Error in renderMathInElement:', error);
            addMathFallbackStyling(element);
        }
    }
    
    // Add fallback styling for failed math expressions
    function addMathFallbackStyling(element) {
        const mathElements = element.querySelectorAll('*');
        mathElements.forEach(el => {
            const text = el.textContent || '';
            if (text.includes('\\frac') || text.includes('\\sqrt') || text.includes('\\sum') || 
                text.includes('\\int') || text.includes('\\lim') || text.match(/\$.*\$/)) {
                el.style.cssText += `
                    background: rgba(255, 215, 0, 0.1);
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-family: 'Courier New', monospace;
                    border-left: 2px solid #ffd700;
                `;
            }
        });
    }
    
    // Enhanced markdown rendering with better LaTeX support
    function renderMarkdown(text) {
        // Normalize the text first
        text = text.trim();
        
        // First, protect LaTeX expressions from processing
        const mathExpressions = [];
        let mathIndex = 0;
        
        // Store display math expressions first ($$...$$)
        text = text.replace(/\$\$([^$]*(?:\$(?!\$)[^$]*)*)\$\$/g, (match, content) => {
            const placeholder = `__MATH_DISPLAY_${mathIndex}__`;
            mathExpressions[mathIndex] = match;
            mathIndex++;
            return placeholder;
        });
        
        // Store inline math expressions ($...$)
        text = text.replace(/\$([^$\n]+)\$/g, (match, content) => {
            const placeholder = `__MATH_INLINE_${mathIndex}__`;
            mathExpressions[mathIndex] = match;
            mathIndex++;
            return placeholder;
        });
        
        // Store LaTeX expressions with parentheses and brackets
        text = text.replace(/\\[\(\[]([^\\]*(?:\\(?![\)\]])[^\\]*)*)\\[\)\]]/g, (match, content) => {
            const placeholder = `__MATH_BRACKET_${mathIndex}__`;
            mathExpressions[mathIndex] = match;
            mathIndex++;
            return placeholder;
        });
        
        // Store common LaTeX commands that might appear without delimiters
        const latexCommands = [
            'frac', 'sqrt', 'sum', 'int', 'lim', 'prod', 'sin', 'cos', 'tan', 'log', 'ln', 'exp',
            'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'theta', 'lambda', 'mu', 'pi', 'sigma',
            'infty', 'partial', 'nabla', 'cdot', 'times', 'div', 'pm', 'mp', 'leq', 'geq', 'neq',
            'approx', 'equiv', 'subset', 'supset', 'in', 'notin', 'cup', 'cap', 'wedge', 'vee'
        ];
        
        latexCommands.forEach(cmd => {
            const regex = new RegExp(`\\\\${cmd}(?:\\{[^}]*\\})*(?:\\[[^\\]]*\\])*`, 'g');
            text = text.replace(regex, (match) => {
                const placeholder = `__MATH_CMD_${mathIndex}__`;
                mathExpressions[mathIndex] = `$${match}$`; // Wrap in dollar signs for MathJax
                mathIndex++;
                return placeholder;
            });
        });
        
        // Store code blocks to protect them from processing
        const codeBlocks = [];
        let codeIndex = 0;
        text = text.replace(/```([\s\S]*?)```/g, (match, content) => {
            const placeholder = `__CODE_BLOCK_${codeIndex}__`;
            codeBlocks[codeIndex] = `<pre><code>${content.trim()}</code></pre>`;
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
            // Italic (but not if it's part of math)
            .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

        // Handle lists properly
        html = html.replace(/^[\s]*[-*+]\s+(.*$)/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
        
        // Handle numbered lists
        html = html.replace(/^[\s]*\d+\.\s+(.*$)/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*?<\/li>)/gs, (match) => {
            // Check if this is already wrapped in ul
            if (match.includes('<ul>')) return match;
            return `<ol>${match}</ol>`;
        });
        
        // Handle paragraphs and line breaks more intelligently
        const paragraphs = html.split(/\n\s*\n/);
        html = paragraphs.map(paragraph => {
            paragraph = paragraph.trim();
            if (!paragraph) return '';
            
            // Don't wrap headers, lists, or already wrapped content in paragraphs
            if (paragraph.match(/^<(h[1-6]|ul|ol|li|pre|code)/)) {
                return paragraph.replace(/\n/g, '<br>');
            }
            
            // For regular text, preserve line breaks and wrap in paragraph
            const processedParagraph = paragraph.replace(/\n/g, '<br>');
            return `<p>${processedParagraph}</p>`;
        }).filter(p => p).join('\n\n');
        
        // Restore protected content in reverse order
        // Restore code blocks first
        codeBlocks.forEach((codeBlock, index) => {
            html = html.replace(`__CODE_BLOCK_${index}__`, codeBlock);
        });
        
        // Restore inline code
        inlineCodes.forEach((inlineCode, index) => {
            html = html.replace(`__INLINE_CODE_${index}__`, inlineCode);
        });
        
        // Restore math expressions
        mathExpressions.forEach((mathExpr, index) => {
            html = html.replace(`__MATH_DISPLAY_${index}__`, mathExpr);
            html = html.replace(`__MATH_INLINE_${index}__`, mathExpr);
            html = html.replace(`__MATH_BRACKET_${index}__`, mathExpr);
            html = html.replace(`__MATH_CMD_${index}__`, mathExpr);
        });

        return html;
    }
    
    // Show status message in chat
    function showChatStatus(message, type = 'info') {
        const statusText = document.getElementById('alphatutor-status-text');
        const statusLoader = document.getElementById('alphatutor-status-loader');
        const statusMessage = document.getElementById('alphatutor-status-message');
        
        if (statusText && statusMessage) {
            statusText.textContent = message;
            
            // Handle loading state
            if (type === 'loading') {
                statusLoader.style.display = 'inline-block';
            } else {
                statusLoader.style.display = 'none';
            }
            
            // Update status styling
            statusMessage.className = `alphatutor-status-message ${type}`;
        }
    }
    
    // Scroll chat to bottom
    function scrollToBottom() {
        const chatMessages = document.getElementById('alphatutor-chat-messages');
        if (chatMessages) {
            setTimeout(() => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 100);
        }
    }
    
    // Extract text from the current page
    function extractPageText() {
        // Get main content text, excluding navigation and other UI elements
        let text = '';
        
        // Try to get main content area first
        const mainContent = document.querySelector('main, .main-content, .content, #content');
        if (mainContent) {
            text = mainContent.innerText;
        } else {
            // Fallback to body text
            text = document.body.innerText;
        }
        
        // Clean up the text
        text = text.trim();
        
        // Remove excessive whitespace
        text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
        text = text.replace(/[ \t]+/g, ' ');
        
        return text;
    }
    
    // Show notification to user
    function showNotification(message, type = 'info') {
        // Remove existing notification
        const existing = document.getElementById('alphatutor-notification');
        if (existing) {
            existing.remove();
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.id = 'alphatutor-notification';
        notification.className = `alphatutor-notification ${type}`;
        notification.textContent = message;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'getPageText') {
            const text = extractPageText();
            sendResponse({ success: true, text: text });
        } else if (request.action === 'showNotification') {
            showNotification(request.message, request.type);
            sendResponse({ success: true });
        }
    });
    
    // Simplified MathJax loading
    function loadMathJax() {
        return new Promise((resolve, reject) => {
            // Check if MathJax is already loaded
            if (window.MathJax && window.MathJax.typesetPromise) {
                console.log('AlphaTutor: MathJax already loaded');
                resolve();
                return;
            }
            
            // Simple MathJax configuration
            window.MathJax = {
                tex: {
                    inlineMath: [['$', '$']],
                    displayMath: [['$$', '$$']],
                    processEscapes: true
                },
                options: {
                    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
                },
                startup: {
                    ready: () => {
                        console.log('AlphaTutor: MathJax ready');
                        window.MathJax.startup.defaultReady();
                        resolve();
                    }
                }
            };
            
            // Load MathJax directly
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js';
            script.async = true;
            script.onload = () => {
                console.log('AlphaTutor: MathJax script loaded');
            };
            script.onerror = () => {
                console.error('AlphaTutor: Failed to load MathJax');
                reject(new Error('Failed to load MathJax'));
            };
            
            document.head.appendChild(script);
            
            // Timeout
            setTimeout(() => {
                if (!window.MathJax || !window.MathJax.typesetPromise) {
                    reject(new Error('MathJax loading timeout'));
                }
            }, 15000);
        });
    }
    
    // Initialize when DOM is ready
    async function initialize() {
        try {
            console.log('AlphaTutor: Starting initialization...');
            
            // Wait a bit for page to fully load
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Load MathJax first
            console.log('AlphaTutor: Loading MathJax...');
            try {
                await loadMathJax();
                console.log('AlphaTutor: MathJax loaded successfully');
            } catch (mathJaxError) {
                console.warn('AlphaTutor: MathJax failed to load, continuing without it:', mathJaxError);
            }
            
            // Create UI components
            createFloatingButton();
            createChatInterface();
            
            console.log('AlphaTutor: Initialization complete - floating button and chat interface injected');
            
            // Add global error handler for MathJax
            window.addEventListener('error', (event) => {
                if (event.message && event.message.includes('MathJax')) {
                    console.warn('AlphaTutor: MathJax runtime error:', event.message);
                }
            });
            
        } catch (error) {
            console.error('AlphaTutor: Initialization failed:', error);
            // Still try to create basic UI even if initialization fails
            try {
                createFloatingButton();
                createChatInterface();
            } catch (uiError) {
                console.error('AlphaTutor: Failed to create UI components:', uiError);
            }
        }
    }
    
    // Check if page is already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
})();
