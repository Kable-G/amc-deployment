/**
 * Media Alerts Real-Time Search System
 * Features: Real-time filtering, result count, clear button, ESC key support
 */

(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        debounceDelay: 300,        // Delay before search triggers (ms)
        minSearchLength: 1,         // Minimum characters to start search
        searchFields: [             // What to search in each card
            '.radar-card h3',              // Card title
            '.radar-card h4',              // Alternative title
            '.radar-card .company-name',   // Company name
            '.radar-card .event-type',     // Event type
            '.radar-card .event-date',     // Event date
            '.radar-card .release-date',   // Release date
            '.radar-card .date-info',      // Date info
            '.radar-card .embargo-date',   // Embargo date
            '.radar-card time',            // HTML5 time elements
            '.radar-card [datetime]'       // Elements with datetime attribute
        ]
    };
    
    // DOM Elements
    let searchInput;
    let searchButton;
    let clearButton;
    let radarGrid;
    let allCards;
    let resultCount;
    let noResultsMessage;
    
    // State
    let searchTimeout;
    let totalCards = 0;
    let visibleCards = 0;
    
    /**
     * Initialize the search system
     */
    function init() {
        console.log('🔍 Initializing Media Alerts Search System...');
        
        // Get DOM elements
        searchInput = document.querySelector('.search-bar input[type="search"]');
        searchButton = document.querySelector('.search-bar button');
        radarGrid = document.querySelector('.radar-grid');
        
        if (!searchInput || !radarGrid) {
            console.warn('⚠️ Search elements not found. Skipping search initialization.');
            return;
        }
        
        // Create UI elements
        createClearButton();
        createResultCounter();
        createNoResultsMessage();
        
        // Bind events
        bindEvents();
        
        // WAIT for cards to load, then get them
        setTimeout(() => {
            refreshCardList();
            console.log(`✅ Search initialized with ${totalCards} alerts`);
        }, 500);
    }
    
    /**
     * Refresh the card list (for dynamically loaded content)
     */
    function refreshCardList() {
        allCards = Array.from(radarGrid.querySelectorAll('.radar-card'));
        totalCards = allCards.length;
        visibleCards = totalCards;
    }
    
    /**
     * Create clear button (X icon)
     */
    function createClearButton() {
        clearButton = document.createElement('button');
        clearButton.className = 'search-clear-btn';
        clearButton.innerHTML = '<i class="fas fa-times"></i>';
        clearButton.title = 'Clear search';
        clearButton.style.display = 'none';
        
        // Insert after search input
        searchInput.parentNode.insertBefore(clearButton, searchButton);
        
        clearButton.addEventListener('click', clearSearch);
    }
    
    /**
     * Create result counter
     */
    function createResultCounter() {
        resultCount = document.createElement('div');
        resultCount.className = 'search-result-count';
        resultCount.style.display = 'none';
        
        // Insert after search bar
        const searchBar = searchInput.closest('.search-bar');
        searchBar.parentNode.insertBefore(resultCount, searchBar.nextSibling);
    }
    
    /**
     * Create "no results" message
     */
    function createNoResultsMessage() {
        noResultsMessage = document.createElement('div');
        noResultsMessage.className = 'search-no-results';
        noResultsMessage.style.display = 'none';
        noResultsMessage.innerHTML = `
            <div class="no-results-content">
                <i class="fas fa-search" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                <h3 style="color: #64748b; margin: 0 0 0.5rem 0;">No alerts found</h3>
                <p style="color: #94a3b8; margin: 0;">Try adjusting your search terms</p>
            </div>
        `;
        
        // Insert in grid container
        radarGrid.parentNode.insertBefore(noResultsMessage, radarGrid);
    }
    
    /**
     * Bind event listeners
     */
    function bindEvents() {
        // Real-time search on input
        searchInput.addEventListener('input', handleSearchInput);
        
        // Enter key submits search (instant, no delay)
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(searchTimeout);
                performSearch(searchInput.value);
            }
            
            // ESC key clears search
            if (e.key === 'Escape') {
                clearSearch();
            }
        });
        
        // Search button click
        if (searchButton) {
            searchButton.addEventListener('click', (e) => {
                e.preventDefault();
                performSearch(searchInput.value);
            });
        }
    }
    
    /**
     * Handle search input with debouncing
     */
    function handleSearchInput(e) {
        const query = e.target.value;
        
        // Show/hide clear button
        clearButton.style.display = query.length > 0 ? 'block' : 'none';
        
        // Clear previous timeout
        clearTimeout(searchTimeout);
        
        // If empty, show all cards immediately
        if (query.length === 0) {
            showAllCards();
            return;
        }
        
        // If too short, don't search yet
        if (query.length < CONFIG.minSearchLength) {
            return;
        }
        
        // Debounced search
        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, CONFIG.debounceDelay);
    }
    
    /**
     * Perform the actual search
     */
    function performSearch(query) {
        if (!query || query.length < CONFIG.minSearchLength) {
            showAllCards();
            return;
        }
        
        console.log(`🔍 Searching for: "${query}"`);
        
        const searchTerm = query.toLowerCase().trim();
        let matchedCards = 0;
        
        // Filter each card
        allCards.forEach(card => {
            const isMatch = cardMatchesSearch(card, searchTerm);
            
            if (isMatch) {
                card.classList.remove('search-hidden');
                card.classList.add('search-visible');
                matchedCards++;
            } else {
                card.classList.add('search-hidden');
                card.classList.remove('search-visible');
            }
        });
        
        visibleCards = matchedCards;
        
        // Update UI
        updateResultCount(matchedCards);
        updateNoResultsMessage(matchedCards);
        
        console.log(`✅ Found ${matchedCards} of ${totalCards} alerts`);
    }
    
    /**
     * Check if card matches search term
     */
    function cardMatchesSearch(card, searchTerm) {
        // Search in all configured fields
        for (const selector of CONFIG.searchFields) {
            const element = card.querySelector(selector);
            if (element) {
                const text = element.textContent.toLowerCase();
                if (text.includes(searchTerm)) {
                    return true;
                }
            }
        }
        
        // Also search in status badges
        const badges = card.querySelectorAll('.status-badge, .countdown-badge');
        for (const badge of badges) {
            if (badge.textContent.toLowerCase().includes(searchTerm)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Show all cards (clear search)
     */
    function showAllCards() {
        allCards.forEach(card => {
            card.classList.remove('search-hidden');
            card.classList.add('search-visible');
        });
        
        visibleCards = totalCards;
        
        // Hide UI elements
        resultCount.style.display = 'none';
        noResultsMessage.style.display = 'none';
        radarGrid.style.display = 'grid';
    }
    
    /**
     * Clear search
     */
    function clearSearch() {
        searchInput.value = '';
        clearButton.style.display = 'none';
        showAllCards();
        searchInput.focus();
        
        console.log('🔍 Search cleared');
    }
    
    /**
     * Update result count display
     */
    function updateResultCount(count) {
        if (count === totalCards) {
            resultCount.style.display = 'none';
        } else {
            resultCount.style.display = 'block';
            resultCount.textContent = `Showing ${count} of ${totalCards} alert${totalCards !== 1 ? 's' : ''}`;
        }
    }
    
    /**
     * Update "no results" message
     */
    function updateNoResultsMessage(count) {
        if (count === 0) {
            noResultsMessage.style.display = 'flex';
            radarGrid.style.display = 'none';
        } else {
            noResultsMessage.style.display = 'none';
            radarGrid.style.display = 'grid';
        }
    }
    
    /**
     * Public API
     */
    window.MediaAlertsSearch = {
        init,
        search: performSearch,
        clear: clearSearch,
        getVisibleCount: () => visibleCards,
        getTotalCount: () => totalCards
    };
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();