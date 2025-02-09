const GEMINI_API_KEY = "API_KEY";
const GEMINI_MODEL = "gemini-1.5-flash";

document.addEventListener('DOMContentLoaded', function() {
    const inputText = document.getElementById('inputText');
    const outputText = document.getElementById('outputText');
    const translateBtn = document.getElementById('translateBtn');
    const copyBtn = document.getElementById('copyBtn');
    const targetLanguage = document.getElementById('targetLanguage');
    const errorDiv = document.getElementById('error');

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
    });

    // Handle target language change
    targetLanguage.addEventListener('change', function() {
        if (this.value === 'fa' || this.value === 'ar') {
            outputText.classList.add('rtl');
        } else {
            outputText.classList.remove('rtl');
        }
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

            const response = await translateText(inputText.value, targetLanguage.value);
            outputText.value = response;
            
            // Update output text direction based on target language
            if (targetLanguage.value === 'fa' || targetLanguage.value === 'ar') {
                outputText.classList.add('rtl');
            } else {
                outputText.classList.remove('rtl');
            }
            
            copyBtn.style.display = 'block'; // Show copy button when there's text
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

    async function translateText(text, targetLang) {
        const languageNames = {
            'en': 'English',
            'fa': 'Persian (Farsi)',
            'fr': 'French',
            'es': 'Spanish',
            'de': 'German',
            'ar': 'Arabic'
        };

        const prompt = `Translate the following text to ${languageNames[targetLang]}. Only provide the translation, without any additional explanations or notes:

${text}`;

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
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
            return data.candidates[0].content.parts[0].text.trim();
        }
        
        throw new Error('Invalid response format from Gemini API');
    }
}); 