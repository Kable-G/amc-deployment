/**
 * AutoMediaCenter Releases Real-Time Search System
 * Features: Real-time filtering across ALL releases, result count, clear button, ESC key support
 * Searches across ALL releases from API (not just current page)
 * Returns to main page when clearing search
 */

(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        debounceDelay: 300,        // Delay before search triggers (ms)
        minSearchLength: 1,         // Minimum characters to start search
        apiBaseUrl: 'http://localhost:5000',
        resultsPerPage: 24         // Same as normal pagination
    };
    
    // DOM Elements
    let searchInput;
    let searchButton;
    let clearButton;
    let releasesGrid;
    let paginationControls;
    let resultCount;
    let noResultsMessage;
    
    // State
    let searchTimeout;
    let isSearchActive = false;
    let originalGridContent = '';
    let originalPaginationContent = '';
    let allReleases = [];
    let filteredReleases = [];
    let currentSearchQuery = '';
    let currentSearchPage = 1;
    let searchHistoryAdded = false;
    
    /**
     * Initialize the search system (passive - doesn't interfere with normal page loading)
     */
    function init() {
        console.log('🔍 Initializing AutoMediaCenter Releases Search System...');
        
        // Wait for page to be fully loaded before initializing
        setTimeout(() => {
            // Get DOM elements
            searchInput = document.querySelector('.search-bar input[type="search"]');
            searchButton = document.querySelector('.search-bar button');
            releasesGrid = document.querySelector('.amc-card-grid');
            paginationControls = document.getElementById('pagination-controls');
            
            if (!searchInput || !releasesGrid) {
                console.warn('⚠️ Search elements not found. Skipping search initialization.');
                return;
            }
            
            // Create UI elements (but don't interfere with existing content)
            createClearButton();
            createResultCounter();
            createNoResultsMessage();
            
            // Bind events
            bindEvents();
            
            // Simple back button handling
            window.addEventListener('popstate', () => {
                if (isSearchActive) {
                    clearSearch();
                }
            });
            
            console.log('✅ AutoMediaCenter search initialized (passive mode)');
        }, 1000); // Wait 1 second for page to fully load
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
                <h3 style="color: #64748b; margin: 0 0 0.5rem 0;">No releases found</h3>
                <p style="color: #94a3b8; margin: 0;">Try adjusting your search terms</p>
            </div>
        `;
        
        // Insert in grid container
        releasesGrid.parentNode.insertBefore(noResultsMessage, releasesGrid);
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
        
        // If empty, return to main page immediately
        if (query.length === 0) {
            returnToMainPage();
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
     * Perform the actual search across ALL releases
     */
    async function performSearch(query) {
        if (!query || query.length < CONFIG.minSearchLength) {
            returnToMainPage();
            return;
        }
        
        console.log(`🔍 Searching ALL AutoMediaCenter releases for: "${query}"`);
        
        // Save original content if this is the first search
        if (!isSearchActive) {
            // Only save content if it's not a loading state
            const currentContent = releasesGrid.innerHTML;
            if (currentContent && !currentContent.includes('fa-spinner') && !currentContent.includes('Searching all releases')) {
                originalGridContent = currentContent;
                originalPaginationContent = paginationControls ? paginationControls.innerHTML : '';
                console.log('💾 Saved original content for restoration');
            } else {
                console.log('⚠️ Skipping save - content appears to be in loading state');
            }
            
            // Add ONE history entry for back button functionality - ONLY ONCE per session
            if (!searchHistoryAdded) {
                history.pushState({ searchMode: true }, '', '');
                searchHistoryAdded = true;
                console.log('📝 Added single history entry for back button');
            }
            
            isSearchActive = true;
        }
        
        // CRITICAL: Don't add more history entries for subsequent searches
        // This ensures back button always goes directly to main page
        
        // Show loading state
        releasesGrid.innerHTML = '<p style="text-align:center; padding: 40px;"><i class="fas fa-spinner fa-spin fa-2x"></i><br><br>Searching all releases...</p>';
        if (paginationControls) paginationControls.innerHTML = '';
        
        try {
            // Fetch ALL releases from API (ONLY during search)
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            // Fetch all releases (use a high limit to get everything for search)
            const response = await fetch(`${CONFIG.apiBaseUrl}/api/v1/center/releases?limit=1000&page=1`, {
                method: 'GET',
                headers: headers
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const responseData = await response.json();
            
            if (responseData.success && responseData.data && Array.isArray(responseData.data.releases)) {
                allReleases = responseData.data.releases;
                
                // Filter releases based on search query
                const searchTerm = query.toLowerCase().trim();
                filteredReleases = allReleases.filter(release => releaseMatchesSearch(release, searchTerm));
                
                // Sort by release date (latest first)
                filteredReleases.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
                
                // Store current search query and reset to page 1
                currentSearchQuery = query;
                currentSearchPage = 1;
                
                // Display results with pagination
                displaySearchResults(filteredReleases, query, 1);
                
            } else {
                throw new Error('Failed to fetch releases');
            }
            
        } catch (error) {
            console.error('Search error:', error);
            releasesGrid.innerHTML = `<p style="text-align:center; padding: 40px; color: var(--color-danger);">Search failed: ${error.message}</p>`;
        }
    }
    
    /**
     * Normalize text for language-aware searching
     * Handles German umlauts and other European characters
     */
    function normalizeText(text) {
        if (!text) return '';
        
        return text
            .toLowerCase()
            // German umlauts and ß - bidirectional mapping
            .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
            .replace(/ß/g, 'ss')
            // French accents
            .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
            .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o')
            .replace(/[ùúûü]/g, 'u').replace(/[ýÿ]/g, 'y')
            .replace(/ç/g, 'c').replace(/ñ/g, 'n')
            // Remove diacritics and normalize
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    
    /**
     * Check if text matches search term with language normalization
     * Handles German umlauts bidirectionally (ü ↔ ue, ö ↔ oe, ä ↔ ae)
     */
    function textMatches(text, searchTerm) {
        if (!text || !searchTerm) return false;
        
        const lowerText = text.toLowerCase();
        const lowerSearch = searchTerm.toLowerCase();
        
        // Direct match first (fastest)
        if (lowerText.includes(lowerSearch)) {
            return true;
        }
        
        // German character normalization - both directions
        const normalizedText = normalizeText(text);
        const normalizedSearch = normalizeText(searchTerm);
        
        // Check normalized versions
        if (normalizedText.includes(normalizedSearch)) {
            return true;
        }
        
        // Check umlauts to ae/oe/ue conversion
        const textWithUmlauts = lowerText.replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü').replace(/ss/g, 'ß');
        if (textWithUmlauts.includes(lowerSearch)) {
            return true;
        }
        
        // Check ae/oe/ue to umlauts conversion
        const searchWithUmlauts = lowerSearch.replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü').replace(/ss/g, 'ß');
        if (lowerText.includes(searchWithUmlauts)) {
            return true;
        }
        
        return false;
    }

    /**
     * Check if release matches search term (supports multi-word search)
     */
    function releaseMatchesSearch(release, searchTerm) {
        // Handle multi-word search - split by spaces and check if ALL words match
        const searchWords = searchTerm.trim().split(/\s+/).filter(word => word.length > 0);
        
        // If no valid words, return false
        if (searchWords.length === 0) return false;
        
        // For single word, use existing logic
        if (searchWords.length === 1) {
            return releaseMatchesSingleTerm(release, searchWords[0]);
        }
        
        // For multi-word search, ALL words must match somewhere in the release
        return searchWords.every(word => releaseMatchesSingleTerm(release, word));
    }
    
    /**
     * Check if release matches a single search term
     */
    function releaseMatchesSingleTerm(release, searchTerm) {
        // Combine all searchable text into one string for multi-word matching
        const searchableText = [
            release.title || '',
            release.brand || '',
            release.summary || '',
            // Add release date as searchable text
            release.releaseDate ? new Date(release.releaseDate).toLocaleDateString('en-GB') : '',
            // Add asset types as searchable text
            ...(release.releaseDocs && release.releaseDocs.length > 0 ? ['press release', 'document'] : []),
            ...(release.images && release.images.length > 0 ? ['image', 'photo'] : []),
            ...(release.videos && release.videos.length > 0 ? ['video'] : []),
            ...(release.supplementaryDocs && release.supplementaryDocs.length > 0 ? ['document', 'supplementary'] : [])
        ].join(' ');
        
        // Check if the single term matches anywhere in the combined text
        return textMatches(searchableText, searchTerm);
    }
    
    /**
     * Display search results with pagination
     */
    function displaySearchResults(results, query, page = 1) {
        currentSearchPage = page;
        
        updateResultCount(results.length, query, page);
        
        if (results.length === 0) {
            updateNoResultsMessage(0);
            return;
        }
        
        // Hide no results message
        updateNoResultsMessage(results.length);
        
        // Calculate pagination
        const totalResults = results.length;
        const totalPages = Math.ceil(totalResults / CONFIG.resultsPerPage);
        const startIndex = (page - 1) * CONFIG.resultsPerPage;
        const endIndex = startIndex + CONFIG.resultsPerPage;
        const pageResults = results.slice(startIndex, endIndex);
        
        // Generate HTML for current page results
        let cardsHtml = '';
        
        pageResults.forEach(release => {
            const releaseDateObj = new Date(release.releaseDate);
            
            let teaserPathForCart = null;
            let teaserImageContent = '<i class="fas fa-photo-video placeholder-icon"></i>';
            if (release.cardTeaserImagePath) {
                teaserPathForCart = release.cardTeaserImagePath;
                const imageUrl = `${CONFIG.apiBaseUrl}${release.cardTeaserImagePath}`;
                teaserImageContent = `<img src="${imageUrl}" alt="${release.title || 'Release Teaser'}">`;
            } else if (release.images && release.images.length > 0 && release.images[0].path) {
                teaserPathForCart = release.images[0].path;
                const imageUrl = `${CONFIG.apiBaseUrl}${release.images[0].path}`;
                teaserImageContent = `<img src="${imageUrl}" alt="${release.title || 'Release Teaser'}">`;
            } else if (release.videos && release.videos.length > 0) {
                if (release.videos[0].thumbPath) {
                    teaserPathForCart = release.videos[0].thumbPath;
                    const thumbnailUrl = `${CONFIG.apiBaseUrl}${release.videos[0].thumbPath}`;
                    teaserImageContent = `<img src="${thumbnailUrl}" alt="${release.title || 'Video Thumbnail'}">`;
                } else {
                    teaserImageContent = '<div class="video-placeholder-enhanced"><i class="fas fa-play-circle"></i><span>Click to Play Video</span></div>';
                }
            }
            
            const fullReleasePageUrl = `amc-release-detail.html?uuid=${release.uuid}`;
            const releaseTitle = release.title || 'Untitled Release';
            const brandName = release.brand || 'N/A';
            
            // Check if in cart (reuse existing cart manager)
            const isInCart = window.cartManager ? window.cartManager.isInCart(release.uuid) : false;
            const cartButtonText = isInCart ? '<i class="fas fa-check"></i> In Cart' : '<i class="fas fa-cart-plus"></i> Add to Cart';
            const cartButtonInitialClass = isInCart ? 'in-cart-style' : '';
            const cartButtonTitle = isInCart ? "Remove from Cart" : "Add to Cart";
            
            // Generate asset icons (reuse existing function)
            const generateAssetIconHtml = (assetArray, iconClass, title) => {
                const count = assetArray && assetArray.length > 0 ? assetArray.length : 0;
                const isAvailable = count > 0;
                return `
                    <span class="asset-icon ${isAvailable ? 'available' : 'unavailable'}" title="${title}${isAvailable ? ` (${count})` : ''}">
                        <i class="fas fa-${iconClass}"></i> 
                        ${isAvailable ? `<span class="asset-count-badge">${count}</span>` : ''}
                    </span>
                `;
            };
            
            // Dynamic timezone function (reuse existing)
            const getDynamicTimezone = (dateObj) => {
                if (!dateObj || !(dateObj instanceof Date)) return 'CET';
                const year = dateObj.getFullYear();
                const marchLastSunday = new Date(year, 2, 31);
                marchLastSunday.setDate(31 - marchLastSunday.getDay());
                const octoberLastSunday = new Date(year, 9, 31);
                octoberLastSunday.setDate(31 - octoberLastSunday.getDay());
                return (dateObj >= marchLastSunday && dateObj < octoberLastSunday) ? 'CEST' : 'CET';
            };
            
            const cardHtml = `
                <article class="media-card" data-uuid="${release.uuid}" data-release-db-id="${release._id}" 
                         data-title="${encodeURIComponent(releaseTitle)}" 
                         data-brand="${encodeURIComponent(brandName)}"
                         data-teaser-path="${teaserPathForCart || ''}">
                    <div class="card-image-field">
                        ${teaserImageContent}
                        <div class="card-image-hover-buttons-overlay">
                            <button class="btn btn-primary amc-quick-view-trigger" data-uuid="${release.uuid}">
                                <i class="fas fa-eye"></i> Quick View
                            </button>
                            <button class="btn add-to-cart-btn ${cartButtonInitialClass}" data-uuid="${release.uuid}" title="${cartButtonTitle}">
                                ${cartButtonText}
                            </button>
                            <button class="btn btn-light download-all-btn" data-uuid="${release.uuid}" title="Download All Assets for this Release">
                                <i class="fas fa-download"></i> Download All
                            </button>
                        </div>
                    </div>
                    <div class="brand-band" title="${brandName}">
                        ${brandName}
                    </div>
                    <div class="card-content-body">
                        <h3><a href="${fullReleasePageUrl}" title="View full release: ${releaseTitle}">${releaseTitle}</a></h3>
                        <div class="card-bottom-meta">
                            <div class="card-assets">
                                ${generateAssetIconHtml(release.releaseDocs, 'file-alt', 'Press Release')}
                                ${generateAssetIconHtml(release.images, 'image', 'Images')}
                                ${generateAssetIconHtml(release.videos, 'video', 'Videos')}
                                ${generateAssetIconHtml(release.supplementaryDocs, 'folder', 'Other Docs')}
                            </div>
                            <div class="release-date-time-footer">
                                <span class="date-part"><i class="far fa-calendar-alt"></i>
                                ${releaseDateObj.toLocaleDateString('en-GB', {day:'numeric', month:'short', year: 'numeric'})}</span>
                                ${release.releaseTime ? `<span class="time-part">${release.releaseTime.substring(0,5)} ${getDynamicTimezone(releaseDateObj)}</span>` : ''}
                            </div>
                        </div>
                    </div>
                </article>
            `;
            cardsHtml += cardHtml;
        });
        
        // CRITICAL FIX: Add invisible spacer when there are few results to maintain page height
        if (pageResults.length < 12) { // Less than half a full page of results
            // Add invisible spacer div to maintain consistent page height
            cardsHtml += '<div style="height: 800px; width: 100%; grid-column: 1 / -1;"></div>';
        }
        
        releasesGrid.innerHTML = cardsHtml;
        
        // Generate search pagination controls
        renderSearchPagination(totalResults, totalPages, page, query);
        
        // Re-attach event listeners for the new cards
        if (window.attachAmcActionListeners) window.attachAmcActionListeners();
        if (window.attachAmcQuickViewListeners) window.attachAmcQuickViewListeners();
        
        console.log(`✅ Displayed ${pageResults.length} of ${totalResults} search results for "${query}" (page ${page}/${totalPages})`);
    }
    
    /**
     * Render pagination controls for search results
     */
    function renderSearchPagination(totalResults, totalPages, currentPage, query) {
        if (!paginationControls || totalPages <= 1) {
            if (paginationControls) paginationControls.innerHTML = '';
            return;
        }
        
        let paginationHtml = '';
        
        // Previous button
        paginationHtml += `<button class="btn btn-light search-page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">« Prev</button>`;
        
        // Page numbers
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, currentPage + 2);
        
        // Show first page if we're far from it
        if (currentPage > 3 && totalPages > 5) {
            paginationHtml += `<button class="btn btn-light search-page-btn" data-page="1">1</button>`;
            if (currentPage > 4) paginationHtml += `<button class="btn btn-light" disabled>...</button>`;
        }
        
        // Page number buttons
        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `<button class="btn btn-light search-page-btn ${i === currentPage ? 'current' : ''}" data-page="${i}">${i}</button>`;
        }
        
        // Show last page if we're far from it
        if (currentPage < totalPages - 2 && totalPages > 5) {
            if (currentPage < totalPages - 3) paginationHtml += `<button class="btn btn-light" disabled>...</button>`;
            paginationHtml += `<button class="btn btn-light search-page-btn" data-page="${totalPages}">${totalPages}</button>`;
        }
        
        // Next button
        paginationHtml += `<button class="btn btn-light search-page-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">Next »</button>`;
        
        paginationControls.innerHTML = paginationHtml;
        
        // Attach event listeners to search pagination buttons
        paginationControls.querySelectorAll('.search-page-btn').forEach(button => {
            if (!button.disabled) {
                button.addEventListener('click', (e) => {
                    const page = parseInt(e.currentTarget.dataset.page);
                    displaySearchResults(filteredReleases, currentSearchQuery, page);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
            }
        });
    }
    
    /**
     * Return to main page (restore original content and pagination)
     */
    function returnToMainPage() {
        if (!isSearchActive) return;
        
        console.log('🔄 Returning to main page with original pagination');
        
        // Clear any pending search timeouts
        clearTimeout(searchTimeout);
        
        // Hide search UI elements immediately
        if (resultCount) resultCount.style.display = 'none';
        if (noResultsMessage) noResultsMessage.style.display = 'none';
        
        // Reset search state
        currentSearchQuery = '';
        currentSearchPage = 1;
        filteredReleases = [];
        allReleases = [];
        
        // If we don't have saved content or it's empty, reload the page
        if (!originalGridContent || originalGridContent.trim() === '' || originalGridContent.includes('fa-spinner')) {
            console.log('🔄 No valid saved content - reloading page to restore pagination');
            isSearchActive = false;
            window.location.reload();
            return;
        }
        
        // Restore original content
        releasesGrid.innerHTML = originalGridContent;
        if (paginationControls && originalPaginationContent) {
            paginationControls.innerHTML = originalPaginationContent;
        }
        
        // Reset state - but DON'T reset searchHistoryAdded to prevent multiple history entries
        isSearchActive = false;
        // searchHistoryAdded = false; // REMOVED: Keep this true to prevent multiple history entries
        originalGridContent = '';
        originalPaginationContent = '';
        
        // Ensure grid is visible
        if (releasesGrid) releasesGrid.style.display = 'grid';
        
        // Re-attach event listeners for the restored cards
        setTimeout(() => {
            if (window.attachAmcActionListeners) window.attachAmcActionListeners();
            if (window.attachAmcQuickViewListeners) window.attachAmcQuickViewListeners();
            
            // Re-attach pagination event listeners
            if (paginationControls && paginationControls.innerHTML.trim() !== '') {
                const paginationButtons = paginationControls.querySelectorAll('button[data-page]');
                paginationButtons.forEach(button => {
                    if (!button.disabled && !button.hasAttribute('data-listener-attached')) {
                        button.addEventListener('click', (e) => {
                            const page = parseInt(e.currentTarget.dataset.page);
                            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
                            if (window.fetchAndDisplayAmcReleases) {
                                window.fetchAndDisplayAmcReleases(token, page);
                            }
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        });
                        button.setAttribute('data-listener-attached', 'true');
                    }
                });
            }
        }, 100);
        
        console.log('✅ Successfully returned to main page');
    }
    
    /**
     * Clear search and return to main page
     */
    function clearSearch() {
        console.log('🔍 Clearing AutoMediaCenter search...');
        
        // Clear input and hide clear button
        searchInput.value = '';
        if (clearButton) clearButton.style.display = 'none';
        
        // Clear any pending timeouts
        clearTimeout(searchTimeout);
        
        // Return to main page
        returnToMainPage();
        
        // Focus search input
        setTimeout(() => {
            if (searchInput) searchInput.focus();
        }, 100);
        
        console.log('✅ AutoMediaCenter search cleared - returned to main page');
    }
    
    /**
     * Update result count display with pagination info
     */
    function updateResultCount(totalCount, query, currentPage = 1) {
        if (totalCount === 0) {
            resultCount.style.display = 'none';
        } else {
            resultCount.style.display = 'block';
            const totalPages = Math.ceil(totalCount / CONFIG.resultsPerPage);
            const startResult = ((currentPage - 1) * CONFIG.resultsPerPage) + 1;
            const endResult = Math.min(currentPage * CONFIG.resultsPerPage, totalCount);
            
            if (totalPages > 1) {
                resultCount.textContent = `Found ${totalCount} release${totalCount !== 1 ? 's' : ''} matching "${query}" (showing ${startResult}-${endResult}, page ${currentPage} of ${totalPages})`;
            } else {
                resultCount.textContent = `Found ${totalCount} release${totalCount !== 1 ? 's' : ''} matching "${query}"`;
            }
        }
    }
    
    /**
     * Update "no results" message
     */
    function updateNoResultsMessage(count) {
        if (count === 0) {
            noResultsMessage.style.display = 'flex';
            releasesGrid.style.display = 'none';
        } else {
            noResultsMessage.style.display = 'none';
            releasesGrid.style.display = 'grid';
        }
    }
    
    /**
     * Public API
     */
    window.AMCReleasesSearch = {
        init,
        search: performSearch,
        clear: clearSearch,
        returnToMainPage,
        getFilteredCount: () => filteredReleases.length,
        getAllCount: () => allReleases.length
    };
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();