(function() {
    'use strict';

    // Currency formatting configuration
    const CURRENCY_CONFIG = {
        eur: { symbol: '€', position: 'before' },
        usd: { symbol: '$', position: 'before' },
        gbp: { symbol: '£', position: 'before' },
    };

    // State
    let musician = null;
    let selectedAmount = null; // Amount in minor units (cents)
    let isCustomAmount = false;

    // DOM Elements
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const errorMessageEl = document.getElementById('error-message');
    const setupIncompleteEl = document.getElementById('setup-incomplete');
    const mainContentEl = document.getElementById('main-content');
    const bannerImageEl = document.getElementById('banner-image');
    const profileImageEl = document.getElementById('profile-image');
    const musicianNameEl = document.getElementById('musician-name');
    const musicianDescriptionEl = document.getElementById('musician-description');
    const presetAmountsEl = document.getElementById('preset-amounts');
    const customAmountSectionEl = document.getElementById('custom-amount-section');
    const customAmountInputEl = document.getElementById('custom-amount');
    const toggleCustomBtn = document.getElementById('toggle-custom');
    const sendTipBtn = document.getElementById('send-tip-btn');
    const paymentErrorEl = document.getElementById('payment-error');
    const paymentErrorMessageEl = document.getElementById('payment-error-message');

    // Get musician ID from URL path
    function getMusicianIdFromPath() {
        const path = window.location.pathname;
        const matches = path.match(/\/tip\/([^/]+)/);
        return matches ? matches[1] : null;
    }

    // Format currency (amount in minor units - cents)
    function formatCurrency(amountInCents, currency) {
        const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.eur;
        const majorAmount = (amountInCents / 100).toFixed(2);
        return config.position === 'before'
            ? `${config.symbol}${majorAmount}`
            : `${majorAmount}${config.symbol}`;
    }

    // Convert major units to minor units (euros to cents)
    function toMinorUnits(majorAmount) {
        return Math.round(majorAmount * 100);
    }

    // Convert minor units to major units (cents to euros)
    function toMajorUnits(minorAmount) {
        return minorAmount / 100;
    }

    // Show error state
    function showError(message) {
        loadingEl.classList.add('hidden');
        mainContentEl.classList.add('hidden');
        setupIncompleteEl.classList.add('hidden');
        errorMessageEl.textContent = message;
        errorEl.classList.remove('hidden');
    }

    // Show setup incomplete state
    function showSetupIncomplete() {
        loadingEl.classList.add('hidden');
        mainContentEl.classList.add('hidden');
        errorEl.classList.add('hidden');
        setupIncompleteEl.classList.remove('hidden');
    }

    // Show main content
    function showMainContent() {
        loadingEl.classList.add('hidden');
        errorEl.classList.add('hidden');
        setupIncompleteEl.classList.add('hidden');
        mainContentEl.classList.remove('hidden');
    }

    // Update send button state
    function updateSendButtonState() {
        if (selectedAmount && selectedAmount > 0) {
            sendTipBtn.disabled = false;
            sendTipBtn.textContent = `Send ${formatCurrency(selectedAmount, musician.currency)} Tip`;
        } else {
            sendTipBtn.disabled = true;
            sendTipBtn.textContent = 'Send Tip';
        }
    }

    // Create preset amount button
    function createPresetButton(amountInCents) {
        const button = document.createElement('button');
        button.className = 'amount-button';
        button.textContent = formatCurrency(amountInCents, musician.currency);
        button.dataset.amount = amountInCents;

        button.addEventListener('click', function() {
            // Deselect all buttons
            document.querySelectorAll('.amount-button').forEach(btn => {
                btn.classList.remove('amount-button-selected');
            });

            // Select this button
            button.classList.add('amount-button-selected');
            selectedAmount = amountInCents;
            isCustomAmount = false;

            // Clear custom input
            customAmountInputEl.value = '';

            updateSendButtonState();
        });

        return button;
    }

    // Render musician info
    function renderMusician() {
        // Set images
        bannerImageEl.src = musician.banner_image_url;
        bannerImageEl.alt = `${musician.display_name} banner`;
        profileImageEl.src = musician.profile_image_url;
        profileImageEl.alt = musician.display_name;

        // Set text
        musicianNameEl.textContent = musician.display_name;
        musicianDescriptionEl.textContent = musician.description;

        // Render preset amounts (already in minor units from database)
        presetAmountsEl.innerHTML = '';
        musician.preset_amounts.forEach(amountInCents => {
            const button = createPresetButton(amountInCents);
            presetAmountsEl.appendChild(button);
        });

        // Show/hide custom amount section
        if (!musician.custom_amount_enabled) {
            toggleCustomBtn.classList.add('hidden');
        }

        // Set custom amount placeholder and min
        if (musician.custom_amount_enabled) {
            const minMajor = toMajorUnits(musician.custom_amount_min);
            customAmountInputEl.min = minMajor;
            customAmountInputEl.placeholder = minMajor.toFixed(2);
        }
    }

    // Toggle custom amount input
    function toggleCustomAmount() {
        const isVisible = !customAmountSectionEl.classList.contains('hidden');

        if (isVisible) {
            // Hide custom amount
            customAmountSectionEl.classList.add('hidden');
            toggleCustomBtn.textContent = 'Enter Custom Amount';
            customAmountInputEl.value = '';
            selectedAmount = null;
            isCustomAmount = false;
        } else {
            // Show custom amount
            customAmountSectionEl.classList.remove('hidden');
            toggleCustomBtn.textContent = 'Select Preset Amount';

            // Deselect all preset buttons
            document.querySelectorAll('.amount-button').forEach(btn => {
                btn.classList.remove('amount-button-selected');
            });

            // Focus on input
            customAmountInputEl.focus();
            isCustomAmount = true;
        }

        updateSendButtonState();
    }

    // Handle custom amount input
    function handleCustomAmountInput() {
        const value = parseFloat(customAmountInputEl.value);

        if (isNaN(value) || value <= 0) {
            selectedAmount = null;
        } else {
            // Convert from major units (euros) to minor units (cents)
            selectedAmount = toMinorUnits(value);

            // Validate against musician limits
            if (selectedAmount < musician.custom_amount_min) {
                selectedAmount = null;
            } else if (selectedAmount > musician.custom_amount_max) {
                selectedAmount = musician.custom_amount_max;
            }
        }

        updateSendButtonState();
    }

    // Send tip (create checkout session)
    async function sendTip() {
        if (!selectedAmount || selectedAmount <= 0) {
            return;
        }

        // Disable button and show loading
        sendTipBtn.disabled = true;
        sendTipBtn.textContent = 'Processing...';
        paymentErrorEl.classList.add('hidden');

        try {
            const response = await fetch('/.netlify/functions/create-checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    musicianId: musician.id,
                    amount: selectedAmount, // Send amount in minor units (cents)
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create checkout session');
            }

            // Redirect to Stripe Checkout
            window.location.href = data.url;
        } catch (error) {
            console.error('Payment error:', error);
            paymentErrorMessageEl.textContent = error.message;
            paymentErrorEl.classList.remove('hidden');
            sendTipBtn.disabled = false;
            updateSendButtonState();
        }
    }

    // Load musician data from database API
    async function loadMusician() {
        const musicianId = getMusicianIdFromPath();

        if (!musicianId) {
            showError('Musician ID not found in URL');
            return;
        }

        try {
            const response = await fetch(`/.netlify/functions/get-musician?id=${encodeURIComponent(musicianId)}`);

            if (!response.ok) {
                if (response.status === 404) {
                    showError('Musician not found');
                } else {
                    showError('Failed to load musician information');
                }
                return;
            }

            const data = await response.json();
            musician = data;

            // Check if setup is complete
            if (!musician.setup_complete) {
                showSetupIncomplete();
                return;
            }

            // Render musician info
            renderMusician();
            showMainContent();

        } catch (error) {
            console.error('Error loading musician:', error);
            showError('Failed to load musician information. Please try again later.');
        }
    }

    // Initialize
    function init() {
        // Set up event listeners
        toggleCustomBtn.addEventListener('click', toggleCustomAmount);
        customAmountInputEl.addEventListener('input', handleCustomAmountInput);
        sendTipBtn.addEventListener('click', sendTip);

        // Load musician data
        loadMusician();
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
