// ===== AMC RELEASE DETAIL FUNCTIONALITY =====
// Complete JavaScript functionality extracted from working backup file
// This file contains all the missing functions needed for the release detail page

console.log('✅ AMC Release Detail Functionality v1.0 loaded');

// ===== GLOBAL VARIABLES =====
const urlParams = new URLSearchParams(window.location.search);
const releaseUuid = urlParams.get('uuid');
const API_BASE_URL = window.location.origin;

// Release data storage
let currentReleaseDataForPage = null;

// PDF.js variables
let pdfDoc = null;
let currentPdfUrl = null;
let currentScale = 1.0;
let currentPdfPage = 1;
let totalPdfPages = 1;
let isRendering = false;
let showFullPdf = false;
let isInitialPdfLoad = true;

// Search variables
let searchMatches = [];
let currentSearchIndex = -1;

// Gallery variables
let currentGalleryItems = [];
let currentGalleryItemType = 'image';
let currentSingleViewIndex = 0;
let gallerySelectedItems = new Set();

// TTS variables
let isSpeaking = false;
let currentUtterance = null;
const speechSynthesis = window.speechSynthesis || null;

// Constants
const MAX_INITIAL_FULL_TEXT_HEIGHT = 350;

// NOTE: initializePage is NOT called here. The HTML file's shell callback
// calls window.initializeReleaseDetailPage() after the shell has fully loaded.
// This avoids a double-init race that caused scroll-shift and broken layout.

async function initializePage() {
    if (!releaseUuid) {
        showError('No release ID provided in URL');
        return;
    }
    try {
        const releaseData = await fetchReleaseDetails(releaseUuid);
        if (releaseData) {
            populateReleasePage(releaseData);
            setupEventHandlers();
            wireGalleryModalEvents();
            // Reset scroll to top after shell + content have fully rendered
            window.scrollTo(0, 0);
        }
    } catch (error) {
        console.error('❌ Error initializing page:', error);
        showError(`Error loading release: ${error.message}`);
    }
}

// ===== MAIN RELEASE LOADING FUNCTION =====
async function fetchReleaseDetails(uuid) {
    showLoading(true);
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    const headers = { 'Content-Type': 'application/json' };
    if (token) { headers['Authorization'] = `Bearer ${token}`; }
    const apiUrl = `${API_BASE_URL}/api/v1/center/releases/${uuid}`;

    try {
        const response = await fetch(apiUrl, { headers });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
            throw new Error(errorData.message || `Failed to fetch release details. Status: ${response.status}`);
        }
        const responseData = await response.json();
        if (responseData.success && responseData.data) {
            return responseData.data;
        } else {
            throw new Error(responseData.message || 'Release data not found in response.');
        }
    } catch (error) {
        console.error('Error fetching release details:', error);
        const container = document.getElementById('pr-content-container');
        if (container) {
            container.innerHTML = `<div style="text-align:center; padding: 50px;"><h1><i class="fas fa-exclamation-triangle"></i> Error</h1><p>Could not load the press release: ${error.message}</p><p><a href="automediacenter.html" class="btn btn-primary">Back to releases list</a></p></div>`;
        }
        return null;
    } finally {
        showLoading(false);
    }
}

// ===== POPULATE RELEASE PAGE =====
function populateReleasePage(releaseData) {
    if (!releaseData) {
        const container = document.getElementById('pr-content-container');
        if (container) container.innerHTML = "<h1>Error: Release data is missing.</h1>";
        return;
    }
    
    currentReleaseDataForPage = releaseData;
    document.title = `${releaseData.title || 'Press Release'} - AutoMediaCenter`;
    
    // Update header information
    const titleEl = document.getElementById('release-title-main');
    if (titleEl) titleEl.textContent = releaseData.title || 'N/A';
    
    // Update meta information
    updateMetaInformation(releaseData);
    
    // Update lead paragraph
    const leadEl = document.getElementById('release-lead');
    if (leadEl) {
        leadEl.innerHTML = releaseData.leadParagraph || (releaseData.summary ? releaseData.summary.substring(0,200) + '...' : '');
    }
    
    // Check for PDF document and set up PDF viewer or fallback to text
    const mainPdfDoc = releaseData.releaseDocs && releaseData.releaseDocs.find(d => d.mimetype === 'application/pdf');
    if (mainPdfDoc && mainPdfDoc.path) {
        setupPdfViewer(mainPdfDoc);
    } else {
        setupFullTextToggle(releaseData);
    }
    
    // Update supplementary content
    updateSupplementaryContent(releaseData);
    
    // Populate asset sections
    populateAssetSections(releaseData);
    
    // Setup download buttons
    setupDownloadButtons(releaseData, mainPdfDoc);
}

function updateMetaInformation(releaseData) {
    let releaseDate = 'N/A';
    if (releaseData.releaseDate) {
        try { 
            const dateObj = new Date(releaseData.releaseDate); 
            releaseDate = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch (e) { 
            console.error("Error parsing releaseDate", e); 
        }
    }
    
    const dateEl = document.getElementById('release-date-meta');
    const timeEl = document.getElementById('release-time-meta');
    const timezoneEl = document.getElementById('release-timezone-meta');
    const idEl = document.getElementById('release-id-meta');
    
    if (dateEl) dateEl.textContent = releaseDate;
    if (timeEl) timeEl.textContent = releaseData.releaseTime || 'N/A';
    if (timezoneEl) timezoneEl.textContent = releaseData.timezone || 'N/A';
    if (idEl) idEl.textContent = releaseData.uuid ? releaseData.uuid.substring(0, 8) + '...' : (releaseData._id || 'N/A');
}

function updateSupplementaryContent(releaseData) {
    const notesToEditorsEl = document.getElementById('notes-to-editors');
    const aboutClientEl = document.getElementById('about-client');
    const clientNameAboutEl = document.getElementById('client-name-about');
    
    if (releaseData.notesToEditors && releaseData.notesToEditors.trim() !== '<p></p>') { 
        if (notesToEditorsEl) {
            notesToEditorsEl.style.display = 'block';
            const p = notesToEditorsEl.querySelector('p');
            if (p) p.innerHTML = releaseData.notesToEditors;
        }
    } else if (notesToEditorsEl) { 
        notesToEditorsEl.style.display = 'none'; 
    }

    if (releaseData.aboutClient && releaseData.aboutClient.trim() !== '<p></p>') {
        if (aboutClientEl) {
            aboutClientEl.style.display = 'block';
            if (clientNameAboutEl) clientNameAboutEl.textContent = releaseData.brand || 'the Company';
            const p = aboutClientEl.querySelector('p');
            if (p) p.innerHTML = releaseData.aboutClient;
        }
    } else if (aboutClientEl) { 
        aboutClientEl.style.display = 'none'; 
    }
}

function populateAssetSections(releaseData) {
    // Populate images
    populateAssetSection(releaseData.images, 'images', 4);
    
    // Populate videos  
    populateAssetSection(releaseData.videos, 'videos', 2);
    
    // Populate documents
    populateDocuments(releaseData.supplementaryDocs || []);
    
    // Setup contact and site information
    setupContactInformation(releaseData);
}

function populateAssetSection(assetArray, type, maxThumbs) {
    const assets = assetArray || [];
    const boxEl = document.getElementById(`related-${type}-box`);
    const countDisplayEl = document.getElementById(`${type}-count-display`);
    const viewAllBtnEl = document.getElementById(`view-all-${type}-btn`);
    
    if (!boxEl || !countDisplayEl) return;
    
    const thumbnailsContainer = boxEl.querySelector(`.${type.slice(0, -1)}-thumbnails`);
    const noAssetsMsg = boxEl.querySelector('.no-assets-message');
    
    countDisplayEl.textContent = `(${assets.length})`;
    
    if (thumbnailsContainer) thumbnailsContainer.innerHTML = '';
    
    if (assets.length > 0) {
        if (noAssetsMsg) noAssetsMsg.style.display = 'none';
        if (thumbnailsContainer) {
            thumbnailsContainer.style.display = 'grid';
            const itemsToShow = assets.slice(0, maxThumbs);
            
            itemsToShow.forEach((item, index) => {
                const thumbItem = document.createElement('div');
                thumbItem.className = 'asset-thumbnail-item';
                
                let isActualImageThumb = true;
                let thumbSrc = null;

                // Enhanced thumbnail logic
                if (item.thumbPath) {
                     thumbSrc = `${API_BASE_URL}${item.thumbPath}`;
                     isActualImageThumb = true;
                } else if (type === 'images' && item.path) {
                     thumbSrc = `${API_BASE_URL}${item.path}`;
                     isActualImageThumb = true;
                } else if (item.thumb && item.thumb !== item.path && item.thumb.trim() !== '') {
                     thumbSrc = item.thumb.startsWith('http') ? item.thumb : `${API_BASE_URL}${item.thumb}`;
                     isActualImageThumb = true;
                } else if (type === 'videos') {
                    isActualImageThumb = false;
                } else {
                    isActualImageThumb = false;
                }
                
                if(isActualImageThumb && thumbSrc) {
                    const imgEl = document.createElement('img');
                    imgEl.src = thumbSrc;
                    imgEl.alt = item.altText || item.originalName || `${type.slice(0, -1)} ${index + 1}`;
                    
                    imgEl.onerror = function() {
                        this.style.display = 'none';
                        thumbItem.classList.add('video-placeholder');
                    };
                    
                    thumbItem.appendChild(imgEl);
                    if (type === 'videos') {
                        const playIcon = document.createElement('i');
                        playIcon.className = 'fas fa-play-circle video-play-icon';
                        thumbItem.appendChild(playIcon);
                    }
                } else {
                    thumbItem.classList.add('video-placeholder');
                }
                
                thumbItem.onclick = () => openGalleryModal(currentReleaseDataForPage.title, assets, type.slice(0, -1), index); 
                thumbnailsContainer.appendChild(thumbItem);
            });
        }
        
        if (viewAllBtnEl) { 
            viewAllBtnEl.style.display = assets.length >= maxThumbs ? 'block' : 'none';
            viewAllBtnEl.onclick = () => openGalleryModal(currentReleaseDataForPage.title, assets, type.slice(0, -1), 'grid'); 
        }
    } else {
        if (thumbnailsContainer) thumbnailsContainer.style.display = 'none';
        if (noAssetsMsg) {
            noAssetsMsg.textContent = `No ${type} available.`; 
            noAssetsMsg.style.display = 'block';
        }
        if (viewAllBtnEl) viewAllBtnEl.style.display = 'none';
    }
}

function populateDocuments(currentDocs) {
    const documentsBoxEl = document.getElementById('related-documents-box');
    const documentsCountDisplayEl = document.getElementById('documents-count-display');
    const docListEl = documentsBoxEl?.querySelector('.document-list');
    const noDocsMsg = documentsBoxEl?.querySelector('.no-assets-message');
    
    if (!documentsBoxEl || !documentsCountDisplayEl) return;
    
    documentsCountDisplayEl.textContent = `(${currentDocs.length})`;
    if (docListEl) docListEl.innerHTML = '';
    
    if (currentDocs.length > 0) {
        if (noDocsMsg) noDocsMsg.style.display = 'none'; 
        if (docListEl) {
            docListEl.style.display = 'flex';
            currentDocs.forEach(doc => {
                const docItem = document.createElement('div');
                docItem.className = 'document-item';
                
                // Determine file type and icon
                const fileName = doc.originalName || 'Document';
                const fileExt = fileName.toLowerCase().split('.').pop();
                let iconClass = 'fas fa-file-alt';
                let iconType = 'default';
                
                if (fileExt === 'pdf') {
                    iconClass = 'fas fa-file-pdf';
                    iconType = 'pdf';
                } else if (['doc', 'docx'].includes(fileExt)) {
                    iconClass = 'fas fa-file-word';
                    iconType = 'word';
                } else if (['xls', 'xlsx'].includes(fileExt)) {
                    iconClass = 'fas fa-file-excel';
                    iconType = 'excel';
                }
                
                // Clean up filename for display
                const displayName = fileName
                    .replace(/_[a-f0-9]{8,}\./i, '.') // Remove hash before extension
                    .replace(/_/g, ' ') // Replace underscores with spaces
                    .replace(/\b\w/g, l => l.toUpperCase()); // Title case
                
                // Format file size
                const fileSize = doc.size ? `${(doc.size / 1024).toFixed(0)} KB` : 'Unknown size';
                
                docItem.innerHTML = `
                    <div class="document-item-left">
                        <div class="document-item-icon ${iconType}">
                            <i class="${iconClass}"></i>
                        </div>
                        <div class="document-item-info">
                            <div class="document-item-name" title="${fileName}">${displayName}</div>
                            <div class="document-item-meta">
                                <span>${fileSize}</span>
                                <span>•</span>
                                <span>${fileExt.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>
                    <div class="document-item-download" title="Download ${displayName}">
                        <i class="fas fa-download"></i>
                    </div>
                `;
                
                // Add click handlers
                const downloadBtn = docItem.querySelector('.document-item-download');
                const clickHandler = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (doc._id) {
                        const downloadUrl = `${API_BASE_URL}/api/v1/center/assets/download/${doc._id}`;
                        triggerDownload(downloadUrl, fileName);
                    } else {
                        alert('This document is from an older release and cannot be downloaded. Please contact support if you need access to this content.');
                    }
                };
                
                docItem.addEventListener('click', clickHandler);
                downloadBtn.addEventListener('click', clickHandler);
                
                docListEl.appendChild(docItem);
            });
        }
    } else {
        if (docListEl) docListEl.style.display = 'none'; 
        if (noDocsMsg) {
            noDocsMsg.textContent = 'No additional documents available.'; 
            noDocsMsg.style.display = 'block';
        }
    }
}

function setupContactInformation(releaseData) {
    const mediaContactsBoxEl = document.getElementById('media-contacts');
    const officialSiteLinkBoxEl = document.getElementById('official-site-link-box');
    
    if (releaseData.contacts && releaseData.brand && mediaContactsBoxEl) { 
        mediaContactsBoxEl.style.display = 'block';
        const logoEl = mediaContactsBoxEl.querySelector('.client-logo-pr');
        if (logoEl) {
            logoEl.src = releaseData.clientLogoPath ? `${API_BASE_URL}${releaseData.clientLogoPath}` : 'https://via.placeholder.com/150x50.png?text=Client+Logo';
            logoEl.alt = `${releaseData.brand} Logo`;
        }
        const cdp = mediaContactsBoxEl.querySelector('#contact-details-paragraph');
        if (cdp) {
            cdp.innerHTML = `<strong>${releaseData.contacts.name || ''}</strong><br>${releaseData.contacts.title || ''}<br><a href="mailto:${releaseData.contacts.email || ''}">${releaseData.contacts.email || ''}</a><br><a href="tel:${(releaseData.contacts.phone || '').replace(/\s|-/g, '')}">${releaseData.contacts.phone || ''}</a>`;
        }
    } else if (mediaContactsBoxEl) { 
        mediaContactsBoxEl.style.display = 'none'; 
    }

    if (releaseData.clientMediaSiteUrl && releaseData.brand && officialSiteLinkBoxEl) {
        officialSiteLinkBoxEl.style.display = 'block';
        const officialSiteAnchor = document.getElementById('official-site-anchor');
        const officialSiteLogo = document.getElementById('official-site-logo');
        if (officialSiteAnchor) {
            officialSiteAnchor.href = releaseData.clientMediaSiteUrl;
            officialSiteAnchor.innerHTML = `Visit Official ${releaseData.brand} Media Site <i class="fas fa-external-link-alt fa-xs"></i>`;
        }
        if (officialSiteLogo) {
            if (releaseData.clientLogoPath) { 
                officialSiteLogo.src = `${API_BASE_URL}${releaseData.clientLogoPath}`; 
                officialSiteLogo.alt = `${releaseData.brand} Logo`; 
                officialSiteLogo.style.display = 'inline-block';
            } else { 
                officialSiteLogo.style.display = 'none'; 
            }
        }
    } else if (officialSiteLinkBoxEl) { 
        officialSiteLinkBoxEl.style.display = 'none'; 
    }
}

function setupDownloadButtons(releaseData, mainPdfDoc) {
    const downloadAllReleaseAssetsBtn = document.getElementById('download-all-release-assets-btn');
    const downloadMediaReleaseBtn = document.getElementById('download-media-release-btn');
    const downloadPdfBtn = document.getElementById('download-release-pdf-btn');
    const extractPdfTextBtn = document.getElementById('extract-pdf-text-btn');
    
    // Setup download all assets button
    const hasAnyMainAssets = (releaseData.images && releaseData.images.length > 0) || 
                            (releaseData.videos && releaseData.videos.length > 0) || 
                            (releaseData.supplementaryDocs && releaseData.supplementaryDocs.length > 0);
    
    if (downloadAllReleaseAssetsBtn) {
        downloadAllReleaseAssetsBtn.style.display = hasAnyMainAssets ? 'inline-flex' : 'none';
        if(hasAnyMainAssets) { 
            downloadAllReleaseAssetsBtn.onclick = async () => {
                const downloadUrl = `${API_BASE_URL}/api/v1/zip/release/${releaseData.uuid}/zip`;
                const zipFilename = `${releaseData.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_Media_Assets.zip`;
                const token = localStorage.getItem('token') || localStorage.getItem('authToken');

                try {
                    const headers = {};
                    if (token) headers['Authorization'] = `Bearer ${token}`;

                    const response = await fetch(downloadUrl, { method: 'GET', headers });
                    if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);

                    const rawBlob = await response.blob();
                    const blob = new Blob([rawBlob], { type: 'application/zip' });
                    const blobUrl = URL.createObjectURL(blob);

                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = blobUrl;
                    a.download = zipFilename;
                    document.body.appendChild(a);
                    a.click();

                    setTimeout(() => {
                        URL.revokeObjectURL(blobUrl);
                        if (document.body.contains(a)) document.body.removeChild(a);
                    }, 150);

                    showDownloadSuccessToast(releaseData.title);
                } catch (error) {
                    console.error('ZIP download error:', error);
                    showToast('Download failed: ' + error.message, 'error');
                }
            };
        }
    }
    
    // Setup PDF download buttons
    if (downloadPdfBtn && mainPdfDoc) {
        downloadPdfBtn.onclick = () => {
            if (mainPdfDoc._id) {
                const downloadUrl = `${API_BASE_URL}/api/v1/center/assets/download/${mainPdfDoc._id}`;
                triggerDownload(downloadUrl, mainPdfDoc.originalName || 'media-release.pdf');
            } else {
                alert('No primary PDF document available for download for this release.');
            }
        };
    }

    if (downloadMediaReleaseBtn && mainPdfDoc) {
        downloadMediaReleaseBtn.style.display = 'inline-flex';
        downloadMediaReleaseBtn.onclick = () => {
            if (mainPdfDoc._id) {
                const downloadUrl = `${API_BASE_URL}/api/v1/center/assets/download/${mainPdfDoc._id}`;
                triggerDownload(downloadUrl, mainPdfDoc.originalName || 'media-release.pdf');
            } else {
                alert('This PDF is from an older release and cannot be downloaded. Please contact support if you need access to this content.');
            }
        };
    } else if (downloadMediaReleaseBtn) {
        downloadMediaReleaseBtn.style.display = 'none';
    }
    
    // Setup PDF text extraction
    if (mainPdfDoc && extractPdfTextBtn) {
        extractPdfTextBtn.style.display = 'inline-flex';
        extractPdfTextBtn.onclick = () => {
            extractPdfTextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            extractPdfTextBtn.disabled = true;
            fetchAndDisplayPdfText(releaseData.uuid).finally(() => {
                extractPdfTextBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Load Full Media Release Text';
                extractPdfTextBtn.disabled = false;
            });
        };
        
        // Try automatic extraction with a delay
        setTimeout(() => {
            fetchAndDisplayPdfText(releaseData.uuid).then((success) => {
                if (success) {
                    extractPdfTextBtn.style.display = 'none';
                }
            });
        }, 500);
    } else if (extractPdfTextBtn) {
        extractPdfTextBtn.style.display = 'none';
    }
}

// ===== PDF TEXT EXTRACTION =====
async function fetchAndDisplayPdfText(releaseUuid) {
    try {
        console.log('Attempting to fetch PDF text for UUID:', releaseUuid);
        const headers = { 'Content-Type': 'application/json' };
        
        const response = await fetch(`${API_BASE_URL}/api/v1/center/releases/${releaseUuid}/extract-pdf-text`, { headers });
        console.log('PDF text extraction response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('PDF text extraction result:', result);
            
            if (result.success && result.data.extractedText) {
                currentReleaseDataForPage.summary = result.data.extractedText;
                
                const fullTextEl = document.getElementById('release-text-full');
                const toggleFullTextBtn = document.getElementById('toggle-full-text-btn');
                
                if (fullTextEl) {
                    fullTextEl.innerHTML = result.data.extractedText;
                    
                    fullTextEl.classList.remove('collapsed');
                    const fullHeight = fullTextEl.scrollHeight;
                    fullTextEl.style.maxHeight = '';
                    
                    if (fullHeight > MAX_INITIAL_FULL_TEXT_HEIGHT) {
                        fullTextEl.classList.add('collapsed');
                        fullTextEl.style.maxHeight = MAX_INITIAL_FULL_TEXT_HEIGHT + 'px';
                        if (toggleFullTextBtn) {
                            toggleFullTextBtn.textContent = 'Read More...';
                            toggleFullTextBtn.style.display = 'inline-flex';
                            toggleFullTextBtn.onclick = () => {
                                if (fullTextEl.classList.contains('collapsed')) {
                                    fullTextEl.classList.remove('collapsed');
                                    fullTextEl.style.maxHeight = fullHeight + 'px';
                                    toggleFullTextBtn.textContent = 'Read Less...';
                                } else {
                                    fullTextEl.classList.add('collapsed');
                                    fullTextEl.style.maxHeight = MAX_INITIAL_FULL_TEXT_HEIGHT + 'px';
                                    void fullTextEl.offsetHeight;
                                    toggleFullTextBtn.textContent = 'Read More...';
                                }
                            };
                        }
                    } else {
                        if (toggleFullTextBtn) toggleFullTextBtn.style.display = 'none';
                        fullTextEl.classList.remove('collapsed');
                    }
                }
                
                console.log('PDF text extracted and displayed successfully');
                return true;
            } else {
                console.log('No extracted text in response');
                return false;
            }
        } else {
            const errorResult = await response.json().catch(() => ({}));
            console.log('PDF text extraction failed:', response.status, errorResult);
            return false;
        }
    } catch (error) {
        console.error('Error fetching PDF text:', error);
        return false;
    }
}

// ===== FULL TEXT TOGGLE =====
function setupFullTextToggle(releaseData) {
    const fullTextEl = document.getElementById('release-text-full');
    const toggleFullTextBtn = document.getElementById('toggle-full-text-btn');
    
    if (!fullTextEl || !toggleFullTextBtn || !releaseData || !releaseData.summary) {
        if (fullTextEl) fullTextEl.innerHTML = "<p>No content provided.</p>";
        if (toggleFullTextBtn) toggleFullTextBtn.style.display = 'none';
        return;
    }
    
    fullTextEl.innerHTML = releaseData.summary;
    fullTextEl.classList.remove('collapsed');
    const fullHeight = fullTextEl.scrollHeight;
    fullTextEl.style.maxHeight = ''; 
    
    if (fullHeight > MAX_INITIAL_FULL_TEXT_HEIGHT) {
        fullTextEl.classList.add('collapsed');
        fullTextEl.style.maxHeight = MAX_INITIAL_FULL_TEXT_HEIGHT + 'px';
        toggleFullTextBtn.textContent = 'Read More...';
        toggleFullTextBtn.style.display = 'inline-flex';
        toggleFullTextBtn.onclick = () => {
            if (fullTextEl.classList.contains('collapsed')) {
                fullTextEl.classList.remove('collapsed');
                fullTextEl.style.maxHeight = fullHeight + 'px';
                toggleFullTextBtn.textContent = 'Read Less...';
            } else {
                fullTextEl.classList.add('collapsed');
                fullTextEl.style.maxHeight = MAX_INITIAL_FULL_TEXT_HEIGHT + 'px';
                void fullTextEl.offsetHeight; 
                toggleFullTextBtn.textContent = 'Read More...';
            }
        };
    } else {
        toggleFullTextBtn.style.display = 'none';
        fullTextEl.classList.remove('collapsed');
    }
}

// ===== PDF VIEWER SETUP =====
async function setupPdfViewer(pdfDocData) {
    console.log('Setting up PDF.js viewer');
    
    const pdfViewerContainer = document.getElementById('pdf-viewer-container');
    const pdfViewerWrapper = document.getElementById('pdf-viewer-wrapper');
    const pdfLoading = document.getElementById('pdf-loading');
    const pdfFallback = document.getElementById('pdf-viewer-fallback');
    const legacyTextContent = document.getElementById('legacy-text-content');
    
    if (!pdfViewerContainer || !pdfViewerWrapper) {
        console.error('PDF viewer elements not found');
        setupFullTextToggle(currentReleaseDataForPage);
        return;
    }
    
    // Show PDF container, hide text
    pdfViewerContainer.style.display = 'flex';
    pdfViewerContainer.classList.add('preview-mode');
    if (legacyTextContent) legacyTextContent.style.display = 'none';
    
    // Show loading state
    if (pdfLoading) pdfLoading.style.display = 'flex';
    if (pdfFallback) pdfFallback.style.display = 'none';
    
    try {
        // Configure PDF.js worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        // Construct PDF URL
        currentPdfUrl = pdfDocData.path.startsWith('http') ? pdfDocData.path : `${API_BASE_URL}${pdfDocData.path}`;
        console.log('Loading PDF from:', currentPdfUrl);
        
        // Load PDF with PDF.js
        const loadingTask = pdfjsLib.getDocument({
            url: currentPdfUrl,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true
        });
        
        pdfDoc = await loadingTask.promise;
        totalPdfPages = pdfDoc.numPages;
        
        console.log(`PDF loaded successfully. Pages: ${totalPdfPages}`);
        
        // Hide loading, show viewer
        if (pdfLoading) pdfLoading.style.display = 'none';
        
        // Update page info
        const currentPageEl = document.getElementById('pdf-current-page');
        const totalPagesEl = document.getElementById('pdf-total-pages');
        if (currentPageEl) currentPageEl.textContent = currentPdfPage;
        if (totalPagesEl) totalPagesEl.textContent = totalPdfPages;
        
        // Render first page
        await renderAllPages();
        
        // Setup PDF controls
        setupPdfControls();
        
        // Initialize control bar hover functionality
        initSlideControls();
        
        console.log('PDF viewer setup complete');
        
    } catch (error) {
        console.error('Error loading PDF:', error);
        
        // Hide loading, show fallback
        if (pdfLoading) pdfLoading.style.display = 'none';
        if (pdfFallback) {
            pdfFallback.style.display = 'flex';
            const fallbackBtn = document.getElementById('fallback-download-btn');
            if (fallbackBtn) {
                fallbackBtn.onclick = () => {
                    if (pdfDocData._id) {
                        const downloadUrl = `${API_BASE_URL}/api/v1/center/assets/download/${pdfDocData._id}`;
                        triggerDownload(downloadUrl, pdfDocData.originalName || 'media-release.pdf');
                    }
                };
            }
        }
        
        // Fallback to text content
        if (legacyTextContent) legacyTextContent.style.display = 'block';
        setupFullTextToggle(currentReleaseDataForPage);
    }
}

// ===== DOWNLOAD FUNCTIONS =====
// Map file extensions to MIME types so the blob always has a known type.
// Chrome only downloads objectURLs silently when the blob type is recognised;
// application/octet-stream or empty type triggers "Save As".
const MIME_MAP = {
    jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif',
    webp:'image/webp', bmp:'image/bmp', tiff:'image/tiff', tif:'image/tiff',
    svg:'image/svg+xml',
    mp4:'video/mp4', webm:'video/webm', mov:'video/quicktime', avi:'video/x-msvideo',
    pdf:'application/pdf',
    zip:'application/zip', tar:'application/x-tar', gz:'application/gzip',
    doc:'application/msword', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls:'application/vnd.ms-excel', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt:'application/vnd.ms-powerpoint', pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    csv:'text/csv', txt:'text/plain', html:'text/html', json:'application/json'
};
function mimeFromFilename(name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    return MIME_MAP[ext] || null;
}

async function triggerDownload(url, filename) {
    if (!url) {
        console.error('triggerDownload: URL is missing for', filename);
        showToast('Download URL is missing.', 'error');
        return;
    }

    const token = localStorage.getItem('token') || localStorage.getItem('authToken');

    try {
        // Fetch WITH auth header — the server logs the download event here.
        // This is how analytics attribution works (downloads tracked per user).
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(url, { method: 'GET', headers });

        if (!response.ok) {
            throw new Error(`Download failed: ${response.statusText}`);
        }

        // Resolve the final filename (server may suggest one via Content-Disposition)
        let finalFilename = filename || url.split('/').pop() || 'download';
        const cd = response.headers.get('Content-Disposition');
        if (cd) {
            const m = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (m && m[1]) finalFilename = m[1].replace(/['"]/g, '').trim();
        }

        // Determine the correct MIME type.
        // Priority: 1) server Content-Type if it's specific, 2) inferred from filename.
        // This is critical: Chrome shows "Save As" for blobs with type="" or
        // "application/octet-stream". A known MIME type triggers silent download.
        let contentType = (response.headers.get('Content-Type') || '').split(';')[0].trim();
        if (!contentType || contentType === 'application/octet-stream') {
            contentType = mimeFromFilename(finalFilename) || 'application/octet-stream';
        }

        const rawBlob = await response.blob();
        // Re-wrap with the resolved type so the objectURL carries it
        const blob = new Blob([rawBlob], { type: contentType });
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = finalFilename;
        document.body.appendChild(a);
        a.click();

        // Cleanup after a tick — click() is async
        setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
            if (document.body.contains(a)) document.body.removeChild(a);
        }, 150);

        showDownloadSuccessToast(finalFilename);

    } catch (error) {
        console.error('Download error:', error);
        showToast('Download failed: ' + error.message, 'error');
    }
}

// ===== EVENT HANDLERS =====
function setupEventHandlers() {
    // Print button
    const printBtn = document.getElementById('print-release-btn');
    if (printBtn) {
        printBtn.onclick = () => window.print();
    }
    
    // Email button
    const emailBtn = document.getElementById('email-release-btn');
    if (emailBtn) {
        emailBtn.onclick = () => {
            const subject = encodeURIComponent(`Media Release: ${currentReleaseDataForPage?.title || 'Press Release'}`);
            const body = encodeURIComponent(`Please find the media release: ${window.location.href}`);
            window.location.href = `mailto:?subject=${subject}&body=${body}`;
        };
    }
    
    // Share button
    const shareBtn = document.getElementById('share-release-btn');
    if (shareBtn) {
        shareBtn.onclick = () => {
            const shareModal = document.getElementById('shareReleaseModal');
            if (shareModal) {
                shareModal.classList.add('open');
                setupShareModal();
            }
        };
    }
}

function setupShareModal() {
    const modal = document.getElementById('shareReleaseModal');
    const closeBtn = document.getElementById('closeShareModalBtn');
    const copyLinkBtn = document.getElementById('copy-release-link-btn');
    
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.classList.remove('open');
        };
    }
    
    if (copyLinkBtn) {
        copyLinkBtn.onclick = () => {
            navigator.clipboard.writeText(window.location.href).then(() => {
                showToast('Link copied to clipboard', 'success');
            });
        };
    }
    
    // Setup social sharing links
    const releaseTitle = currentReleaseDataForPage?.title || 'Press Release';
    const releaseUrl = encodeURIComponent(window.location.href);
    const releaseText = encodeURIComponent(releaseTitle);
    
    const socialLinks = {
        'share-facebook': `https://www.facebook.com/sharer/sharer.php?u=${releaseUrl}`,
        'share-x-twitter': `https://twitter.com/intent/tweet?text=${releaseText}&url=${releaseUrl}`,
        'share-linkedin': `https://www.linkedin.com/sharing/share-offsite/?url=${releaseUrl}`,
        'share-email-link': `mailto:?subject=${releaseText}&body=${releaseUrl}`
    };
    
    Object.entries(socialLinks).forEach(([id, url]) => {
        const link = document.getElementById(id);
        if (link) {
            link.href = url;
        }
    });
}

// ===== UTILITY FUNCTIONS =====
function showLoading(show) {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = show ? 'flex' : 'none';
    }
}

function showError(message) {
    const container = document.getElementById('pr-content-container');
    if (container) {
        container.innerHTML = `
            <div style="text-align:center; padding: 50px;">
                <h1><i class="fas fa-exclamation-triangle"></i> Error</h1>
                <p>${message}</p>
                <p><a href="automediacenter.html" class="btn btn-primary">Back to releases list</a></p>
            </div>
        `;
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    
    toast.innerHTML = `
        <span class="toast-icon"><i class="fas ${icon}"></i></span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function showDownloadSuccessToast(filename) {
    showToast(`Successfully downloaded: ${filename}`, 'success');
}

// ===== MISSING CRITICAL FUNCTIONS =====

// MISSING FUNCTION: renderAllPages - Required for PDF rendering
async function renderAllPages() {
    if (!pdfDoc || isRendering) return;
    
    isRendering = true;
    const wrapper = document.getElementById('pdf-viewer-wrapper');
    
    // Clear existing pages
    const existing = wrapper.querySelectorAll('.pdf-page-container, .pdf-canvas, .see-full-release-btn');
    existing.forEach(el => el.remove());
    
    const wrapperWidth = wrapper.clientWidth || 800;
    
    const pagesToRender = showFullPdf ? totalPdfPages : Math.min(3, totalPdfPages);
    for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        
        // Create page container
        const pageContainer = document.createElement('div');
        pageContainer.className = 'pdf-page-container';
        pageContainer.dataset.pageNumber = pageNum;
        
        // Create canvas for rendering
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-canvas';
        
        const viewport = page.getViewport({ scale: 1 });
        const scale = wrapperWidth / viewport.width * currentScale;
        const scaledViewport = page.getViewport({ scale });
        
        const dpr = window.devicePixelRatio || 2;
        canvas.width = scaledViewport.width * dpr;
        canvas.height = scaledViewport.height * dpr;
        canvas.style.width = `${scaledViewport.width}px`;
        canvas.style.height = `${scaledViewport.height}px`;
        
        pageContainer.appendChild(canvas);
        
        // Render PDF to canvas
        const ctx = canvas.getContext('2d');
        const renderContext = {
            canvasContext: ctx,
            viewport: scaledViewport,
            transform: [dpr, 0, 0, dpr, 0, 0]
        };
        
        await page.render(renderContext).promise;
        
        // CRITICAL: Add text layer for selection/copy
        try {
            const textContent = await page.getTextContent();
            const textLayerDiv = document.createElement('div');
            textLayerDiv.className = 'textLayer';
            textLayerDiv.style.width = `${scaledViewport.width}px`;
            textLayerDiv.style.height = `${scaledViewport.height}px`;
            
            pageContainer.appendChild(textLayerDiv);
            
            // Render text layer using PDF.js text layer builder
            pdfjsLib.renderTextLayer({
                textContent: textContent,
                container: textLayerDiv,
                viewport: scaledViewport,
                textDivs: []
            });
        } catch (err) {
            console.log(`No text layer on page ${pageNum}`, err);
        }
        
        // ===== ADD INTELLIGENT HYPERLINK ANNOTATION LAYER =====
        try {
            const annotations = await page.getAnnotations();
            
            // Create annotation layer for clickable links
            const annotationLayerDiv = document.createElement('div');
            annotationLayerDiv.className = 'annotationLayer';
            annotationLayerDiv.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: ${scaledViewport.width}px;
                height: ${scaledViewport.height}px;
                pointer-events: none;
                z-index: 10;
            `;
            
            pageContainer.appendChild(annotationLayerDiv);
            
            // Create clickable elements for each link annotation
            annotations.forEach(annotation => {
                if (annotation.subtype === 'Link' && annotation.url) {
                    const rect = annotation.rect;
                    const [x1, y1, x2, y2] = scaledViewport.convertToViewportRectangle(rect);
                    
                    const isEmailLink = annotation.url.startsWith('mailto:');
                    
                    // Create clickable link element
                    const linkElement = document.createElement('div');
                    linkElement.className = isEmailLink ? 'pdf-email-link' : 'pdf-url-link';
                    linkElement.dataset.url = annotation.url;
                    linkElement.style.cssText = `
                        position: absolute;
                        left: ${Math.min(x1, x2)}px;
                        top: ${Math.min(y1, y2)}px;
                        width: ${Math.abs(x2 - x1)}px;
                        height: ${Math.abs(y2 - y1)}px;
                        pointer-events: auto;
                        cursor: pointer;
                        background-color: ${isEmailLink ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)'};
                        border: 1px solid ${isEmailLink ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)'};
                        transition: all 0.2s ease;
                        border-radius: 2px;
                    `;
                    // NO TOOLTIP - enterprise UIs are self-explanatory through visual feedback
                    
                    // Enterprise hover state - subtle brightness increase
                    linkElement.addEventListener('mouseenter', function() {
                        this.style.backgroundColor = isEmailLink ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)';
                        this.style.borderColor = isEmailLink ? 'rgba(16, 185, 129, 0.4)' : 'rgba(59, 130, 246, 0.4)';
                        this.style.transform = 'scale(1.02)';
                    });
                    linkElement.addEventListener('mouseleave', function() {
                        this.style.backgroundColor = isEmailLink ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)';
                        this.style.borderColor = isEmailLink ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)';
                        this.style.transform = 'scale(1)';
                    });
                    
                    // Click handler
                    if (isEmailLink) {
                        // Email link: Show enterprise popover on HOVER (like Notion/Linear)
                        let hoverTimeout;
                        let closeTimeout;
                        
                        linkElement.addEventListener('mouseenter', function(e) {
                            // Close any existing popover first
                            const existing = document.getElementById('email-link-popover');
                            if (existing) existing.remove();
                            
                            // Clear any pending close timeout
                            if (closeTimeout) clearTimeout(closeTimeout);
                            
                            // Show popover after slight delay
                            hoverTimeout = setTimeout(() => {
                                showEmailLinkPopover(annotation.url, this);
                                
                                // Set up close timeout when leaving the link
                                const popover = document.getElementById('email-link-popover');
                                if (popover) {
                                    // Track if user is hovering over popover
                                    let isOverPopover = false;
                                    
                                    popover.addEventListener('mouseenter', function() {
                                        isOverPopover = true;
                                        if (closeTimeout) clearTimeout(closeTimeout);
                                    });
                                    
                                    popover.addEventListener('mouseleave', function() {
                                        isOverPopover = false;
                                        // Close after delay when leaving popover
                                        closeTimeout = setTimeout(() => {
                                            if (!isOverPopover) {
                                                popover.remove();
                                            }
                                        }, 300);
                                    });
                                }
                            }, 200);
                        });
                        
                        linkElement.addEventListener('mouseleave', function(e) {
                            clearTimeout(hoverTimeout);
                            
                            // Close popover after delay if not hovering over it
                            closeTimeout = setTimeout(() => {
                                const popover = document.getElementById('email-link-popover');
                                if (popover) {
                                    const popoverRect = popover.getBoundingClientRect();
                                    const mouseX = e.clientX;
                                    const mouseY = e.clientY;
                                    
                                    // Check if mouse is NOT over the popover
                                    const isOverPopover = (
                                        mouseX >= popoverRect.left &&
                                        mouseX <= popoverRect.right &&
                                        mouseY >= popoverRect.top &&
                                        mouseY <= popoverRect.bottom
                                    );
                                    
                                    if (!isOverPopover) {
                                        popover.remove();
                                    }
                                }
                            }, 300);
                        });
                        
                        // Also allow click for mobile/touch devices
                        linkElement.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            clearTimeout(hoverTimeout);
                            showEmailLinkPopover(annotation.url, this);
                        });
                    } else {
                        // Regular URL: Open in new tab
                        linkElement.addEventListener('click', function(e) {
                            e.preventDefault();
                            window.open(annotation.url, '_blank', 'noopener,noreferrer');
                        });
                    }
                    
                    annotationLayerDiv.appendChild(linkElement);
                }
            });
            
            const linkCount = annotations.filter(a => a.subtype === 'Link' && a.url).length;
            const emailCount = annotations.filter(a => a.subtype === 'Link' && a.url && a.url.startsWith('mailto:')).length;
            console.log(`✅ Page ${pageNum}: ${linkCount} links (${emailCount} emails, ${linkCount - emailCount} URLs)`);
        } catch (err) {
            console.log(`No annotations on page ${pageNum}`, err);
        }
        // ===== END INTELLIGENT HYPERLINK ANNOTATION LAYER =====
        
        wrapper.appendChild(pageContainer);
    }
    
    // Add "See Full Media Release" button if in preview mode
    if (!showFullPdf && totalPdfPages > pagesToRender) {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'see-full-release-btn';
        buttonContainer.innerHTML = `
            <button id="see-full-release">
                <i class="fas fa-file-alt"></i>
                See Full Media Release
            </button>
        `;
        wrapper.appendChild(buttonContainer);
        
        // Wire button click
        document.getElementById('see-full-release').addEventListener('click', async () => {
            showFullPdf = true;
            document.getElementById('pdf-viewer-container').classList.remove('preview-mode');
            await renderAllPages();
            updatePdfControls();
        });
    }
    
    isRendering = false;
    
    // Only scroll to page if not initial load (prevents auto-scroll when page first loads)
    if (!isInitialPdfLoad) {
        scrollToPage(currentPdfPage);
    } else {
        // After first render, allow scrolling for subsequent operations
        isInitialPdfLoad = false;
    }
}

// MISSING FUNCTION: openGalleryModal - Required for gallery functionality
function openGalleryModal(releaseTitle, itemsFromPage, itemType = 'image', initialHint = 0) {
    const galleryModal = document.getElementById('imageGalleryModal');
    const galleryModalReleaseTitleEl = document.getElementById('galleryModalReleaseTitle');
    const galleryModalItemCountEl = document.getElementById('galleryModalItemCount');
    const galleryGridSelectAllCheckbox = document.getElementById('galleryGridSelectAllCheckbox');
    
    if (!galleryModal || !itemsFromPage || itemsFromPage.length === 0) return;
    
    currentGalleryItems = itemsFromPage.map(item => {
        let fullUrl = item.path ? `${API_BASE_URL}${item.path}` : (item.full || '');
        let thumbUrl = item.thumbPath ? `${API_BASE_URL}${item.thumbPath}` : (item.path ? `${API_BASE_URL}${item.path}` : (item.thumb || ''));
        
        let isVideoPlaceholderThumb = false;
        if (itemType === 'video') {
            if (item.thumbPath) {
                // We have a generated video thumbnail
                thumbUrl = `${API_BASE_URL}${item.thumbPath}`;
                isVideoPlaceholderThumb = false;
            } else if (!item.thumbPath && (!item.thumb || item.thumb === item.path || item.thumb === fullUrl)) {
                thumbUrl = 'video-placeholder';
                isVideoPlaceholderThumb = true;
            } else if (item.thumb && !item.thumb.startsWith('http') && !item.thumb.includes(API_BASE_URL)) {
                 thumbUrl = `${API_BASE_URL}${item.thumb}`;
            } else if (item.thumb && item.thumb.startsWith('http')) {
                // thumbUrl is already good
            } else {
                thumbUrl = 'video-placeholder';
                isVideoPlaceholderThumb = true;
            }
        } else if (itemType === 'image' && !thumbUrl) {
            thumbUrl = fullUrl;
        }
        return { ...item, full: fullUrl, thumb: thumbUrl, isVideoPlaceholder: isVideoPlaceholderThumb };
    });

    currentGalleryItemType = itemType;
    galleryModalReleaseTitleEl.textContent = releaseTitle;
    galleryModalItemCountEl.textContent = `${currentGalleryItems.length} ${itemType.charAt(0).toUpperCase() + itemType.slice(1)}${(currentGalleryItems.length !== 1 ? 's' : '')}`;
    
    gallerySelectedItems.clear();
    if(galleryGridSelectAllCheckbox) galleryGridSelectAllCheckbox.checked = false;
    renderGalleryGridView();
    
    if (initialHint === 'grid') {
        switchToGalleryView('grid');
    } else if (typeof initialHint === 'number' && initialHint >= 0 && initialHint < currentGalleryItems.length) {
        currentSingleViewIndex = initialHint;
        switchToGalleryView('single');
    } else {
         switchToGalleryView('grid');
    }
    galleryModal.classList.add('open');
}

// Additional missing gallery functions
function renderGalleryGridView() {
    const galleryModalGridViewEl = document.getElementById('galleryModalGridView');
    galleryModalGridViewEl.innerHTML = '';
    if (!currentGalleryItems || currentGalleryItems.length === 0) {
        updateGalleryFooter();
        return;
    }
    currentGalleryItems.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'gallery-grid-item';
        itemEl.dataset.index = index;
        if (gallerySelectedItems.has(index)) {
            itemEl.classList.add('selected');
        }

        const selectorEl = document.createElement('div');
        selectorEl.className = 'gallery-item-selector';
        selectorEl.title = 'Select/Deselect item';
        selectorEl.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleGalleryItemSelection(index, itemEl);
        });
        itemEl.appendChild(selectorEl);

        const thumbWrapper = document.createElement('div');
        thumbWrapper.className = 'thumb-img-wrapper';

        if (item.isVideoPlaceholder || item.thumb === 'video-placeholder') {
            thumbWrapper.classList.add('video-placeholder-grid');
        } else {
            const imgEl = document.createElement('img');
            imgEl.src = item.thumb;
            imgEl.alt = item.altText || item.originalName || `${currentGalleryItemType === 'image' ? 'Image' : 'Video'} ${index + 1}`;
            imgEl.onerror = function() {
                thumbWrapper.innerHTML = '';
                thumbWrapper.classList.add('video-placeholder-grid');
            };
            thumbWrapper.appendChild(imgEl);
        }
        itemEl.appendChild(thumbWrapper);

        const thumbInfoDiv = document.createElement('div');
        thumbInfoDiv.className = 'thumb-info';
        thumbInfoDiv.innerHTML = `<span class="file-size">${item.size ? (item.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}</span><span class="download-icon-thumb" title="Download ${item.originalName || (currentGalleryItemType === 'image' ? 'Image' : 'Video')} (High Res)"><i class="fas fa-download"></i></span>`;
        itemEl.appendChild(thumbInfoDiv);
        
        thumbWrapper.addEventListener('click', () => {
            currentSingleViewIndex = index;
            switchToGalleryView('single');
        });
        
        const downloadIcon = thumbInfoDiv.querySelector('.download-icon-thumb');
        if (downloadIcon) {
            downloadIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                if (item._id) {
                    const downloadUrl = `${API_BASE_URL}/api/v1/center/assets/download/${item._id}`;
                    triggerDownload(downloadUrl, item.originalName || `download.${item.full ? item.full.split('.').pop() : 'file'}`);
                } else {
                    console.error('Asset ID missing for download:', item);
                    alert('Cannot download: Asset ID is missing.');
                }
            });
        }
        galleryModalGridViewEl.appendChild(itemEl);
    });
    updateGalleryFooter();
}

function switchToGalleryView(viewMode) {
    const galleryModalGridViewEl = document.getElementById('galleryModalGridView');
    const galleryModalSingleViewEl = document.getElementById('galleryModalSingleView');
    const galleryGridViewBtn = document.getElementById('gallery-grid-view-btn');
    const gallerySingleViewBtn = document.getElementById('gallery-single-view-btn');
    const galleryModalFooterGrid = document.getElementById('gallery-modal-footer-grid');
    const galleryGridSelectAllBar = document.getElementById('galleryGridSelectAllBar');
    
    if (viewMode === 'grid') {
        galleryModalGridViewEl.style.display = 'grid';
        galleryModalSingleViewEl.style.display = 'none';
        galleryGridViewBtn.classList.add('active');
        gallerySingleViewBtn.classList.remove('active');
        if (galleryModalFooterGrid) galleryModalFooterGrid.style.display = 'flex';
        if (galleryGridSelectAllBar) galleryGridSelectAllBar.style.display = 'flex';
        updateGalleryFooter();
    } else {
        galleryModalGridViewEl.style.display = 'none';
        galleryModalSingleViewEl.style.display = 'flex';
        galleryGridViewBtn.classList.remove('active');
        gallerySingleViewBtn.classList.add('active');
        if (galleryModalFooterGrid) galleryModalFooterGrid.style.display = 'none';
        if (galleryGridSelectAllBar) galleryGridSelectAllBar.style.display = 'none';
        renderGallerySingleItem(currentSingleViewIndex);
    }
}

function updateGalleryFooter() {
    const downloadSelectedGalleryItemsBtn = document.getElementById('downloadSelectedGalleryItemsBtn');
    const gallerySelectedCountDisplay = document.getElementById('gallerySelectedCountDisplay');
    const galleryItemsSelectedCountFooterText = document.getElementById('galleryItemsSelectedCount');
    const galleryGridSelectAllCheckbox = document.getElementById('galleryGridSelectAllCheckbox');
    
    if (!downloadSelectedGalleryItemsBtn || !gallerySelectedCountDisplay || !galleryItemsSelectedCountFooterText) return;
    const selectedCount = gallerySelectedItems.size;
    gallerySelectedCountDisplay.textContent = selectedCount;
    galleryItemsSelectedCountFooterText.textContent = selectedCount;
    downloadSelectedGalleryItemsBtn.disabled = selectedCount === 0;

    if (galleryGridSelectAllCheckbox) {
         const totalItems = currentGalleryItems.length;
         galleryGridSelectAllCheckbox.disabled = totalItems === 0;
        if (totalItems > 0 && selectedCount === totalItems) {
            galleryGridSelectAllCheckbox.checked = true;
            galleryGridSelectAllCheckbox.indeterminate = false;
        } else if (selectedCount > 0 && selectedCount < totalItems) {
            galleryGridSelectAllCheckbox.checked = false;
            galleryGridSelectAllCheckbox.indeterminate = true;
        } else {
            galleryGridSelectAllCheckbox.checked = false;
            galleryGridSelectAllCheckbox.indeterminate = false;
        }
    }
}

function toggleGalleryItemSelection(index, itemEl) {
    if (gallerySelectedItems.has(index)) {
        gallerySelectedItems.delete(index);
        itemEl.classList.remove('selected');
    } else {
        gallerySelectedItems.add(index);
        itemEl.classList.add('selected');
    }
    updateGalleryFooter();
}

// ===== GALLERY MODAL CLOSE =====
function closeGalleryModal() {
    const galleryModal = document.getElementById('imageGalleryModal');
    if (galleryModal) {
        galleryModal.classList.remove('open');
        gallerySelectedItems.clear();
    }
}

// ===== SHARE MODAL OPEN/CLOSE =====
function openShareModal() {
    const shareModal = document.getElementById('shareReleaseModal');
    if (shareModal) {
        shareModal.classList.add('open');
        setupShareModal();
    }
}

function closeShareModal() {
    const shareModal = document.getElementById('shareReleaseModal');
    if (shareModal) shareModal.classList.remove('open');
}

// ===== WIRE ALL MODAL EVENT LISTENERS (called once after page load) =====
function wireGalleryModalEvents() {
    const galleryModal = document.getElementById('imageGalleryModal');
    const closeGalleryModalBtn = document.getElementById('closeImageGalleryModalBtn');
    const galleryGridViewBtn = document.getElementById('gallery-grid-view-btn');
    const gallerySingleViewBtn = document.getElementById('gallery-single-view-btn');
    const galleryShareBtn = document.getElementById('gallery-share-btn');
    const galleryCarouselPrevBtn = document.getElementById('galleryCarouselPrev');
    const galleryCarouselNextBtn = document.getElementById('galleryCarouselNext');
    const galleryGridSelectAllCheckbox = document.getElementById('galleryGridSelectAllCheckbox');
    const downloadSelectedGalleryItemsBtn = document.getElementById('downloadSelectedGalleryItemsBtn');
    const shareModal = document.getElementById('shareReleaseModal');
    const shareActionBtn = document.getElementById('share-release-btn');
    const closeShareModalBtn = document.getElementById('closeShareModalBtn');

    // --- Gallery view toggle buttons ---
    if (galleryGridViewBtn) galleryGridViewBtn.addEventListener('click', () => switchToGalleryView('grid'));
    if (gallerySingleViewBtn) gallerySingleViewBtn.addEventListener('click', () => switchToGalleryView('single'));

    // --- Gallery share button opens the share modal ---
    if (galleryShareBtn) galleryShareBtn.addEventListener('click', (e) => { e.stopPropagation(); openShareModal(); });

    // --- Gallery close: X button + backdrop click ---
    if (closeGalleryModalBtn) closeGalleryModalBtn.addEventListener('click', closeGalleryModal);
    if (galleryModal) galleryModal.addEventListener('click', (e) => { if (e.target === galleryModal) closeGalleryModal(); });

    // --- Gallery single-view carousel prev/next ---
    if (galleryCarouselPrevBtn) galleryCarouselPrevBtn.addEventListener('click', () => {
        if (currentSingleViewIndex > 0) renderGallerySingleItem(currentSingleViewIndex - 1);
    });
    if (galleryCarouselNextBtn) galleryCarouselNextBtn.addEventListener('click', () => {
        if (currentSingleViewIndex < currentGalleryItems.length - 1) renderGallerySingleItem(currentSingleViewIndex + 1);
    });

    // --- Select All / Deselect All checkbox ---
    if (galleryGridSelectAllCheckbox) {
        galleryGridSelectAllCheckbox.addEventListener('change', (event) => {
            const isChecked = event.target.checked;
            document.querySelectorAll('#galleryModalGridView .gallery-grid-item').forEach((itemEl) => {
                const idx = parseInt(itemEl.dataset.index);
                if (isChecked) {
                    gallerySelectedItems.add(idx);
                    itemEl.classList.add('selected');
                } else {
                    gallerySelectedItems.delete(idx);
                    itemEl.classList.remove('selected');
                }
            });
            updateGalleryFooter();
        });
    }

    // --- Download Selected button ---
    if (downloadSelectedGalleryItemsBtn) {
        downloadSelectedGalleryItemsBtn.addEventListener('click', () => {
            if (gallerySelectedItems.size === 0) {
                showToast('No items selected for download.', 'warning');
                return;
            }
            const itemsToDownload = Array.from(gallerySelectedItems).map(index => currentGalleryItems[index]);
            showToast(`Downloading ${itemsToDownload.length} item(s)...`, 'info');
            itemsToDownload.forEach((item, i) => {
                setTimeout(() => {
                    if (item._id) {
                        const downloadUrl = `${API_BASE_URL}/api/v1/center/assets/download/${item._id}`;
                        triggerDownload(downloadUrl, item.originalName || `download_${i + 1}`);
                    } else {
                        console.error('Asset ID missing for selected download:', item);
                        showToast(`Cannot download ${item.originalName || 'item ' + (i + 1)}: Asset ID missing.`, 'error');
                    }
                }, i * 300);
            });
        });
    }

    // --- Share modal: page-level share button + close + backdrop ---
    if (shareActionBtn) shareActionBtn.addEventListener('click', openShareModal);
    if (closeShareModalBtn) closeShareModalBtn.addEventListener('click', closeShareModal);
    if (shareModal) shareModal.addEventListener('click', (e) => { if (e.target === shareModal) closeShareModal(); });

    // --- Escape key closes any open modal ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeGalleryModal();
            closeShareModal();
        }
    });
}

function renderGallerySingleItem(index) {
    const gallerySingleImagePreviewContainerEl = document.getElementById('gallerySingleImagePreviewContainer');
    const gallerySingleImagePreviewEl = document.getElementById('gallerySingleImagePreview');
    const gallerySingleItemNameEl = document.getElementById('gallerySingleItemName');
    const gallerySingleItemDateEl = document.getElementById('gallerySingleItemDate');
    const galleryLowResSizeEl = document.getElementById('galleryLowResSize');
    const galleryHighResSizeEl = document.getElementById('galleryHighResSize');
    const lowResBtnTextEl = document.getElementById('lowResBtnText');
    const highResBtnTextEl = document.getElementById('highResBtnText');
    const galleryDownloadLowResBtn = document.getElementById('galleryDownloadLowRes');
    const galleryDownloadHighResBtn = document.getElementById('galleryDownloadHighRes');
    const galleryCarouselCounterEl = document.getElementById('galleryCarouselCounter');
    const galleryCarouselPrevBtn = document.getElementById('galleryCarouselPrev');
    const galleryCarouselNextBtn = document.getElementById('galleryCarouselNext');
    
    if (index < 0 || !currentGalleryItems || index >= currentGalleryItems.length) return;
    currentSingleViewIndex = index;
    const item = currentGalleryItems[index];
    
    gallerySingleImagePreviewContainerEl.innerHTML = '';
    gallerySingleImagePreviewContainerEl.style.cursor = 'default';
    gallerySingleImagePreviewContainerEl.onclick = null;

    if (currentGalleryItemType === 'video') {
        const videoEl = document.createElement('video');
        videoEl.src = item.full;
        videoEl.controls = true;
        videoEl.setAttribute('style', 'width: 100%; height: 100%; object-fit: contain; border-radius: 4px;');
        if (item.thumbPath) {
            videoEl.poster = `${API_BASE_URL}${item.thumbPath}`;
        } else if (item.thumb && item.thumb !== 'video-placeholder' && !item.isVideoPlaceholder) {
             videoEl.poster = item.thumb;
        }
        gallerySingleImagePreviewContainerEl.appendChild(videoEl);
        
        if(lowResBtnTextEl) lowResBtnTextEl.textContent = 'SD (MP4)';
        if(highResBtnTextEl) highResBtnTextEl.textContent = 'HD (MP4)';
    } else {
        gallerySingleImagePreviewEl.src = item.full;
        gallerySingleImagePreviewEl.alt = item.altText || item.originalName || 'Large preview';
        if(!gallerySingleImagePreviewContainerEl.contains(gallerySingleImagePreviewEl)){
             gallerySingleImagePreviewContainerEl.appendChild(gallerySingleImagePreviewEl);
        }
        if(lowResBtnTextEl) lowResBtnTextEl.textContent = 'LowRes (JPG)';
        if(highResBtnTextEl) highResBtnTextEl.textContent = 'HighRes (JPG)';
    }

    gallerySingleItemNameEl.textContent = item.originalName || `${currentGalleryItemType.charAt(0).toUpperCase() + currentGalleryItemType.slice(1)} ${index + 1}`;
    gallerySingleItemDateEl.textContent = item.uploadDate ? new Date(item.uploadDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : (item.date ? new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
    galleryLowResSizeEl.textContent = item.lowResSize || (item.size ? (item.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A');
    galleryHighResSizeEl.textContent = item.highResSize || (item.size ? (item.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A');
    
    galleryDownloadLowResBtn.onclick = () => {
        if (item._id) {
            const downloadUrl = `${API_BASE_URL}/api/v1/center/assets/download/${item._id}`;
            triggerDownload(downloadUrl, `lowres_${item.originalName || 'download'}`);
        } else {
            console.error('Asset ID missing for low-res download:', item);
            alert('Cannot download: Asset ID is missing.');
        }
    };
    galleryDownloadHighResBtn.onclick = () => {
        if (item._id) {
            const downloadUrl = `${API_BASE_URL}/api/v1/center/assets/download/${item._id}`;
            triggerDownload(downloadUrl, item.originalName || `highres_download`);
        } else {
            console.error('Asset ID missing for high-res download:', item);
            alert('Cannot download: Asset ID is missing.');
        }
    };
    
    galleryCarouselCounterEl.textContent = `${index + 1} of ${currentGalleryItems.length}`;
    galleryCarouselPrevBtn.disabled = index === 0;
    galleryCarouselNextBtn.disabled = index === currentGalleryItems.length - 1;
}

// Additional missing PDF functions
// ===== PDF CONTROL BAR HOVER FUNCTIONALITY =====
let isControlBarVisible = true;
let hideTimeout = null;
let maxVisibleTimeout = null;

function initSlideControls() {
    const wrapper = document.getElementById('pdf-viewer-wrapper');
    const controlBar = document.querySelector('.pdf-control-bar');
    
    if (!wrapper || !controlBar) {
        console.error('Slide controls: wrapper or control bar not found');
        return;
    }
    
    // ✅ TOUCH DEVICE DETECTION - Don't auto-hide on touch devices
    const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    
    if (isTouchDevice) {
        // Touch device: Keep control bar visible always
        console.log('✅ Touch device detected - control bar always visible');
        controlBar.classList.remove('control-bar-hidden');
        isControlBarVisible = true;
        return; // Exit - no hover behavior on touch
    }
    
    // DESKTOP ONLY: Hover behavior
    console.log('🖱️ Desktop detected - enabling hover slide controls');
    
    // Initially hidden on page load
    controlBar.classList.add('control-bar-hidden');
    isControlBarVisible = false;
    console.log('🔼 Control bar initially hidden');
    
    // Mouse enters wrapper area - show control bar
    wrapper.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
        clearTimeout(maxVisibleTimeout);
        
        if (!isControlBarVisible) {
            controlBar.classList.remove('control-bar-hidden');
            isControlBarVisible = true;
            console.log('🔽 Control bar shown (mouse entered)');
        }
        
        // Auto-hide after 3 seconds (even if mouse stays)
        maxVisibleTimeout = setTimeout(() => {
            controlBar.classList.add('control-bar-hidden');
            isControlBarVisible = false;
            console.log('🔼 Control bar FORCE hidden (3s timeout)');
        }, 3000);
    });
    
    // Mouse leaves wrapper - hide quickly
    wrapper.addEventListener('mouseleave', () => {
        clearTimeout(hideTimeout);
        clearTimeout(maxVisibleTimeout);
        hideTimeout = setTimeout(() => {
            controlBar.classList.add('control-bar-hidden');
            isControlBarVisible = false;
            console.log('🔼 Control bar hidden (mouse left)');
        }, 500);
    });
    
    // Hovering control bar itself - keep visible
    controlBar.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
        clearTimeout(maxVisibleTimeout);
        
        if (!isControlBarVisible) {
            controlBar.classList.remove('control-bar-hidden');
            isControlBarVisible = true;
            console.log('🔽 Control bar shown (hovering bar)');
        }
        
        // Force hide after 5 seconds even if hovering
        maxVisibleTimeout = setTimeout(() => {
            controlBar.classList.add('control-bar-hidden');
            isControlBarVisible = false;
            console.log('🔼 Control bar FORCE hidden (5s on bar)');
        }, 5000);
    });
    
    // Leaving control bar - hide quickly
    controlBar.addEventListener('mouseleave', () => {
        clearTimeout(hideTimeout);
        clearTimeout(maxVisibleTimeout);
        
        hideTimeout = setTimeout(() => {
            controlBar.classList.add('control-bar-hidden');
            isControlBarVisible = false;
            console.log('🔼 Control bar hidden (left bar)');
        }, 1000);
    });
    
    // PDF navigation buttons - show control bar when clicked
    const navBtns = document.querySelectorAll('.pdf-nav-btn, .pdf-zoom-btn, .pdf-action-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            clearTimeout(hideTimeout);
            clearTimeout(maxVisibleTimeout);
            
            if (!isControlBarVisible) {
                controlBar.classList.remove('control-bar-hidden');
                isControlBarVisible = true;
                console.log('🔽 Control bar shown (button clicked)');
            }
            
            // Keep visible for 2 seconds after click
            maxVisibleTimeout = setTimeout(() => {
                controlBar.classList.add('control-bar-hidden');
                isControlBarVisible = false;
                console.log('🔼 Control bar hidden (2s after click)');
            }, 2000);
        });
    });
}

function setupPdfControls() {
    const prevBtn = document.getElementById('pdf-prev-page');
    const nextBtn = document.getElementById('pdf-next-page');
    const zoomInBtn = document.getElementById('pdf-zoom-in');
    const zoomOutBtn = document.getElementById('pdf-zoom-out');
    const printBtn = document.getElementById('pdf-print-btn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPdfPage > 1) {
                currentPdfPage--;
                scrollToPage(currentPdfPage);
                updatePdfControls();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPdfPage < totalPdfPages) {
                currentPdfPage++;
                scrollToPage(currentPdfPage);
                updatePdfControls();
            }
        });
    }
    
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', async () => {
            if (currentScale < 2.0) {
                currentScale += 0.25;
                await renderAllPages();
                updatePdfControls();
            }
        });
    }
    
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', async () => {
            if (currentScale > 0.5) {
                currentScale -= 0.25;
                await renderAllPages();
                updatePdfControls();
            }
        });
    }
    
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            if (currentPdfUrl) {
                const printWindow = window.open(currentPdfUrl, '_blank');
                if (printWindow) {
                    printWindow.addEventListener('load', () => {
                        printWindow.print();
                    });
                }
            } else {
                window.print();
            }
        });
    }

    // ===== TEXT-TO-SPEECH =====
    const ttsBtn = document.getElementById('pdf-tts-btn');
    if (ttsBtn) {
        ttsBtn.addEventListener('click', async () => {
            if (!pdfDoc) { showToast('PDF not loaded yet.', 'warning'); return; }
            if (!speechSynthesis) { showToast('Text-to-speech not supported in this browser.', 'error'); return; }

            if (isSpeaking) {
                speechSynthesis.cancel();
                isSpeaking = false;
                ttsBtn.classList.remove('tts-active');
                ttsBtn.title = 'Read Aloud';
                showToast('Stopped reading.', 'info');
            } else {
                try {
                    ttsBtn.disabled = true;
                    ttsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                    let allText = '';
                    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
                        const page = await pdfDoc.getPage(pageNum);
                        const textContent = await page.getTextContent();
                        allText += textContent.items.map(item => item.str).join(' ') + '. ';
                    }
                    allText = allText.replace(/\s+/g, ' ').replace(/\.{2,}/g, '.').trim();

                    currentUtterance = new SpeechSynthesisUtterance(allText);
                    currentUtterance.rate = 1.0;
                    currentUtterance.pitch = 1.0;
                    currentUtterance.volume = 1.0;

                    const voices = speechSynthesis.getVoices();
                    const englishVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
                    if (englishVoice) currentUtterance.voice = englishVoice;

                    currentUtterance.onend = () => {
                        isSpeaking = false;
                        ttsBtn.classList.remove('tts-active');
                        ttsBtn.title = 'Read Aloud';
                        ttsBtn.disabled = false;
                        ttsBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
                        showToast('Finished reading.', 'success');
                    };
                    currentUtterance.onerror = () => {
                        isSpeaking = false;
                        ttsBtn.classList.remove('tts-active');
                        ttsBtn.title = 'Read Aloud';
                        ttsBtn.disabled = false;
                        ttsBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
                        showToast('Reading error occurred.', 'error');
                    };

                    speechSynthesis.speak(currentUtterance);
                    isSpeaking = true;
                    ttsBtn.classList.add('tts-active');
                    ttsBtn.title = 'Stop Reading';
                    ttsBtn.disabled = false;
                    ttsBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
                    showToast('Reading aloud...', 'info');
                } catch (error) {
                    console.error('TTS error:', error);
                    showToast('Failed to start reading.', 'error');
                    ttsBtn.disabled = false;
                    ttsBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
                }
            }
        });
    }

    // ===== COPY ALL TEXT =====
    const copyAllBtn = document.getElementById('pdf-copy-all-btn');
    if (copyAllBtn) {
        copyAllBtn.addEventListener('click', async () => {
            if (!pdfDoc) { showToast('PDF not loaded yet.', 'warning'); return; }
            try {
                copyAllBtn.disabled = true;
                copyAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                let allText = '';
                for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
                    const page = await pdfDoc.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    allText += textContent.items.map(item => item.str).join(' ') + '\n\n';
                }
                allText = allText.replace(/\n{3,}/g, '\n\n').trim();
                await navigator.clipboard.writeText(allText);
                const wordCount = allText.split(/\s+/).length;
                showToast(`Copied ${wordCount.toLocaleString()} words to clipboard.`, 'success');
                copyAllBtn.disabled = false;
                copyAllBtn.innerHTML = '<i class="fas fa-copy"></i>';
            } catch (error) {
                console.error('Copy all text error:', error);
                showToast('Failed to copy text.', 'error');
                copyAllBtn.disabled = false;
                copyAllBtn.innerHTML = '<i class="fas fa-copy"></i>';
            }
        });
    }

    // ===== PDF SEARCH =====
    const searchBtn = document.getElementById('pdf-search-btn');
    const searchBox = document.getElementById('pdf-search-box');
    const searchInput = document.getElementById('pdf-search-input');
    const searchCloseBtn = document.getElementById('pdf-search-close');
    const searchCount = document.getElementById('pdf-search-count');

    if (searchBtn && searchBox && searchInput) {
        // Toggle search box open/close
        searchBtn.addEventListener('click', () => {
            const isHidden = searchBox.style.display === 'none' || searchBox.style.display === '';
            searchBox.style.display = isHidden ? 'flex' : 'none';
            if (isHidden) {
                searchInput.focus();
            } else {
                searchInput.value = '';
                clearSearch();
            }
        });

        // Close button
        if (searchCloseBtn) {
            searchCloseBtn.addEventListener('click', () => {
                searchBox.style.display = 'none';
                searchInput.value = '';
                clearSearch();
            });
        }

        // Instant clear when input is emptied
        searchInput.addEventListener('input', () => {
            if (searchInput.value.trim() === '') {
                clearSearch();
            }
        });

        // Debounced search on input (fires after user pauses typing)
        searchInput.addEventListener('input', debounce(async () => {
            const keyword = searchInput.value.trim();
            if (keyword.length < 3) { clearSearch(); return; }
            await performSearch(keyword);
        }, 1000));

        // Enter = next match, Shift+Enter = previous match
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (searchMatches.length > 0) {
                    e.shiftKey ? goToPrevMatch() : goToNextMatch();
                }
            }
        });
    }
}

function updatePdfControls() {
    const currentPageEl = document.getElementById('pdf-current-page');
    const zoomLevelEl = document.getElementById('pdf-zoom-level');
    const prevBtn = document.getElementById('pdf-prev-page');
    const nextBtn = document.getElementById('pdf-next-page');
    const zoomOutBtn = document.getElementById('pdf-zoom-out');
    const zoomInBtn = document.getElementById('pdf-zoom-in');
    
    if (currentPageEl) currentPageEl.textContent = currentPdfPage;
    if (zoomLevelEl) zoomLevelEl.textContent = Math.round(currentScale * 100) + '%';
    
    if (prevBtn) prevBtn.disabled = currentPdfPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPdfPage >= totalPdfPages;
    if (zoomOutBtn) zoomOutBtn.disabled = currentScale <= 0.5;
    if (zoomInBtn) zoomInBtn.disabled = currentScale >= 2.0;
}

function scrollToPage(pageNum) {
    const wrapper = document.getElementById('pdf-viewer-wrapper');
    const pageContainer = wrapper.querySelector(`.pdf-page-container[data-page-number="${pageNum}"]`);
    if (pageContainer) pageContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== PDF SEARCH HELPER FUNCTIONS =====

function createHighlightLayer(pageContainer) {
    let highlightLayer = pageContainer.querySelector('.searchHighlightLayer');
    if (!highlightLayer) {
        highlightLayer = document.createElement('div');
        highlightLayer.className = 'searchHighlightLayer';
        pageContainer.appendChild(highlightLayer);
    }
    return highlightLayer;
}

function clearAllHighlights() {
    document.querySelectorAll('.searchHighlightLayer').forEach(layer => { layer.innerHTML = ''; });
}

async function drawHighlights(keyword) {
    if (!pdfDoc || searchMatches.length === 0) return;
    clearAllHighlights();

    // Group matches by page
    const matchesByPage = {};
    searchMatches.forEach((match, index) => {
        if (!matchesByPage[match.pageNum]) matchesByPage[match.pageNum] = [];
        matchesByPage[match.pageNum].push({ match, index });
    });

    for (const [pageNum, matches] of Object.entries(matchesByPage)) {
        const pageContainer = document.querySelector(`.pdf-page-container[data-page-number="${pageNum}"]`);
        if (!pageContainer) continue;

        const highlightLayer = createHighlightLayer(pageContainer);
        const canvas = pageContainer.querySelector('.pdf-canvas');
        if (!canvas) continue;

        const canvasWidth = parseFloat(canvas.style.width);
        const canvasHeight = parseFloat(canvas.style.height);
        const page = await pdfDoc.getPage(parseInt(pageNum));
        const viewport = page.getViewport({ scale: currentScale });

        for (const { match, index } of matches) {
            const highlightDiv = document.createElement('div');
            highlightDiv.className = 'searchHighlight';
            highlightDiv.dataset.matchIndex = index;

            const transform = match.transform;
            const baseX = transform[4];
            const y = transform[5];

            // Word-level highlight: estimate character positions
            const fullTextLength = match.fullText.length;
            const charWidth = fullTextLength > 0 ? (match.width / fullTextLength) : 0;
            const offsetX = match.matchStart * charWidth;
            const matchedWordWidth = match.matchLength * charWidth;
            const wordX = baseX + offsetX;

            let left = (wordX / viewport.width) * canvasWidth;
            const top = canvasHeight - ((y / viewport.height) * canvasHeight) - (match.height * currentScale);
            let width = (matchedWordWidth / viewport.width) * canvasWidth * currentScale;
            const height = match.height * currentScale;

            // Small padding so highlight fully covers the word
            const pad = 2;
            left -= pad;
            width = (width * 1.1) + (pad * 2);

            highlightDiv.style.left = `${left}px`;
            highlightDiv.style.top = `${top}px`;
            highlightDiv.style.width = `${width}px`;
            highlightDiv.style.height = `${height}px`;

            if (index === currentSearchIndex) highlightDiv.classList.add('current');
            highlightLayer.appendChild(highlightDiv);
        }
    }
}

function updateHighlightStates() {
    document.querySelectorAll('.searchHighlight').forEach(h => h.classList.remove('current'));
    if (currentSearchIndex >= 0) {
        const current = document.querySelector(`.searchHighlight[data-match-index="${currentSearchIndex}"]`);
        if (current) current.classList.add('current');
    }
}

async function performSearch(keyword) {
    if (!pdfDoc) return;
    clearSearch();
    searchMatches = [];

    try {
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();

            textContent.items.forEach((item) => {
                const textLower = item.str.toLowerCase();
                const searchTerm = keyword.toLowerCase();
                let startIndex = 0;
                while ((startIndex = textLower.indexOf(searchTerm, startIndex)) !== -1) {
                    searchMatches.push({
                        pageNum: pageNum,
                        transform: item.transform,
                        width: item.width,
                        height: item.height,
                        matchStart: startIndex,
                        matchLength: searchTerm.length,
                        fullText: item.str
                    });
                    startIndex += searchTerm.length;
                }
            });
        }

        updateSearchUI();

        if (searchMatches.length > 0) {
            currentSearchIndex = 0;
            await drawHighlights(keyword);
            highlightCurrentMatch();
            showToast(`Found ${searchMatches.length} match${searchMatches.length !== 1 ? 'es' : ''}.`, 'info');
        } else {
            showToast('No matches found.', 'info');
        }
    } catch (error) {
        console.error('PDF search error:', error);
    }
}

function updateSearchUI() {
    const searchCount = document.getElementById('pdf-search-count');
    if (searchCount) {
        searchCount.textContent = searchMatches.length > 0 ? `${currentSearchIndex + 1}/${searchMatches.length}` : '0/0';
    }
}

function goToNextMatch() {
    if (searchMatches.length === 0) return;
    currentSearchIndex = (currentSearchIndex + 1) % searchMatches.length;
    highlightCurrentMatch();
}

function goToPrevMatch() {
    if (searchMatches.length === 0) return;
    currentSearchIndex = (currentSearchIndex - 1 + searchMatches.length) % searchMatches.length;
    highlightCurrentMatch();
}

function highlightCurrentMatch() {
    if (currentSearchIndex < 0 || currentSearchIndex >= searchMatches.length) return;
    const match = searchMatches[currentSearchIndex];
    updateHighlightStates();
    scrollToPage(match.pageNum);
    updateSearchUI();
}

function clearSearch() {
    searchMatches = [];
    currentSearchIndex = -1;
    clearAllHighlights();
    updateSearchUI();
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// ===== INITIALIZATION HELPER =====
window.initializeReleaseDetailPage = initializePage;

// ===== ENTERPRISE EMAIL LINK POPOVER =====
// Handles email links with professional UI: copy address, send email, or message internal users
async function showEmailLinkPopover(mailtoUrl, anchorElement) {
    // Close any existing popover
    const existing = document.getElementById('email-link-popover');
    if (existing) existing.remove();
    
    // Extract email address from mailto: URL
    const emailMatch = mailtoUrl.match(/mailto:([^?]+)/i);
    if (!emailMatch) return;
    
    const emailAddress = emailMatch[1].trim();
    
    // Create popover container with subtle blue corporate accent
    const popover = document.createElement('div');
    popover.id = 'email-link-popover';
    popover.className = 'email-popover';
    
    // Position popover near the clicked link
    const rect = anchorElement.getBoundingClientRect();
    popover.style.cssText = `
        position: fixed;
        left: ${rect.left}px;
        top: ${rect.bottom + 8}px;
        background: white;
        border: 2px solid #3b82f6;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(59, 130, 246, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08);
        z-index: 10000;
        min-width: 280px;
        max-width: 320px;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        animation: popoverSlideIn 0.15s ease-out;
    `;
    
    // Add subtle animation keyframes if not already present
    if (!document.getElementById('popover-animations')) {
        const style = document.createElement('style');
        style.id = 'popover-animations';
        style.textContent = `
            @keyframes popoverSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-4px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Check if email belongs to an internal user
    const internalUser = await checkInternalUser(emailAddress);
    
    if (internalUser) {
        // Show user profile card
        popover.innerHTML = `
            <div style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 20px;">
                        ${internalUser.initials}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 15px; color: #111827;">${internalUser.name}</div>
                        <div style="font-size: 13px; color: #6b7280;">${emailAddress}</div>
                        ${internalUser.role ? `<div style="font-size: 12px; color: #9ca3af; margin-top: 2px;">${internalUser.role}</div>` : ''}
                    </div>
                </div>
            </div>
            <div style="padding: 8px;">
                <button class="popover-action-btn" data-action="message" style="width: 100%; padding: 10px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-weight: 500; font-size: 14px; cursor: pointer; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.2s;">
                    <i class="fas fa-comment" style="font-size: 14px;"></i>
                    Message ${internalUser.firstName}
                </button>
                <button class="popover-action-btn" data-action="copy" style="width: 100%; padding: 10px 16px; background: white; color: #374151; border: 1px solid #3b82f6; border-radius: 6px; font-weight: 500; font-size: 14px; cursor: pointer; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
                    <i class="fas fa-copy" style="font-size: 14px; color: #3b82f6;"></i>
                    Copy Address
                </button>
                <button class="popover-action-btn" data-action="email" style="width: 100%; padding: 10px 16px; background: white; color: #374151; border: 1px solid #d1d5db; border-radius: 6px; font-weight: 500; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
                    <i class="fas fa-envelope" style="font-size: 14px; color: #3b82f6;"></i>
                    Send Email
                </button>
            </div>
        `;
    } else {
        // Show standard email actions
        popover.innerHTML = `
            <div style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
                <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">Email Contact</div>
                <div style="font-weight: 500; font-size: 14px; color: #111827; word-break: break-all;">${emailAddress}</div>
            </div>
            <div style="padding: 8px;">
                <button class="popover-action-btn" data-action="copy" style="width: 100%; padding: 10px 16px; background: white; color: #374151; border: 1px solid #3b82f6; border-radius: 6px; font-weight: 500; font-size: 14px; cursor: pointer; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
                    <i class="fas fa-copy" style="font-size: 14px; color: #3b82f6;"></i>
                    Copy Address
                </button>
                <button class="popover-action-btn" data-action="email" style="width: 100%; padding: 10px 16px; background: white; color: #374151; border: 1px solid #d1d5db; border-radius: 6px; font-weight: 500; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
                    <i class="fas fa-envelope" style="font-size: 14px; color: #3b82f6;"></i>
                    Send Email
                </button>
            </div>
        `;
    }
    
    document.body.appendChild(popover);
    
    // Add hover effects to buttons
    popover.querySelectorAll('.popover-action-btn').forEach(btn => {
        btn.addEventListener('mouseenter', function() {
            if (this.dataset.action === 'message') {
                this.style.background = '#2563eb';
            } else {
                this.style.background = '#f9fafb';
            }
        });
        btn.addEventListener('mouseleave', function() {
            if (this.dataset.action === 'message') {
                this.style.background = '#3b82f6';
            } else {
                this.style.background = 'white';
            }
        });
    });
    
    // Handle button clicks
    popover.querySelectorAll('.popover-action-btn').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.stopPropagation();
            const action = this.dataset.action;
            
            if (action === 'copy') {
                try {
                    await navigator.clipboard.writeText(emailAddress);
                    showToast('Email address copied to clipboard!', 'success');
                    popover.remove();
                } catch (err) {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = emailAddress;
                    textArea.style.position = 'fixed';
                    textArea.style.opacity = '0';
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    showToast('Email address copied!', 'success');
                    popover.remove();
                }
            } else if (action === 'email') {
                window.location.href = mailtoUrl;
                popover.remove();
            } else if (action === 'message') {
                // Internal messaging - redirect to messaging system
                if (internalUser && internalUser.userId) {
                    // TODO: Integrate with your internal messaging system
                    showToast(`Opening conversation with ${internalUser.firstName}...`, 'info');
                    // window.location.href = `/messages?user=${internalUser.userId}`;
                }
                popover.remove();
            }
        });
    });
    
    // Close popover when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closePopover(e) {
            if (!popover.contains(e.target)) {
                popover.remove();
                document.removeEventListener('click', closePopover);
            }
        });
    }, 100);
    
    // Adjust position if popover goes off-screen
    setTimeout(() => {
        const popoverRect = popover.getBoundingClientRect();
        if (popoverRect.right > window.innerWidth) {
            popover.style.left = (window.innerWidth - popoverRect.width - 20) + 'px';
        }
        if (popoverRect.bottom > window.innerHeight) {
            popover.style.top = (rect.top - popoverRect.height - 8) + 'px';
        }
    }, 10);
}

// Check if email belongs to an internal user in the system
async function checkInternalUser(email) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        if (!token) return null;
        
        const response = await fetch(`${API_BASE_URL}/api/v1/center/users/lookup-by-email?email=${encodeURIComponent(email)}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) return null;
        
        const data = await response.json();
        if (data.success && data.user) {
            const user = data.user;
            const nameParts = user.name ? user.name.split(' ') : ['User'];
            const firstName = nameParts[0];
            const initials = nameParts.length > 1 
                ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
                : nameParts[0].substring(0, 2).toUpperCase();
            
            return {
                userId: user._id || user.id,
                name: user.name || email,
                firstName: firstName,
                initials: initials,
                role: user.role || user.title || null,
                avatar: user.avatar || null
            };
        }
        
        return null;
    } catch (error) {
        console.log('Could not check internal user:', error);
        return null;
    }
}

console.log('✅ AMC Release Detail Functionality loaded successfully');