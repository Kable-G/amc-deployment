/**
 * AutoMediaCenter Content Filtering System
 * Filters releases based on user preferences from content-settings.html
 */

(function() {
    'use strict';
    
    console.log('🔧 Content Filtering System Loading...');
    
    function loadContentPreferences() {
        try {
            var stored = localStorage.getItem('amc_content_preferences');
            if (stored) {
                var prefs = JSON.parse(stored);
                console.log('📋 Loaded content preferences:', prefs);
                return prefs;
            }
        } catch (e) {
            console.error('Error loading content preferences:', e);
        }
        return null;
    }
    
    function mapCompaniesToBrands(companies) {
        if (!companies || companies.length === 0) return [];
        if (typeof window.BRAND_HIERARCHY_ARRAY === 'undefined') {
            console.warn('BRAND_HIERARCHY_ARRAY not loaded');
            return [];
        }
        
        var brands = [];
        companies.forEach(function(companyName) {
            var company = window.BRAND_HIERARCHY_ARRAY.find(function(c) {
                return c.company === companyName;
            });
            if (company && company.brands) {
                brands.push.apply(brands, company.brands);
            }
        });
        
        console.log('📊 Mapped companies to brands:', companies, '→', brands);
        return brands;
    }
    
    function matchesBrandPreferences(release, prefs) {
        if (prefs.brandMode === 'all') return true;
        
        var selectedCompanyBrands = mapCompaniesToBrands(prefs.selectedCompanies || []);
        var selectedIndividualBrands = prefs.selectedBrands || [];
        var allAllowedBrands = selectedCompanyBrands.concat(selectedIndividualBrands);
        
        if (allAllowedBrands.length === 0) return false;
        
        // Smart matching: check if release brand contains any allowed brand OR vice versa
        // This catches: "Lamborghini" matches "Automobili Lamborghini", "BMW" matches "BMW M", etc.
        var releaseBrandLower = (release.brand || '').toLowerCase().trim();
        
        var matches = allAllowedBrands.some(function(allowedBrand) {
            var allowedBrandLower = allowedBrand.toLowerCase().trim();
            
            // Exact match (fastest check first)
            if (releaseBrandLower === allowedBrandLower) return true;
            
            // Partial match: release contains allowed brand (e.g., "Automobili Lamborghini" contains "Lamborghini")
            if (releaseBrandLower.includes(allowedBrandLower)) return true;
            
            // Reverse match: allowed brand contains release (e.g., "Lamborghini" selected, matches "Lamborghini")
            if (allowedBrandLower.includes(releaseBrandLower)) return true;
            
            return false;
        });
        
        if (!matches) {
            console.log('❌ Brand mismatch:', release.brand, 'not matching any of', allAllowedBrands);
        }
        
        return matches;
    }
    
    function matchesCategoryPreferences(release, prefs) {
        if (!prefs.categories || prefs.categories.length === 0) return true;
        if (!release.categories || release.categories.length === 0) return false;
        
        return release.categories.some(function(cat) {
            return prefs.categories.indexOf(cat) !== -1;
        });
    }
    
    function matchesContentTypePreferences(release, prefs) {
        if (!prefs.contentTypes || prefs.contentTypes.length === 0) return true;
        
        for (var i = 0; i < prefs.contentTypes.length; i++) {
            var type = prefs.contentTypes[i];
            if (type === 'Press Release' && release.releaseDocs && release.releaseDocs.length > 0) return true;
            if (type === 'Images' && release.images && release.images.length > 0) return true;
            if (type === 'Videos' && release.videos && release.videos.length > 0) return true;
            if (type === 'Documents' && release.supplementaryDocs && release.supplementaryDocs.length > 0) return true;
        }
        return false;
    }
    
    function matchesLanguagePreferences(release, prefs) {
        if (!prefs.languages || prefs.languages.length === 0) return true;
        if (!release.primaryLanguage) return false;
        return prefs.languages.indexOf(release.primaryLanguage) !== -1;
    }
    
    function matchesMarketPreferences(release, prefs) {
        if (!prefs.markets || prefs.markets.length === 0) return true;
        if (!release.markets || release.markets.length === 0) return false;
        
        return release.markets.some(function(market) {
            return prefs.markets.indexOf(market) !== -1;
        });
    }
    
    function matchesRecencyPreferences(release, prefs) {
        if (!prefs.recency || prefs.recency === 'all') return true;
        
        var releaseDate = new Date(release.releaseDate);
        var now = new Date();
        var diffTime = Math.abs(now - releaseDate);
        var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        switch (prefs.recency) {
            case '24h': return diffDays <= 1;
            case '7d': return diffDays <= 7;
            case '30d': return diffDays <= 30;
            case '3m': return diffDays <= 90;
            case '6m': return diffDays <= 180;
            case '1y': return diffDays <= 365;
            default: return true;
        }
    }
    
    function matchesUserPreferences(release, prefs) {
        if (!prefs) return true;
        
        return matchesBrandPreferences(release, prefs) &&
               matchesCategoryPreferences(release, prefs) &&
               matchesContentTypePreferences(release, prefs) &&
               matchesLanguagePreferences(release, prefs) &&
               matchesMarketPreferences(release, prefs) &&
               matchesRecencyPreferences(release, prefs);
    }
    
    window.applyContentPreferencesFilter = function(releases) {
        var prefs = loadContentPreferences();
        
        if (!prefs) {
            console.log('📋 No content preferences, showing all releases');
            return releases;
        }
        
        var filtered = releases.filter(function(release) {
            return matchesUserPreferences(release, prefs);
        });
        
        console.log('📋 Content filtering: ' + releases.length + ' total → ' + filtered.length + ' after filtering');
        
        return filtered;
    };
    
    window.loadContentPreferences = loadContentPreferences;
    window.matchesUserPreferences = matchesUserPreferences;
    
    console.log('✅ Content Filtering System Ready');
})();