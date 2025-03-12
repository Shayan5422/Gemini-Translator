const GEMINI_API_KEY = "AIzaSyDmWMrbqJN1K9ACefNKTl5xmWaOLAO0Zt8";
const GEMINI_MODEL = "gemini-1.5-flash";

document.addEventListener('DOMContentLoaded', function() {
    const inputText = document.getElementById('inputText');
    const outputText = document.getElementById('outputText');
    const translateBtn = document.getElementById('translateBtn');
    const copyBtn = document.getElementById('copyBtn');
    const targetLanguage = document.getElementById('targetLanguage');
    const textTone = document.getElementById('textTone');
    const errorDiv = document.getElementById('error');

    // Load saved state from localStorage
    function loadSavedState() {
        // Restore input text
        const savedInput = localStorage.getItem('geminiTranslator_inputText');
        if (savedInput) {
            inputText.value = savedInput;
            updateTextDirection(inputText, savedInput);
        }
        
        // Restore selected language
        const savedLanguage = localStorage.getItem('geminiTranslator_language');
        if (savedLanguage) {
            targetLanguage.value = savedLanguage;
            // Apply RTL if needed for the saved language
            if (savedLanguage === 'fa' || savedLanguage === 'ar') {
                outputText.classList.add('rtl');
            } else {
                outputText.classList.remove('rtl');
            }
        }
        
        // Restore selected tone
        const savedTone = localStorage.getItem('geminiTranslator_tone');
        if (savedTone) {
            textTone.value = savedTone;
        }
        
        // Restore output text
        const savedOutput = localStorage.getItem('geminiTranslator_outputText');
        if (savedOutput) {
            outputText.value = savedOutput;
            if (savedOutput.trim() !== '') {
                copyBtn.style.display = 'block';
            }
        }
    }
    
    // Save current state to localStorage
    function saveState() {
        localStorage.setItem('geminiTranslator_inputText', inputText.value);
        localStorage.setItem('geminiTranslator_language', targetLanguage.value);
        localStorage.setItem('geminiTranslator_tone', textTone.value);
        localStorage.setItem('geminiTranslator_outputText', outputText.value);
    }

    // Load saved state when plugin opens
    loadSavedState();
    
    // Focus input on popup open
    inputText.focus();

    // Function to check if text contains RTL characters
    function containsRTLText(text) {
        const rtlRegex = /[\u0591-\u07FF\u200F\u202B\u202E\uFB1D-\uFDFD\uFE70-\uFEFC]/;
        return rtlRegex.test(text);
    }

    // Function to handle RTL/LTR direction
    function updateTextDirection(element, text) {
        if (containsRTLText(text)) {
            element.classList.add('rtl');
        } else {
            element.classList.remove('rtl');
        }
    }

    // Handle input text direction
    inputText.addEventListener('input', function() {
        updateTextDirection(this, this.value);
        saveState(); // Save state when typing
    });

    // Handle target language change
    targetLanguage.addEventListener('change', function() {
        if (this.value === 'fa' || this.value === 'ar') {
            outputText.classList.add('rtl');
        } else {
            outputText.classList.remove('rtl');
        }
        saveState(); // Save state when language changes
    });
    
    // Handle text tone change
    textTone.addEventListener('change', function() {
        saveState(); // Save state when tone changes
    });

    translateBtn.addEventListener('click', async () => {
        if (!inputText.value.trim()) {
            showError('Please enter some text to translate.');
            return;
        }

        try {
            translateBtn.disabled = true;
            translateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Translating...';
            errorDiv.textContent = '';

            const response = await translateText(inputText.value, targetLanguage.value, textTone.value);
            outputText.value = response;
            
            // Update output text direction based on target language
            if (targetLanguage.value === 'fa' || targetLanguage.value === 'ar') {
                outputText.classList.add('rtl');
            } else {
                outputText.classList.remove('rtl');
            }
            
            copyBtn.style.display = 'block'; // Show copy button when there's text
            saveState(); // Save state after translation
        } catch (error) {
            showError('Translation failed. Please try again.');
            console.error('Translation error:', error);
        } finally {
            translateBtn.disabled = false;
            translateBtn.innerHTML = '<i class="fas fa-translate"></i> Translate';
        }
    });

    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(outputText.value);
            
            // Visual feedback
            const originalIcon = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i>';
            copyBtn.style.color = '#34A853';
            
            setTimeout(() => {
                copyBtn.innerHTML = originalIcon;
                copyBtn.style.color = '';
            }, 2000);
        } catch (err) {
            showError('Failed to copy text.');
        }
    });

    // Handle Enter key in input
    inputText.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            translateBtn.click();
        }
    });

    function showError(message) {
        errorDiv.textContent = message;
        setTimeout(() => {
            errorDiv.textContent = '';
        }, 5000); // Clear error after 5 seconds
    }

    async function translateText(text, targetLang, tone) {
        const languageNames = {
            'en': 'English',
            'fa': 'Persian (Farsi)',
            'fr': 'French',
            'es': 'Spanish',
            'de': 'German',
            'ar': 'Arabic'
        };

        const toneInstruction = tone !== 'neutral' 
            ? `The translation should be in a ${tone} tone.` 
            : '';

        const prompt = `Translate the following text to ${languageNames[targetLang]}. ${toneInstruction} Only provide the translation, without any additional explanations or notes:

${text}`;

        const maxRetries = 3;
        let retryCount = 0;
        let lastError = null;

        while (retryCount < maxRetries) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: prompt
                            }]
                        }]
                    })
                });

                if (!response.ok) {
                    if (response.status === 429) {
                        const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
                        showError(`Rate limit reached. Retrying in ${waitTime/1000} seconds...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        retryCount++;
                        continue;
                    }
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                    return data.candidates[0].content.parts[0].text.trim();
                }
                
                throw new Error('Invalid response format from Gemini API');
            } catch (error) {
                lastError = error;
                if (retryCount === maxRetries - 1) {
                    break;
                }
                const waitTime = Math.pow(2, retryCount) * 1000;
                showError(`Translation failed. Retrying in ${waitTime/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                retryCount++;
            }
        }

        // If we've exhausted all retries, throw the last error
        if (lastError.message.includes('429')) {
            throw new Error('Rate limit exceeded. Please wait a few minutes before trying again.');
        }
        throw lastError;
    }
}); 