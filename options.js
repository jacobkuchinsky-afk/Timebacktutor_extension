// TimebackTutor Options Page Script
// Handles API key configuration and settings

document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const saveBtn = document.getElementById('saveBtn');
    const clearBtn = document.getElementById('clearBtn');
    const statusMessage = document.getElementById('statusMessage');
    
    // Load existing API key on page load
    loadSettings();
    
    // Event listeners
    saveBtn.addEventListener('click', saveSettings);
    clearBtn.addEventListener('click', clearSettings);
    apiKeyInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            saveSettings();
        }
    });
    
    // Load settings from storage
    async function loadSettings() {
        try {
            const result = await chrome.storage.local.get(['googleApiKey']);
            if (result.googleApiKey) {
                // Show masked API key
                apiKeyInput.value = '••••••••••••••••••••••••••••••••••••••••';
                apiKeyInput.setAttribute('data-has-key', 'true');
                showStatus('API key is configured', 'success');
            } else {
                apiKeyInput.value = '';
                apiKeyInput.removeAttribute('data-has-key');
                showStatus('No API key configured', 'error');
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            showStatus('Error loading settings', 'error');
        }
    }
    
    // Save settings to storage
    async function saveSettings() {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            showStatus('Please enter an API key', 'error');
            return;
        }
        
        // Don't save if it's the masked value and we already have a key
        if (apiKey === '••••••••••••••••••••••••••••••••••••••••' && apiKeyInput.getAttribute('data-has-key')) {
            showStatus('API key is already configured', 'success');
            return;
        }
        
        // Basic validation
        if (apiKey.length < 20) {
            showStatus('API key appears to be too short. Please check and try again.', 'error');
            return;
        }
        
        if (!apiKey.startsWith('AIza')) {
            showStatus('Invalid Google AI API key format. Keys should start with "AIza".', 'error');
            return;
        }
        
        try {
            // Save to storage
            await chrome.storage.local.set({
                googleApiKey: apiKey
            });
            
            // Update UI
            apiKeyInput.value = '••••••••••••••••••••••••••••••••••••••••';
            apiKeyInput.setAttribute('data-has-key', 'true');
            
            showStatus('API key saved successfully!', 'success');
            
            // Test the API key
            testApiKey(apiKey);
            
        } catch (error) {
            console.error('Error saving settings:', error);
            showStatus('Error saving API key. Please try again.', 'error');
        }
    }
    
    // Clear settings
    async function clearSettings() {
        if (!confirm('Are you sure you want to clear the API key? The extension will not work without it.')) {
            return;
        }
        
        try {
            await chrome.storage.local.remove(['googleApiKey']);
            
            // Update UI
            apiKeyInput.value = '';
            apiKeyInput.removeAttribute('data-has-key');
            
            showStatus('API key cleared', 'success');
            
        } catch (error) {
            console.error('Error clearing settings:', error);
            showStatus('Error clearing API key', 'error');
        }
    }
    
    // Test API key validity
    async function testApiKey(apiKey) {
        try {
            showStatus('Testing API key...', 'success');
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: 'Hello, this is a test. Please respond with "API key is working".'
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 50,
                    }
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                    showStatus('API key is valid and working!', 'success');
                } else {
                    showStatus('API key saved, but response format is unexpected. It should still work.', 'success');
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 401) {
                    showStatus('API key is invalid. Please check and try again.', 'error');
                } else if (response.status === 429) {
                    showStatus('API key saved, but rate limit reached. Try again later.', 'success');
                } else {
                    showStatus(`API key saved, but test failed (${response.status}). It may still work.`, 'success');
                }
            }
            
        } catch (error) {
            console.error('Error testing API key:', error);
            showStatus('API key saved, but could not test connectivity. It should still work.', 'success');
        }
    }
    
    // Show status message
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message status-${type}`;
        statusMessage.style.display = 'block';
        
        // Auto-hide after 5 seconds for success messages
        if (type === 'success') {
            setTimeout(() => {
                statusMessage.style.display = 'none';
            }, 5000);
        }
    }
    
    // Handle input focus to clear masked value
    apiKeyInput.addEventListener('focus', function() {
        if (this.value === '••••••••••••••••••••••••••••••••••••••••') {
            this.value = '';
            this.removeAttribute('data-has-key');
        }
    });
    
    // Handle input blur to restore masked value if empty
    apiKeyInput.addEventListener('blur', function() {
        if (!this.value.trim() && this.getAttribute('data-has-key')) {
            this.value = '••••••••••••••••••••••••••••••••••••••••';
        }
    });
});
