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
        
        // Check if API key is configured first
        const hasApiKey = await checkApiKeyConfiguration();
        if (!hasApiKey) {
            console.log('AlphaTutor: No API key found, showing setup modal');
            showWebpageApiKeySetup();
            return;
        }
        
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
    
    // Enhanced MathJax rendering function with robust error handling
    async function renderMathInElement(element) {
        try {
            console.log('AlphaTutor: renderMathInElement called');
            
            // Check if element contains math expressions with better detection
            const hasMath = detectMathExpressions(element);
            
            if (!hasMath) {
                console.log('AlphaTutor: No math expressions found');
                return;
            }
            
            console.log('AlphaTutor: Found math expressions, attempting to render...');
            
            // Add loading indicator
            addMathLoadingIndicator(element);
            
            // Ensure MathJax is loaded with retry logic
            const maxRetries = 3;
            let retryCount = 0;
            
            while (retryCount < maxRetries) {
                try {
                    if (!window.MathJax || !window.MathJax.typesetPromise) {
                        console.log(`AlphaTutor: Loading MathJax (attempt ${retryCount + 1}/${maxRetries})...`);
                        await loadMathJax();
                        
                        // Wait for MathJax to be fully ready with proper checking
                        await waitForMathJaxReady();
                    }
                    
                    // Verify MathJax is actually ready
                    if (!window.MathJax || !window.MathJax.typesetPromise) {
                        throw new Error('MathJax not properly initialized');
                    }
                    
                    console.log('AlphaTutor: Calling MathJax.typesetPromise...');
                    
                    // Clear any existing MathJax content first
                    clearExistingMathJax(element);
                    
                    // Render with timeout
                    await Promise.race([
                        window.MathJax.typesetPromise([element]),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('MathJax rendering timeout')), 10000)
                        )
                    ]);
                    
                    console.log('AlphaTutor: MathJax rendering successful!');
                    removeMathLoadingIndicator(element);
                    return; // Success, exit retry loop
                    
                } catch (renderError) {
                    console.error(`AlphaTutor: MathJax rendering failed (attempt ${retryCount + 1}):`, renderError);
                    retryCount++;
                    
                    if (retryCount < maxRetries) {
                        // Wait before retry
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                        // Reset MathJax for retry
                        window.MathJax = null;
                    }
                }
            }
            
            // All retries failed, use fallback
            console.error('AlphaTutor: All MathJax rendering attempts failed, using fallback');
            removeMathLoadingIndicator(element);
            addMathFallbackStyling(element);
            
        } catch (error) {
            console.error('AlphaTutor: Error in renderMathInElement:', error);
            removeMathLoadingIndicator(element);
            addMathFallbackStyling(element);
        }
    }
    
    // Enhanced math detection function
    function detectMathExpressions(element) {
        const text = element.innerHTML;
        
        // Check for various math patterns
        const mathPatterns = [
            /\$[^$\n]+\$/g,           // Inline math $...$
            /\$\$[^$]*\$\$/g,         // Display math $$...$$
            /\\[\(\[].*?\\[\)\]]/g,   // LaTeX brackets \(...\) or \[...\]
            /\\[a-zA-Z]+/g,           // LaTeX commands like \frac, \sqrt, etc.
        ];
        
        return mathPatterns.some(pattern => pattern.test(text));
    }
    
    // Add loading indicator for math rendering
    function addMathLoadingIndicator(element) {
        // Remove existing indicator
        removeMathLoadingIndicator(element);
        
        const indicator = document.createElement('div');
        indicator.className = 'alphatutor-math-loading';
        indicator.textContent = 'Rendering math...';
        element.style.position = 'relative';
        element.appendChild(indicator);
    }
    
    // Remove loading indicator
    function removeMathLoadingIndicator(element) {
        const existing = element.querySelector('.alphatutor-math-loading');
        if (existing) {
            existing.remove();
        }
    }
    
    // Clear existing MathJax content to prevent conflicts
    function clearExistingMathJax(element) {
        // Remove existing MathJax elements
        const mathJaxElements = element.querySelectorAll('mjx-container, .MathJax, .MathJax_Display');
        mathJaxElements.forEach(el => el.remove());
    }
    
    // Wait for MathJax to be fully ready
    async function waitForMathJaxReady() {
        const maxWait = 15000; // 15 seconds max
        const checkInterval = 100; // Check every 100ms
        let waited = 0;
        
        while (waited < maxWait) {
            if (window.MathJax && 
                window.MathJax.typesetPromise && 
                window.MathJax.startup && 
                window.MathJax.startup.document) {
                console.log('AlphaTutor: MathJax is ready');
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waited += checkInterval;
        }
        
        throw new Error('MathJax ready timeout');
    }
    
    // Enhanced fallback styling for failed math expressions
    function addMathFallbackStyling(element) {
        console.log('AlphaTutor: Applying fallback styling for math expressions');
        
        // Add error indicator
        const errorIndicator = document.createElement('div');
        errorIndicator.className = 'alphatutor-math-error';
        errorIndicator.textContent = 'Math render failed';
        errorIndicator.title = 'MathJax failed to render. Showing raw LaTeX.';
        element.style.position = 'relative';
        element.appendChild(errorIndicator);
        
        // Find and style math expressions more comprehensively
        const mathPatterns = [
            { pattern: /\$\$([^$]+)\$\$/g, type: 'display' },
            { pattern: /\$([^$\n]+)\$/g, type: 'inline' },
            { pattern: /\\[\(\[]([^\\]*(?:\\(?![\)\]])[^\\]*)*)\\[\)\]]/g, type: 'bracket' },
            { pattern: /\\(frac|sqrt|sum|int|lim|prod|sin|cos|tan|log|ln|exp|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|infty|partial|nabla|cdot|times|div|pm|mp|leq|geq|neq|approx|equiv|subset|supset|in|notin|cup|cap|wedge|vee)(?:\{[^}]*\})*(?:\[[^\]]*\])*/g, type: 'command' }
        ];
        
        let htmlContent = element.innerHTML;
        let hasReplacements = false;
        
        mathPatterns.forEach(({ pattern, type }) => {
            htmlContent = htmlContent.replace(pattern, (match) => {
                hasReplacements = true;
                const displayStyle = type === 'display' ? 'display: block; text-align: center; margin: 12px 0;' : 'display: inline;';
                return `<span class="alphatutor-math-fallback" style="
                    background: rgba(255, 215, 0, 0.1) !important;
                    padding: ${type === 'display' ? '8px 12px' : '2px 6px'} !important;
                    border-radius: 4px !important;
                    font-family: 'Fira Code', 'Consolas', 'Courier New', monospace !important;
                    border-left: 3px solid #ffd700 !important;
                    color: #e0e0e0 !important;
                    font-size: ${type === 'display' ? '1.1em' : '0.95em'} !important;
                    ${displayStyle}
                    border: 1px solid rgba(255, 215, 0, 0.3) !important;
                    position: relative !important;
                " title="LaTeX: ${match.replace(/"/g, '&quot;')}">${match}</span>`;
            });
        });
        
        if (hasReplacements) {
            element.innerHTML = htmlContent;
            console.log('AlphaTutor: Applied fallback styling to math expressions');
        }
        
        // Also check for any remaining unprocessed math in text nodes
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.includes('\\') || node.textContent.includes('$')) {
                textNodes.push(node);
            }
        }
        
        textNodes.forEach(textNode => {
            const text = textNode.textContent;
            if (text.match(/[\$\\]/)) {
                const span = document.createElement('span');
                span.className = 'alphatutor-math-fallback';
                span.style.cssText = `
                    background: rgba(255, 215, 0, 0.1) !important;
                    padding: 2px 6px !important;
                    border-radius: 3px !important;
                    font-family: 'Fira Code', 'Consolas', monospace !important;
                    border-left: 2px solid #ffd700 !important;
                    color: #e0e0e0 !important;
                    font-size: 0.9em !important;
                `;
                span.textContent = text;
                span.title = `LaTeX: ${text}`;
                textNode.parentNode.replaceChild(span, textNode);
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
    
    // Enhanced MathJax loading with better configuration and fallback
    function loadMathJax() {
        return new Promise((resolve, reject) => {
            // Check if MathJax is already loaded
            if (window.MathJax && window.MathJax.typesetPromise) {
                console.log('AlphaTutor: MathJax already loaded');
                resolve();
                return;
            }
            
            // Enhanced MathJax configuration
            window.MathJax = {
                tex: {
                    inlineMath: [['$', '$'], ['\\(', '\\)']],
                    displayMath: [['$$', '$$'], ['\\[', '\\]']],
                    processEscapes: true,
                    processEnvironments: true,
                    processRefs: true,
                    digits: /^(?:[0-9]+(?:\{,\}[0-9]{3})*(?:\.[0-9]*)?|\.[0-9]+)/,
                    tags: 'none',
                    tagSide: 'right',
                    tagIndent: '0.8em',
                    useLabelIds: true,
                    multlineWidth: '85%',
                    maxMacros: 1000,
                    maxBuffer: 5 * 1024,
                    packages: {
                        '[+]': ['base', 'ams', 'newcommand', 'configmacros', 'action', 'require', 'autoload', 'color']
                    }
                },
                chtml: {
                    scale: 1,
                    minScale: 0.5,
                    matchFontHeight: false,
                    displayAlign: 'center',
                    displayIndent: '0',
                    fontURL: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2'
                },
                options: {
                    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'annotation', 'annotation-xml'],
                    includeHtmlTags: ['#comment'],
                    processHtmlClass: 'tex2jax_process',
                    ignoreHtmlClass: 'tex2jax_ignore',
                    renderActions: {
                        addMenu: [0, '', '']
                    },
                    menuOptions: {
                        settings: {
                            assistiveMml: true,
                            collapsible: false,
                            explorer: false,
                            inTabOrder: true
                        }
                    }
                },
                loader: {
                    load: ['[tex]/ams', '[tex]/newcommand', '[tex]/configmacros', '[tex]/action', '[tex]/require', '[tex]/autoload', '[tex]/color']
                },
                startup: {
                    ready: () => {
                        console.log('AlphaTutor: MathJax startup ready');
                        try {
                            window.MathJax.startup.defaultReady();
                            console.log('AlphaTutor: MathJax fully initialized');
                            resolve();
                        } catch (error) {
                            console.error('AlphaTutor: MathJax startup error:', error);
                            reject(error);
                        }
                    },
                    pageReady: () => {
                        console.log('AlphaTutor: MathJax page ready');
                        return window.MathJax.startup.defaultPageReady();
                    }
                }
            };
            
            // Try loading local MathJax first, then fallback to CDN
            const tryLoadMathJax = async (scriptSrc, isLocal = true) => {
                return new Promise((scriptResolve, scriptReject) => {
                    const script = document.createElement('script');
                    script.src = scriptSrc;
                    script.async = true;
                    script.id = 'mathjax-script';
                    
                    script.onload = () => {
                        console.log(`AlphaTutor: MathJax script loaded from ${isLocal ? 'local' : 'CDN'}`);
                        scriptResolve();
                    };
                    
                    script.onerror = (error) => {
                        console.error(`AlphaTutor: Failed to load MathJax from ${isLocal ? 'local' : 'CDN'}:`, error);
                        script.remove();
                        scriptReject(error);
                    };
                    
                    document.head.appendChild(script);
                    
                    // Timeout for script loading
                    setTimeout(() => {
                        if (!script.onload.called) {
                            console.error(`AlphaTutor: MathJax loading timeout from ${isLocal ? 'local' : 'CDN'}`);
                            script.remove();
                            scriptReject(new Error('Script loading timeout'));
                        }
                    }, 10000);
                });
            };
            
            // Main loading logic with fallback
            const loadWithFallback = async () => {
                try {
                    // Try local first
                    console.log('AlphaTutor: Attempting to load MathJax from local files...');
                    await tryLoadMathJax(chrome.runtime.getURL('lib/mathjax/tex-chtml.js'), true);
                } catch (localError) {
                    console.warn('AlphaTutor: Local MathJax failed, trying CDN fallback...', localError);
                    try {
                        // Fallback to CDN
                        await tryLoadMathJax('https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js', false);
                    } catch (cdnError) {
                        console.error('AlphaTutor: Both local and CDN MathJax failed:', cdnError);
                        throw new Error('All MathJax loading attempts failed');
                    }
                }
            };
            
            // Start loading
            loadWithFallback().catch(reject);
            
            // Overall timeout
            setTimeout(() => {
                if (!window.MathJax || !window.MathJax.typesetPromise) {
                    console.error('AlphaTutor: MathJax initialization timeout');
                    reject(new Error('MathJax initialization timeout'));
                }
            }, 20000);
        });
    }
    
    // Check if API key is configured
    async function checkApiKeyConfiguration() {
        try {
            const result = await chrome.storage.local.get(['googleApiKey']);
            return !!result.googleApiKey;
        } catch (error) {
            console.error('Error checking API key:', error);
            return false;
        }
    }
    
    // Show API key setup modal on the webpage
    function showWebpageApiKeySetup() {
        // Remove existing modal if any
        const existingModal = document.getElementById('alphatutor-api-key-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal overlay
        const modal = document.createElement('div');
        modal.id = 'alphatutor-api-key-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            animation: modalFadeIn 0.3s ease;
        `;
        
        modal.innerHTML = `
            <div style="
                background: #2a2a2a;
                border: 1px solid #404040;
                border-radius: 12px;
                padding: 24px;
                width: 90%;
                max-width: 400px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                animation: modalSlideIn 0.3s ease;
                color: #e0e0e0;
            ">
                <div style="text-align: center; margin-bottom: 16px;">
                    <h2 style="color: #e0e0e0; font-size: 1.3rem; font-weight: 600; margin: 0;">🔑 API Key Setup</h2>
                </div>
                <div style="margin-bottom: 20px;">
                    <p style="color: #b0b0b0; font-size: 0.9rem; line-height: 1.5; margin: 0;">
                        You need an api key this is very easy <a href="https://makersuite.google.com/app/apikey" target="_blank" id="alphatutor-api-key-link" style="color: #4a9eff; text-decoration: none; font-weight: 600;">click this link</a> login and press create new api key. then copy and paste it into this box. (Dont worry this is free)
                    </p>
                </div>
                <div style="margin-bottom: 16px;">
                    <input type="password" id="alphatutor-api-key-input" placeholder="Paste your API key here" style="
                        width: 100%;
                        background: #333333;
                        border: 1px solid #404040;
                        border-radius: 8px;
                        padding: 12px;
                        color: #e0e0e0;
                        font-size: 0.9rem;
                        font-family: 'Fira Code', 'Consolas', monospace;
                        margin-bottom: 16px;
                        box-sizing: border-box;
                    ">
                    <div style="display: flex; gap: 8px;">
                        <button id="alphatutor-save-api-key" style="
                            background: linear-gradient(135deg, #4a9eff, #6bb6ff);
                            color: white;
                            border: none;
                            border-radius: 8px;
                            padding: 10px 16px;
                            font-weight: 600;
                            cursor: pointer;
                            flex: 1;
                            font-size: 0.9rem;
                        ">Save API Key</button>
                        <button id="alphatutor-cancel-api-key" style="
                            background: #333333;
                            color: #b0b0b0;
                            border: 1px solid #404040;
                            border-radius: 8px;
                            padding: 10px 16px;
                            font-weight: 600;
                            cursor: pointer;
                            flex: 1;
                            font-size: 0.9rem;
                        ">Cancel</button>
                    </div>
                </div>
                <div id="alphatutor-api-key-status" style="margin-top: 12px; min-height: 20px;"></div>
            </div>
        `;
        
        // Add styles for animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes modalFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes modalSlideIn {
                from { opacity: 0; transform: translateY(-20px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
        `;
        document.head.appendChild(style);
        
        // Add modal to page
        document.body.appendChild(modal);
        
        // Get modal elements
        const apiKeyInput = document.getElementById('alphatutor-api-key-input');
        const saveBtn = document.getElementById('alphatutor-save-api-key');
        const cancelBtn = document.getElementById('alphatutor-cancel-api-key');
        const apiKeyStatus = document.getElementById('alphatutor-api-key-status');
        const apiKeyLink = document.getElementById('alphatutor-api-key-link');
        
        // Focus on input
        setTimeout(() => apiKeyInput.focus(), 100);
        
        // Handle link click
        apiKeyLink.addEventListener('click', () => {
            apiKeyStatus.innerHTML = '<div style="background: rgba(23, 162, 184, 0.1); color: #17a2b8; border: 1px solid #17a2b8; border-radius: 6px; padding: 8px 12px; font-size: 0.85rem; font-weight: 500;">✅ Link opened! Get your API key and come back here to paste it.</div>';
        });
        
        // Handle save button
        saveBtn.addEventListener('click', async () => {
            const apiKey = apiKeyInput.value.trim();
            
            if (!apiKey) {
                apiKeyStatus.innerHTML = '<div style="background: rgba(220, 53, 69, 0.1); color: #dc3545; border: 1px solid #dc3545; border-radius: 6px; padding: 8px 12px; font-size: 0.85rem; font-weight: 500;">Please enter an API key</div>';
                return;
            }
            
            // Basic validation
            if (apiKey.length < 20) {
                apiKeyStatus.innerHTML = '<div style="background: rgba(220, 53, 69, 0.1); color: #dc3545; border: 1px solid #dc3545; border-radius: 6px; padding: 8px 12px; font-size: 0.85rem; font-weight: 500;">API key appears to be too short. Please check and try again.</div>';
                return;
            }
            
            if (!apiKey.startsWith('AIza')) {
                apiKeyStatus.innerHTML = '<div style="background: rgba(220, 53, 69, 0.1); color: #dc3545; border: 1px solid #dc3545; border-radius: 6px; padding: 8px 12px; font-size: 0.85rem; font-weight: 500;">Invalid Google AI API key format. Keys should start with "AIza".</div>';
                return;
            }
            
            try {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
                apiKeyStatus.innerHTML = '<div style="background: rgba(74, 158, 255, 0.1); color: #4a9eff; border: 1px solid #4a9eff; border-radius: 6px; padding: 8px 12px; font-size: 0.85rem; font-weight: 500; display: flex; align-items: center; gap: 8px;"><div style="width: 16px; height: 16px; border: 2px solid transparent; border-top: 2px solid currentColor; border-radius: 50%; animation: spin 1s linear infinite;"></div>Saving and testing API key...</div>';
                
                // Save to storage
                await chrome.storage.local.set({
                    googleApiKey: apiKey
                });
                
                apiKeyStatus.innerHTML = '<div style="background: rgba(40, 167, 69, 0.1); color: #28a745; border: 1px solid #28a745; border-radius: 6px; padding: 8px 12px; font-size: 0.85rem; font-weight: 500;">✅ API key saved successfully! You can now use the extension.</div>';
                
                // Close modal after success
                setTimeout(() => {
                    modal.remove();
                    showNotification('API key configured successfully! Click the "I NEED HELPPP" button to get started.', 'success');
                    
                    // Now load MathJax since API key is configured and UI already exists
                    setTimeout(async () => {
                        try {
                            // Load MathJax first
                            console.log('AlphaTutor: Loading MathJax after API key setup...');
                            try {
                                await loadMathJax();
                                console.log('AlphaTutor: MathJax loaded successfully');
                            } catch (mathJaxError) {
                                console.warn('AlphaTutor: MathJax failed to load, continuing without it:', mathJaxError);
                            }
                            
                            console.log('AlphaTutor: MathJax loaded after API key setup');
                        } catch (error) {
                            console.error('AlphaTutor: Error loading MathJax after API key setup:', error);
                        }
                    }, 1000);
                }, 2000);
                
            } catch (error) {
                console.error('Error saving API key:', error);
                apiKeyStatus.innerHTML = '<div style="background: rgba(220, 53, 69, 0.1); color: #dc3545; border: 1px solid #dc3545; border-radius: 6px; padding: 8px 12px; font-size: 0.85rem; font-weight: 500;">Error saving API key. Please try again.</div>';
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save API Key';
            }
        });
        
        // Handle cancel button
        cancelBtn.addEventListener('click', () => {
            modal.remove();
        });
        
        // Handle Enter key in input
        apiKeyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            }
        });
        
        // Handle Escape key
        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        });
    }
    
    // Initialize when DOM is ready
    async function initialize() {
        try {
            console.log('AlphaTutor: Starting initialization...');
            
            // Wait a bit for page to fully load
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Always create the floating button and chat interface first
            createFloatingButton();
            createChatInterface();
            console.log('AlphaTutor: UI components created');
            
            // Check if API key is configured
            const hasApiKey = await checkApiKeyConfiguration();
            if (!hasApiKey) {
                console.log('AlphaTutor: No API key found, showing setup modal');
                showWebpageApiKeySetup();
                // UI components are already created, so user can see the button
                return;
            }
            
            // Load MathJax if API key is available
            console.log('AlphaTutor: Loading MathJax...');
            try {
                await loadMathJax();
                console.log('AlphaTutor: MathJax loaded successfully');
            } catch (mathJaxError) {
                console.warn('AlphaTutor: MathJax failed to load, continuing without it:', mathJaxError);
            }
            
            console.log('AlphaTutor: Initialization complete - floating button and chat interface ready');
            
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
