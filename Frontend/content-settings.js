// Content Settings State
const contentSettings = {
    brandMode: 'all',
    selectedCompanies: [],  // Company names like "BMW Group", "Volkswagen Group"
    selectedBrands: [],     // Individual brand names like "BMW", "Audi"
    categories: [],
    contentTypes: [],
    recency: 'all',
    languages: [],
    markets: [],
    timezoneMode: 'auto',   // 'auto' or 'manual'
    timezone: null,         // null = auto-detect, or specific timezone string
    expandedGroups: new Set(),
    searchQuery: ''
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    populateAllTimezones();
    detectAndDisplayTimezone();
    loadSettings();
    initializeBrandList();
    attachEventListeners();
    updateAllStatusChips();
});

// ============================================
// TIMEZONE DETECTION
// ============================================
function getAllTimezones() {
    try {
        if (Intl && typeof Intl.supportedValuesOf === 'function') {
            return Intl.supportedValuesOf('timeZone') || [];
        }
    } catch (e) {
        console.error('Browser does not support Intl.supportedValuesOf:', e);
    }
    // Fallback list if browser doesn't support it
    return [
        'Africa/Abidjan', 'Africa/Accra', 'Africa/Addis_Ababa', 'Africa/Algiers', 'Africa/Cairo',
        'Africa/Casablanca', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi',
        'America/Anchorage', 'America/Buenos_Aires', 'America/Caracas', 'America/Chicago',
        'America/Denver', 'America/Los_Angeles', 'America/Mexico_City', 'America/New_York',
        'America/Sao_Paulo', 'America/Toronto', 'America/Vancouver',
        'Asia/Baghdad', 'Asia/Bangkok', 'Asia/Dubai', 'Asia/Hong_Kong', 'Asia/Jakarta',
        'Asia/Jerusalem', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Manila', 'Asia/Seoul',
        'Asia/Shanghai', 'Asia/Singapore', 'Asia/Taipei', 'Asia/Tokyo',
        'Atlantic/Reykjavik', 'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Perth',
        'Australia/Sydney', 'Europe/Amsterdam', 'Europe/Athens', 'Europe/Berlin',
        'Europe/Brussels', 'Europe/Bucharest', 'Europe/Copenhagen', 'Europe/Dublin',
        'Europe/Helsinki', 'Europe/Istanbul', 'Europe/Lisbon', 'Europe/London',
        'Europe/Madrid', 'Europe/Moscow', 'Europe/Oslo', 'Europe/Paris', 'Europe/Prague',
        'Europe/Rome', 'Europe/Stockholm', 'Europe/Vienna', 'Europe/Warsaw', 'Europe/Zurich',
        'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Guam', 'Pacific/Honolulu',
        'UTC'
    ];
}

function populateAllTimezones() {
    const allGroup = document.getElementById('allTimezonesGroup');
    if (!allGroup) return;
    
    const zones = getAllTimezones();
    allGroup.innerHTML = ''; // Clear existing
    
    zones.forEach(tz => {
        const opt = document.createElement('option');
        opt.value = tz;
        
        // Calculate UTC offset for this timezone
        const offset = getUTCOffset(tz);
        opt.textContent = `${tz} (UTC${offset})`;
        
        allGroup.appendChild(opt);
    });
}

function getUTCOffset(timeZone) {
    try {
        const now = new Date();
        const tzDate = new Date(now.toLocaleString('en-US', { timeZone }));
        const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
        const offsetMinutes = (tzDate - utcDate) / 60000;
        const offsetHours = offsetMinutes / 60;
        
        if (offsetHours === 0) return '±0';
        
        const hours = Math.floor(Math.abs(offsetHours));
        const minutes = Math.abs(offsetMinutes % 60);
        const sign = offsetHours > 0 ? '+' : '-';
        
        if (minutes === 0) {
            return `${sign}${hours}`;
        } else {
            return `${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
        }
    } catch (e) {
        return '';
    }
}

function detectAndDisplayTimezone() {
    try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const detectedEl = document.getElementById('detectedTimezone');
        if (detectedEl) {
            detectedEl.textContent = detected || 'Unknown';
        }
        
        // Set as default if no timezone saved
        if (!contentSettings.timezone) {
            contentSettings.timezone = detected;
        }
        
        // Update live time display
        updateLiveTime();
    } catch (e) {
        console.error('Failed to detect timezone:', e);
        const detectedEl = document.getElementById('detectedTimezone');
        if (detectedEl) {
            detectedEl.textContent = 'Could not detect';
        }
    }
}

function updateLiveTime() {
    const liveTimeEl = document.getElementById('liveTime');
    const manualLiveTimeEl = document.getElementById('manualLiveTime');
    const selectedTimezoneNameEl = document.getElementById('selectedTimezoneName');
    
    try {
        const now = new Date();
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Update browser timezone display
        if (liveTimeEl) {
            const dateStr = now.toLocaleDateString('en-GB', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric',
                timeZone: detected
            });
            
            const timeStr = now.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZone: detected
            });
            
            liveTimeEl.textContent = `${dateStr}, ${timeStr}`;
        }
        
        // Update manual timezone display if active
        const timezoneSelect = document.getElementById('timezoneSelect');
        if (manualLiveTimeEl && timezoneSelect && timezoneSelect.value) {
            const selectedTz = timezoneSelect.value;
            
            const dateStr = now.toLocaleDateString('en-GB', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric',
                timeZone: selectedTz
            });
            
            const timeStr = now.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZone: selectedTz
            });
            
            manualLiveTimeEl.textContent = `${dateStr}, ${timeStr}`;
            
            if (selectedTimezoneNameEl) {
                selectedTimezoneNameEl.textContent = selectedTz;
            }
        }
    } catch (e) {
        console.error('Failed to update live time:', e);
    }
}

// Update live time every second
setInterval(updateLiveTime, 1000);

// ============================================
// LOAD/SAVE SETTINGS
// ============================================
function loadSettings() {
    try {
        const stored = localStorage.getItem('amc_content_preferences');
        if (stored) {
            const loaded = JSON.parse(stored);
            Object.assign(contentSettings, loaded);
            
            // Fix: expandedGroups needs to be a Set, not an array
            if (Array.isArray(contentSettings.expandedGroups)) {
                contentSettings.expandedGroups = new Set(contentSettings.expandedGroups);
            } else if (!contentSettings.expandedGroups) {
                contentSettings.expandedGroups = new Set();
            }
            
            // Restore UI state
            restoreUIFromSettings();
        }
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
}

function saveSettings() {
    try {
        // Collect all current selections
        updateAllSelections();
        
        // Convert Set to Array for JSON serialization
        const toSave = {
            ...contentSettings,
            expandedGroups: Array.from(contentSettings.expandedGroups)
        };
        
        // Save to localStorage
        localStorage.setItem('amc_content_preferences', JSON.stringify(toSave));
        
        // Dispatch event for other pages
        window.dispatchEvent(new CustomEvent('preferencesUpdated', {
            detail: toSave
        }));
        
        // Show success and redirect
        alert('Content preferences saved successfully!');
        window.location.href = 'automediacenter-mobile-v6.5.html';
        
    } catch (e) {
        console.error('Failed to save settings:', e);
        alert('Failed to save preferences. Please try again.');
    }
}

function cancelSettings() {
    if (confirm('Discard unsaved changes?')) {
        window.location.href = 'automediacenter-mobile-v6.5.html';
    }
}

function resetAllFilters() {
    if (confirm('Reset all filters to default settings?')) {
        // Clear saved preferences and reload page
        localStorage.removeItem('amc_content_preferences');
        location.reload();
    }
}

function restoreUIFromSettings() {
    // Restore brand mode
    if (contentSettings.brandMode) {
        const modeRadio = document.querySelector(`input[name="brandMode"][value="${contentSettings.brandMode}"]`);
        if (modeRadio) {
            modeRadio.checked = true;
            document.querySelectorAll('.quick-select-option[data-mode]').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.mode === contentSettings.brandMode);
            });
        }
        
        if (contentSettings.brandMode === 'custom') {
            document.getElementById('customBrandSelection').style.display = 'flex';
        }
    }
    
    // Restore category selections
    contentSettings.categories.forEach(cat => {
        const checkbox = document.querySelector(`input[name="categoryPreference"][value="${cat}"]`);
        if (checkbox) checkbox.checked = true;
    });
    
    // Restore content type selections
    contentSettings.contentTypes.forEach(type => {
        const checkbox = document.querySelector(`input[name="contentTypePreference"][value="${type}"]`);
        if (checkbox) checkbox.checked = true;
    });
    
    // Restore recency
    if (contentSettings.recency) {
        const recencyRadio = document.querySelector(`input[name="recencyPreference"][value="${contentSettings.recency}"]`);
        if (recencyRadio) {
            recencyRadio.checked = true;
            document.querySelectorAll('.quick-select-option[data-recency]').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.recency === contentSettings.recency);
            });
        }
    }
    
    // Restore language selections
    contentSettings.languages.forEach(lang => {
        const checkbox = document.querySelector(`input[name="languagePreference"][value="${lang}"]`);
        if (checkbox) checkbox.checked = true;
    });
    
    // Restore market selections
    contentSettings.markets.forEach(market => {
        const checkbox = document.querySelector(`input[name="marketPreference"][value="${market}"]`);
        if (checkbox) checkbox.checked = true;
    });
    
    // Restore timezone settings
    if (contentSettings.timezoneMode) {
        const timezoneRadio = document.querySelector(`input[name="timezoneMode"][value="${contentSettings.timezoneMode}"]`);
        if (timezoneRadio) {
            timezoneRadio.checked = true;
            document.querySelectorAll('.quick-select-option[data-timezone-mode]').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.timezoneMode === contentSettings.timezoneMode);
            });
        }
        
        if (contentSettings.timezoneMode === 'manual') {
            document.getElementById('manualTimezoneSelection').style.display = 'block';
            if (contentSettings.timezone) {
                const select = document.getElementById('timezoneSelect');
                if (select) select.value = contentSettings.timezone;
            }
        }
    }
}

// ============================================
// EVENT LISTENERS
// ============================================
function attachEventListeners() {
    console.log('Attaching event listeners...');
    
    // Brand mode radio buttons
    document.querySelectorAll('input[name="brandMode"]').forEach(radio => {
        radio.addEventListener('change', function() {
            contentSettings.brandMode = this.value;
            
            document.querySelectorAll('.quick-select-option').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.mode === this.value);
            });
            
            document.getElementById('customBrandSelection').style.display = 
                this.value === 'custom' ? 'flex' : 'none';
            
            updateStatusChip('brandFilterBox', 'brandStatusChip');
        });
    });
    
    // Brand search
    document.getElementById('brandSearchInput')?.addEventListener('input', function(e) {
        contentSettings.searchQuery = e.target.value;
        renderBrandList();
    });
    
    // Category checkboxes
    document.querySelectorAll('input[name="categoryPreference"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateStatusChip('categoryFilterBox', 'categoryStatusChip');
        });
    });
    
    // Content Type checkboxes
    document.querySelectorAll('input[name="contentTypePreference"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateStatusChip('contentTypeFilterBox', 'contentTypeStatusChip');
        });
    });
    
    // Recency radio buttons
    document.querySelectorAll('input[name="recencyPreference"]').forEach(radio => {
        radio.addEventListener('change', function() {
            contentSettings.recency = this.value;
            
            document.querySelectorAll('.quick-select-option[data-recency]').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.recency === this.value);
            });
            
            updateStatusChip('recencyFilterBox', 'recencyStatusChip');
        });
    });
    
    // Language checkboxes
    document.querySelectorAll('input[name="languagePreference"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateStatusChip('languageFilterBox', 'languageStatusChip');
        });
    });
    
    // Market checkboxes
    document.querySelectorAll('input[name="marketPreference"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateStatusChip('marketFilterBox', 'marketStatusChip');
        });
    });
    
    // Timezone mode radio buttons
    const timezoneRadios = document.querySelectorAll('input[name="timezoneMode"]');
    console.log('Found timezone radio buttons:', timezoneRadios.length);
    timezoneRadios.forEach(radio => {
        console.log('Attaching listener to timezone radio:', radio.id, radio.value);
        radio.addEventListener('change', function() {
            console.log('Timezone mode changed to:', this.value);
            contentSettings.timezoneMode = this.value;
            
            document.querySelectorAll('.quick-select-option[data-timezone-mode]').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.timezoneMode === this.value);
            });
            
            const manualDiv = document.getElementById('manualTimezoneSelection');
            const manualDisplay = document.getElementById('manualTimezoneDisplay');
            
            if (manualDiv) {
                manualDiv.style.display = this.value === 'manual' ? 'block' : 'none';
                console.log('Manual timezone div display set to:', manualDiv.style.display);
            } else {
                console.error('manualTimezoneSelection div not found!');
            }
            
            // Hide manual timezone display when switching to auto
            if (manualDisplay) {
                manualDisplay.style.display = this.value === 'manual' ? 'block' : 'none';
            }
            
            // If switching to auto, use detected timezone
            if (this.value === 'auto') {
                contentSettings.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            }
            
            updateStatusChip('timezoneFilterBox', 'timezoneStatusChip');
        });
    });
    
    // Manual timezone selector
    const timezoneSelect = document.getElementById('timezoneSelect');
    if (timezoneSelect) {
        timezoneSelect.addEventListener('change', function() {
            contentSettings.timezone = this.value;
            updateStatusChip('timezoneFilterBox', 'timezoneStatusChip');
            
            // Show manual timezone display when a timezone is selected
            const manualDisplay = document.getElementById('manualTimezoneDisplay');
            if (manualDisplay && this.value) {
                manualDisplay.style.display = 'block';
                updateLiveTime(); // Update immediately
            }
        });
    }
}

function toggleBentoBox(header) {
    const box = header.closest('.bento-box');
    if (!box) return;
    
    const body = box.querySelector('.bento-body');
    const icon = header.querySelector('.toggle-icon');
    
    if (!body || !icon) return;
    
    body.classList.toggle('collapsed');
    icon.classList.toggle('rotated');
}

// ============================================
// BRAND HIERARCHY FUNCTIONS
// ============================================
function getAllCompanies() {
    if (typeof BRAND_HIERARCHY === 'undefined') {
        console.error('BRAND_HIERARCHY not loaded');
        return [];
    }
    
    return Object.entries(BRAND_HIERARCHY)
        .map(([name, data]) => ({
            name,
            brands: data.brands || [],
            displayOrder: data.displayOrder || 999
        }))
        .sort((a, b) => a.displayOrder - b.displayOrder);
}

function getBrandsForCompany(companyName) {
    if (typeof BRAND_HIERARCHY === 'undefined') return [];
    const company = BRAND_HIERARCHY[companyName];
    return company ? company.brands : [];
}

function getCompanyForBrand(brandName) {
    if (typeof BRAND_HIERARCHY === 'undefined') return null;
    
    for (const [companyName, data] of Object.entries(BRAND_HIERARCHY)) {
        if (data.brands && data.brands.includes(brandName)) {
            return companyName;
        }
    }
    return null;
}

function initializeBrandList() {
    renderBrandList();
    updateSelectedChips();
}

function renderBrandList() {
    const container = document.getElementById('brandList');
    if (!container) return;
    
    const query = contentSettings.searchQuery.toLowerCase().trim();
    
    if (query) {
        renderSearchResults(query);
    } else {
        renderHierarchicalList();
    }
}

function renderHierarchicalList() {
    const container = document.getElementById('brandList');
    if (!container) return;
    
    const companies = getAllCompanies();
    
    let html = '';
    companies.forEach(company => {
        const isCompanySelected = contentSettings.selectedCompanies.includes(company.name);
        const expanded = contentSettings.expandedGroups.has(company.name);
        
        html += `
            <div class="brand-group ${expanded ? 'expanded' : ''}" data-company="${company.name}">
                <div class="brand-group-header" onclick="toggleBrandGroup(event, '${company.name}')">
                    <label class="brand-checkbox-label" onclick="event.stopPropagation()">
                        <input 
                            type="checkbox" 
                            ${isCompanySelected ? 'checked' : ''}
                            onchange="handleCompanyCheckboxChange('${company.name}')"
                        >
                        <i class="fas fa-building" style="margin-right: 6px; color: var(--accent-primary);"></i>
                        <strong>${company.name}</strong>
                        <span style="opacity: 0.7; font-size: 0.875rem; margin-left: 6px;">(${company.brands.length} brands)</span>
                    </label>
                    <i class="fas fa-chevron-down toggle-arrow"></i>
                </div>
                <div class="brand-group-brands">
        `;
        
        company.brands.forEach(brand => {
            const isBrandSelected = contentSettings.selectedBrands.includes(brand);
            const isDisabled = isCompanySelected;
            
            html += `
                <label class="brand-item ${isDisabled ? 'disabled' : ''}">
                    <input 
                        type="checkbox" 
                        ${isBrandSelected ? 'checked' : ''}
                        ${isDisabled ? 'disabled' : ''}
                        onchange="handleBrandCheckboxChange('${brand}', '${company.name}')"
                    >
                    ${brand}
                </label>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function renderSearchResults(query) {
    const container = document.getElementById('brandList');
    if (!container) return;
    
    const companies = getAllCompanies();
    const matchingCompanies = [];
    const matchingBrands = [];
    
    companies.forEach(company => {
        if (company.name.toLowerCase().includes(query)) {
            matchingCompanies.push(company);
        }
        
        company.brands.forEach(brand => {
            if (brand.toLowerCase().includes(query)) {
                matchingBrands.push({ brand, company: company.name });
            }
        });
    });
    
    if (matchingCompanies.length === 0 && matchingBrands.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 12px; opacity: 0.5;"></i>
                <p>No companies or brands found for "${query}"</p>
            </div>
        `;
        return;
    }
    
    let html = '<div style="padding: 12px;">';
    html += `<p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 12px;">Found ${matchingCompanies.length + matchingBrands.length} result(s)</p>`;
    
    if (matchingCompanies.length > 0) {
        html += '<div style="font-weight: 600; font-size: 0.75rem; color: var(--accent-primary); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">COMPANIES</div>';
        matchingCompanies.forEach(company => {
            const isSelected = contentSettings.selectedCompanies.includes(company.name);
            html += `
                <label class="brand-item">
                    <input 
                        type="checkbox" 
                        ${isSelected ? 'checked' : ''}
                        onchange="handleCompanyCheckboxChange('${company.name}')"
                    >
                    <i class="fas fa-building" style="margin-right: 6px; color: var(--accent-primary);"></i>
                    <strong>${company.name}</strong>
                    <span style="opacity: 0.7; font-size: 0.875rem; margin-left: 6px;">(${company.brands.length} brands)</span>
                </label>
            `;
        });
    }
    
    if (matchingBrands.length > 0) {
        if (matchingCompanies.length > 0) {
            html += '<div style="height: 16px;"></div>';
        }
        html += '<div style="font-weight: 600; font-size: 0.75rem; color: var(--accent-primary); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">INDIVIDUAL BRANDS</div>';
        matchingBrands.forEach(({brand, company}) => {
            const isSelected = contentSettings.selectedBrands.includes(brand);
            const isCompanySelected = contentSettings.selectedCompanies.includes(company);
            const isDisabled = isCompanySelected;
            
            html += `
                <label class="brand-item ${isDisabled ? 'disabled' : ''}">
                    <input 
                        type="checkbox" 
                        ${isSelected ? 'checked' : ''}
                        ${isDisabled ? 'disabled' : ''}
                        onchange="handleBrandCheckboxChange('${brand}', '${company}')"
                    >
                    ${brand}
                    <span style="opacity: 0.6; font-size: 0.8rem; margin-left: 4px;">(${company})</span>
                </label>
            `;
        });
    }
    
    html += '</div>';
    container.innerHTML = html;
}

function handleCompanyCheckboxChange(companyName) {
    const index = contentSettings.selectedCompanies.indexOf(companyName);
    
    if (index === -1) {
        // Adding company
        contentSettings.selectedCompanies.push(companyName);
        
        // Remove any individual brands from this company
        const companyBrands = getBrandsForCompany(companyName);
        contentSettings.selectedBrands = contentSettings.selectedBrands.filter(
            brand => !companyBrands.includes(brand)
        );
    } else {
        // Removing company
        contentSettings.selectedCompanies.splice(index, 1);
    }
    
    renderBrandList();
    updateSelectedChips();
    updateStatusChip('brandFilterBox', 'brandStatusChip');
}

function handleBrandCheckboxChange(brandName, companyName) {
    const isCompanySelected = contentSettings.selectedCompanies.includes(companyName);
    
    if (isCompanySelected) {
        showConflictMessage(brandName, companyName);
        renderBrandList();
        return;
    }
    
    const index = contentSettings.selectedBrands.indexOf(brandName);
    
    if (index === -1) {
        // Adding brand
        contentSettings.selectedBrands.push(brandName);
        
        // Check if all brands from this company are now selected
        const companyBrands = getBrandsForCompany(companyName);
        const allSelected = companyBrands.every(brand => 
            contentSettings.selectedBrands.includes(brand)
        );
        
        if (allSelected && companyBrands.length > 1) {
            const shouldConvert = confirm(
                `You've selected all ${companyBrands.length} brands from ${companyName}.\n\nWould you like to select the entire company instead?`
            );
            
            if (shouldConvert) {
                contentSettings.selectedCompanies.push(companyName);
                contentSettings.selectedBrands = contentSettings.selectedBrands.filter(
                    brand => !companyBrands.includes(brand)
                );
            }
        }
    } else {
        // Removing brand
        contentSettings.selectedBrands.splice(index, 1);
    }
    
    updateSelectedChips();
    updateStatusChip('brandFilterBox', 'brandStatusChip');
}

function updateSelectedChips() {
    const container = document.getElementById('selectedBrandsChips');
    if (!container) return;
    
    const totalSelections = contentSettings.selectedCompanies.length + contentSettings.selectedBrands.length;
    
    if (totalSelections === 0) {
        container.innerHTML = '<span class="selected-count">No selections</span>';
        container.classList.add('empty');
    } else {
        container.classList.remove('empty');
        
        let html = `<span class="selected-count">Selected (${totalSelections}):</span>`;
        
        // Show companies first (with brand lists)
        contentSettings.selectedCompanies.forEach(company => {
            const brands = getBrandsForCompany(company);
            const brandCount = brands.length;
            
            // Show first 5 brands, then "+X more" if needed
            const visibleBrands = brands.slice(0, 5);
            const remainingCount = brandCount - visibleBrands.length;
            const brandList = visibleBrands.join(' • ');
            const brandListFull = brands.join(', ');
            
            html += `
                <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; width: 100%;">
                    <span class="selected-chip" style="background: #059669; font-weight: 600;">
                        <i class="fas fa-building" style="margin-right: 4px;"></i>
                        ${company}
                        <span style="opacity: 0.8; font-size: 0.75rem; margin-left: 4px;">(${brandCount})</span>
                        <i class="fas fa-info-circle" 
                           style="margin-left: 6px; opacity: 0.7; cursor: help;" 
                           title="${brandListFull}"></i>
                        <button class="selected-chip-remove" onclick="removeBrand('${company}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </span>
                    <span style="font-size: 0.75rem; color: var(--text-secondary); padding-left: 8px; font-style: italic;">
                        ${brandList}${remainingCount > 0 ? ` <strong>+${remainingCount} more</strong>` : ''}
                    </span>
                </div>
            `;
        });
        
        // Show individual brands (inline chips)
        if (contentSettings.selectedBrands.length > 0) {
            html += '<div style="display: flex; flex-wrap: wrap; gap: 8px; width: 100%;">';
            contentSettings.selectedBrands.forEach(brand => {
                html += `
                    <span class="selected-chip">
                        ${brand}
                        <button class="selected-chip-remove" onclick="removeBrand('${brand}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </span>
                `;
            });
            html += '</div>';
        }
        
        container.innerHTML = html;
    }
}

function showConflictMessage(brandName, companyName) {
    alert(`⚠️ Cannot select "${brandName}" individually because "${companyName}" is already selected.\n\nTo select individual brands, first uncheck "${companyName}".`);
}

function toggleBrandGroup(event, companyName) {
    // Don't toggle if clicking on checkbox
    if (event.target.type === 'checkbox' || event.target.closest('label')) {
        return;
    }
    
    if (contentSettings.expandedGroups.has(companyName)) {
        contentSettings.expandedGroups.delete(companyName);
    } else {
        contentSettings.expandedGroups.add(companyName);
    }
    
    const group = document.querySelector(`[data-company="${companyName}"]`);
    if (group) {
        group.classList.toggle('expanded');
    }
}

function removeBrand(item) {
    // Check if it's a company or brand
    const companies = getAllCompanies().map(c => c.name);
    
    if (companies.includes(item)) {
        // Remove company
        contentSettings.selectedCompanies = contentSettings.selectedCompanies.filter(c => c !== item);
    } else {
        // Remove brand
        contentSettings.selectedBrands = contentSettings.selectedBrands.filter(b => b !== item);
    }
    
    // Re-render to update checkboxes
    renderBrandList();
    updateSelectedChips();
    updateStatusChip('brandFilterBox', 'brandStatusChip');
}

// ============================================
// STATUS CHIPS
// ============================================
function updateAllStatusChips() {
    updateStatusChip('brandFilterBox', 'brandStatusChip');
    updateStatusChip('categoryFilterBox', 'categoryStatusChip');
    updateStatusChip('contentTypeFilterBox', 'contentTypeStatusChip');
    updateStatusChip('recencyFilterBox', 'recencyStatusChip');
    updateStatusChip('languageFilterBox', 'languageStatusChip');
    updateStatusChip('marketFilterBox', 'marketStatusChip');
    updateStatusChip('timezoneFilterBox', 'timezoneStatusChip');
}

function updateStatusChip(boxId, chipId) {
    const box = document.getElementById(boxId);
    const chip = document.getElementById(chipId);
    
    console.log(`updateStatusChip called: ${boxId}, ${chipId}`, { box, chip });
    
    if (!box || !chip) {
        console.error(`Missing elements: box=${!!box}, chip=${!!chip}`);
        return;
    }
    
    let count = 0;
    let hasFilters = false;
    
    if (boxId === 'brandFilterBox') {
        const totalSelections = contentSettings.selectedCompanies.length + contentSettings.selectedBrands.length;
        hasFilters = contentSettings.brandMode !== 'all' || totalSelections > 0;
        count = totalSelections;
    } else if (boxId === 'categoryFilterBox') {
        const checked = document.querySelectorAll('input[name="categoryPreference"]:checked');
        count = checked.length;
        hasFilters = count > 0;
    } else if (boxId === 'contentTypeFilterBox') {
        const checked = document.querySelectorAll('input[name="contentTypePreference"]:checked');
        count = checked.length;
        hasFilters = count > 0;
    } else if (boxId === 'recencyFilterBox') {
        hasFilters = contentSettings.recency !== 'all';
        // For recency, show the timeframe name instead of count
        if (hasFilters) {
            const labels = {
                '24h': 'Last 24h',
                '7d': 'Last 7 days',
                '30d': 'Last 30 days',
                '3m': 'Last 3 months',
                '6m': 'Last 6 months',
                '1y': 'Last year'
            };
            chip.textContent = labels[contentSettings.recency] || contentSettings.recency;
            chip.className = 'status-chip active';
            box.classList.add('has-selections');
            return; // Early return for recency
        }
    } else if (boxId === 'languageFilterBox') {
        const checked = document.querySelectorAll('input[name="languagePreference"]:checked');
        count = checked.length;
        hasFilters = count > 0;
    } else if (boxId === 'marketFilterBox') {
        const checked = document.querySelectorAll('input[name="marketPreference"]:checked');
        count = checked.length;
        hasFilters = count > 0;
    } else if (boxId === 'timezoneFilterBox') {
        hasFilters = contentSettings.timezoneMode !== 'auto';
        
        if (hasFilters && contentSettings.timezoneMode === 'manual') {
            // Show selected timezone abbreviation
            const select = document.getElementById('timezoneSelect');
            const selectedOption = select ? select.options[select.selectedIndex] : null;
            const label = selectedOption ? selectedOption.text.split('(')[0].trim() : 'Manual';
            chip.textContent = label;
            chip.className = 'status-chip active';
            box.classList.add('has-selections');
            return; // Early return
        }
    }
    
    if (hasFilters) {
        chip.textContent = count > 0 ? `${count} selected` : 'Custom';
        chip.className = 'status-chip active';
        box.classList.add('has-selections');
    } else {
        // Default text based on box type
        if (boxId === 'brandFilterBox') {
            chip.textContent = 'All brands';
        } else if (boxId === 'contentTypeFilterBox') {
            chip.textContent = 'All types';
        } else if (boxId === 'recencyFilterBox') {
            chip.textContent = 'All time';
        } else if (boxId === 'timezoneFilterBox') {
            chip.textContent = 'Auto-detect';
        } else {
            chip.textContent = 'No filters';
        }
        chip.className = 'status-chip none';
        box.classList.remove('has-selections');
    }
}

function updateAllSelections() {
    // Update categories
    contentSettings.categories = Array.from(
        document.querySelectorAll('input[name="categoryPreference"]:checked')
    ).map(cb => cb.value);
    
    // Update content types
    contentSettings.contentTypes = Array.from(
        document.querySelectorAll('input[name="contentTypePreference"]:checked')
    ).map(cb => cb.value);
    
    // Recency is already updated via radio button listener
    
    // Update languages
    contentSettings.languages = Array.from(
        document.querySelectorAll('input[name="languagePreference"]:checked')
    ).map(cb => cb.value);
    
    // Update markets
    contentSettings.markets = Array.from(
        document.querySelectorAll('input[name="marketPreference"]:checked')
    ).map(cb => cb.value);
}


