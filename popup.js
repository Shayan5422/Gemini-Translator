// Gemini API Configuration
const GEMINI_API_KEY = "AIzaSyAsjR35P6w8iExh3wVd9GQc9V3s9yXTB18"; // Replace with your actual Gemini API key
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/";

// Gemini models in priority order (will try from top to bottom)
const GEMINI_MODELS = [
    { name: "gemini-2.5-flash", rpm: 10, tpm: 250000, rpd: 250 },
    { name: "gemini-2.0-flash-lite", rpm: 30, tpm: 1000000, rpd: 200 },
    { name: "gemini-2.5-flash-lite-preview", rpm: 15, tpm: 250000, rpd: 1000 },
    { name: "gemini-2.0-flash", rpm: 15, tpm: 1000000, rpd: 200 },
    { name: "gemini-2.5-flash-preview", rpm: 10, tpm: 250000, rpd: 250 },
    { name: "gemini-2.5-flash-lite", rpm: 15, tpm: 250000, rpd: 1000 },
    { name: "gemini-2.5-pro", rpm: 2, tpm: 125000, rpd: 50 },
];

document.addEventListener('DOMContentLoaded', function () {
    const inputText = document.getElementById('inputText');
    const outputText = document.getElementById('outputText');
    const translateBtn = document.getElementById('translateBtn');
    const copyBtn = document.getElementById('copyBtn');
    const speakBtn = document.getElementById('speakBtn');
    const targetLanguage = document.getElementById('targetLanguage');
    const textTone = document.getElementById('textTone');
    const errorDiv = document.getElementById('error');
    const clearInputBtn = document.getElementById('clearInputBtn');

    // Custom language elements
    const customLanguageContainer = document.getElementById('customLanguageContainer');
    const customLanguage = document.getElementById('customLanguage');

    // History elements
    const historyToggle = document.getElementById('historyToggle');
    const historyContent = document.getElementById('historyContent');
    const historyList = document.getElementById('historyList');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    // Translation history array
    let translationHistory = [];
    const MAX_HISTORY_ITEMS = 10;

    // Speech synthesis variables
    let speechSynthesis = window.speechSynthesis;
    let speechUtterance = null;
    let isSpeaking = false;

    // Map of language codes to BCP-47 language tags for speech synthesis
    const speechLangMap = {
        'en': 'en-US',
        'fa': 'fa-IR',
        'fr': 'fr-FR',
        'es': 'es-ES',
        'de': 'de-DE',
        'ar': 'ar-SA',
        'ta': 'ta-IN'

    };

    // Language display names
    const languageNames = {
        'en': 'English',
        'fa': 'Persian (Farsi)',
        'fr': 'French',
        'es': 'Spanish',
        'de': 'German',
        'ar': 'Arabic',
        'ta': 'Tamil'
    };

    // Load saved state from localStorage
    function loadSavedState() {
        // Restore input text
        const savedInput = localStorage.getItem('geminiTranslator_inputText');
        if (savedInput) {
            inputText.value = savedInput;
            updateTextDirection(inputText, savedInput);

            // Show clear button if there's text
            if (savedInput.trim() !== '') {
                clearInputBtn.style.display = 'flex';
            }
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

            // Show custom language field if 'other' was selected
            if (savedLanguage === 'other') {
                customLanguageContainer.style.display = 'block';

                // Load saved custom language
                const savedCustomLang = localStorage.getItem('geminiTranslator_customLanguage');
                if (savedCustomLang) {
                    customLanguage.value = savedCustomLang;
                }
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
                speakBtn.style.display = 'block';
            }
        }

        // Load translation history
        const savedHistory = localStorage.getItem('geminiTranslator_history');
        if (savedHistory) {
            try {
                translationHistory = JSON.parse(savedHistory);
                renderTranslationHistory();
            } catch (e) {
                console.error('Error parsing translation history:', e);
                translationHistory = [];
            }
        }
    }

    // Save current state to localStorage
    function saveState() {
        localStorage.setItem('geminiTranslator_inputText', inputText.value);
        localStorage.setItem('geminiTranslator_language', targetLanguage.value);
        localStorage.setItem('geminiTranslator_tone', textTone.value);
        localStorage.setItem('geminiTranslator_outputText', outputText.value);

        // Save custom language if applicable
        if (targetLanguage.value === 'other') {
            localStorage.setItem('geminiTranslator_customLanguage', customLanguage.value);
        }
    }

    // Save translation history to localStorage
    function saveTranslationHistory() {
        localStorage.setItem('geminiTranslator_history', JSON.stringify(translationHistory));
    }

    // Load saved state when plugin opens
    loadSavedState();

    // Initialize history toggle state
    if (translationHistory.length === 0) {
        historyContent.classList.add('collapsed');
        historyToggle.classList.add('collapsed');
    }

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

    // Handle input text direction and clear button visibility
    inputText.addEventListener('input', function () {
        updateTextDirection(this, this.value);
        // Show/hide clear button based on input content
        if (this.value.trim() !== '') {
            clearInputBtn.style.display = 'flex';
        } else {
            clearInputBtn.style.display = 'none';
        }
        saveState(); // Save state when typing
    });

    // Clear input text when clear button is clicked
    clearInputBtn.addEventListener('click', function () {
        inputText.value = '';
        clearInputBtn.style.display = 'none';
        saveState();
        inputText.focus();
    });

    // Handle target language change
    targetLanguage.addEventListener('change', function () {
        if (this.value === 'fa' || this.value === 'ar') {
            outputText.classList.add('rtl');
        } else {
            outputText.classList.remove('rtl');
        }

        // Handle custom language option
        if (this.value === 'other') {
            customLanguageContainer.style.display = 'block';
            customLanguage.focus();
        } else {
            customLanguageContainer.style.display = 'none';
        }

        saveState(); // Save state when language changes
    });

    // Save custom language input when it changes
    customLanguage.addEventListener('input', function () {
        saveState();
    });

    // Handle text tone change
    textTone.addEventListener('change', function () {
        saveState(); // Save state when tone changes
    });

    // Toggle translation history panel
    historyToggle.addEventListener('click', function () {
        historyContent.classList.toggle('collapsed');
        historyToggle.classList.toggle('collapsed');
    });

    // Clear translation history
    clearHistoryBtn.addEventListener('click', function () {
        translationHistory = [];
        saveTranslationHistory();
        renderTranslationHistory();
    });

    // Add translation to history
    function addToHistory(inputText, outputText, targetLang, tone) {
        // Get language display name
        let langDisplayName = targetLang === 'other' ? customLanguage.value : languageNames[targetLang];

        // Create new history item
        const historyItem = {
            id: Date.now(), // Use timestamp as unique ID
            input: inputText,
            output: outputText,
            language: targetLang,
            languageName: langDisplayName,
            tone: tone,
            timestamp: new Date().toISOString()
        };

        // Add to the beginning of array
        translationHistory.unshift(historyItem);

        // Limit history to MAX_HISTORY_ITEMS
        if (translationHistory.length > MAX_HISTORY_ITEMS) {
            translationHistory = translationHistory.slice(0, MAX_HISTORY_ITEMS);
        }

        // Save to localStorage
        saveTranslationHistory();

        // Update UI
        renderTranslationHistory();

        // Make sure history panel is visible
        historyContent.classList.remove('collapsed');
        historyToggle.classList.remove('collapsed');
    }

    // Render translation history
    function renderTranslationHistory() {
        // Clear current history list
        historyList.innerHTML = '';

        if (translationHistory.length === 0) {
            // Show empty message
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'empty-history';
            emptyMsg.textContent = 'No translation history yet';
            historyList.appendChild(emptyMsg);
            return;
        }

        // Add each history item to the list
        translationHistory.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';

            // Format the timestamp
            const date = new Date(item.timestamp);
            const formattedDate = date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            // Get language display name
            const langName = item.languageName || (item.language === 'other' ? customLanguage.value : languageNames[item.language]);

            historyItem.innerHTML = `
                <div class="history-item-content">
                    <div class="history-item-text">${item.input}</div>
                    <div class="history-item-info">
                        <span>${formattedDate}</span>
                        <span>${item.tone !== 'neutral' ? '&bull; ' + item.tone : ''}</span>
                    </div>
                </div>
                <div class="history-item-lang">${langName}</div>
            `;

            // Add click event to load this translation
            historyItem.addEventListener('click', function () {
                inputText.value = item.input;
                outputText.value = item.output;
                targetLanguage.value = item.language;
                textTone.value = item.tone;

                // Update text direction
                updateTextDirection(inputText, item.input);
                if (item.language === 'fa' || item.language === 'ar') {
                    outputText.classList.add('rtl');
                } else {
                    outputText.classList.remove('rtl');
                }

                // Show buttons
                copyBtn.style.display = 'block';
                speakBtn.style.display = 'block';

                // Save state
                saveState();
            });

            historyList.appendChild(historyItem);
        });
    }

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

            // Add to history
            addToHistory(inputText.value, response, targetLanguage.value, textTone.value);

            copyBtn.style.display = 'block'; // Show copy button when there's text
            speakBtn.style.display = 'block'; // Show speak button when there's text
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

    // Text-to-Speech functionality
    speakBtn.addEventListener('click', () => {
        if (isSpeaking) {
            // Stop speaking if already in progress
            stopSpeaking();
        } else {
            // Start speaking
            speakText(outputText.value, targetLanguage.value);
        }
    });

    function speakText(text, langCode) {
        if (!text || !speechSynthesis) {
            return;
        }

        // Cancel any ongoing speech
        stopSpeaking();

        // Create a new utterance
        speechUtterance = new SpeechSynthesisUtterance(text);

        // Set language based on target language
        const speechLang = speechLangMap[langCode] || 'en-US';
        speechUtterance.lang = speechLang;

        // Get available voices and try to find a matching one
        setTimeout(() => {
            const voices = speechSynthesis.getVoices();
            const languageVoices = voices.filter(voice => voice.lang.startsWith(speechLang.split('-')[0]));

            if (languageVoices.length > 0) {
                speechUtterance.voice = languageVoices[0];
            }

            // Update UI to show speaking state
            speakBtn.innerHTML = '<i class="fas fa-stop"></i>';
            speakBtn.classList.add('speaking');
            speakBtn.title = 'Stop speaking';
            isSpeaking = true;

            // Handle speech end
            speechUtterance.onend = resetSpeakButton;
            speechUtterance.onerror = resetSpeakButton;

            // Start speaking
            speechSynthesis.speak(speechUtterance);
        }, 100);
    }

    function stopSpeaking() {
        if (speechSynthesis) {
            speechSynthesis.cancel();
        }
        resetSpeakButton();
    }

    function resetSpeakButton() {
        speakBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        speakBtn.classList.remove('speaking');
        speakBtn.title = 'Listen to translation';
        isSpeaking = false;
    }

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
        const toneInstruction = tone !== 'neutral'
            ? `The translation should be in a ${tone} tone.`
            : '';

        // Determine the language name for translation
        const langNameForTranslation = targetLang === 'other'
            ? customLanguage.value
            : languageNames[targetLang];

        // Validate custom language input
        if (targetLang === 'other' && !langNameForTranslation.trim()) {
            throw new Error('Please enter a language name.');
        }

        const prompt = `Translate the following text to ${langNameForTranslation}. ${toneInstruction} Only provide the translation, without any additional explanations or notes:\n\n${text}`;

        // Try each model in order until one succeeds
        let lastError = null;

        for (let modelIndex = 0; modelIndex < GEMINI_MODELS.length; modelIndex++) {
            const model = GEMINI_MODELS[modelIndex];

            try {
                // Show which model we're trying
                if (modelIndex > 0) {
                    showError(`Trying ${model.name}...`);
                }

                const endpoint = `${GEMINI_ENDPOINT}${model.name}:generateContent?key=${GEMINI_API_KEY}`;

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: prompt
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.3,
                            topK: 40,
                            topP: 0.95,
                            maxOutputTokens: 8192,
                        }
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));

                    // If rate limit or quota exceeded, try next model
                    if (response.status === 429 || response.status === 503) {
                        lastError = new Error(`${model.name}: Rate limit or quota exceeded`);
                        continue; // Try next model
                    }

                    // If this is not the last model, try the next one
                    if (modelIndex < GEMINI_MODELS.length - 1) {
                        lastError = new Error(`${model.name}: HTTP ${response.status}`);
                        continue;
                    }

                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                // Check for API errors
                if (data.error) {
                    // If rate limit or resource exhausted, try next model
                    if (data.error.code === 429 || data.error.code === 503 ||
                        data.error.message?.includes('RESOURCE_EXHAUSTED') ||
                        data.error.message?.includes('RATE_LIMIT')) {
                        lastError = new Error(`${model.name}: ${data.error.message}`);
                        continue; // Try next model
                    }

                    // For other errors, if not last model, try next
                    if (modelIndex < GEMINI_MODELS.length - 1) {
                        lastError = new Error(`${model.name}: ${data.error.message}`);
                        continue;
                    }

                    throw new Error(data.error.message);
                }

                // Extract the translation from the response
                const candidate = data.candidates?.[0];
                if (!candidate) {
                    throw new Error('No response from model');
                }

                const textContent = candidate.content?.parts?.[0]?.text;

                if (typeof textContent === 'string' && textContent.trim()) {
                    // Success! Return the translation
                    return textContent.trim();
                }

                throw new Error('Invalid response format from Gemini API');

            } catch (error) {
                lastError = error;

                // If this is the last model, throw the error
                if (modelIndex === GEMINI_MODELS.length - 1) {
                    break;
                }

                // Otherwise, continue to next model
                console.log(`Model ${model.name} failed:`, error.message);
            }
        }

        // If we've tried all models and none succeeded, throw the last error
        throw new Error(`All models failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }
}); 
