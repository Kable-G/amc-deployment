/**
 * ═══════════════════════════════════════════════════════════════
 * AMC ARTICLE RENDERER COMPONENT
 * Converts PDF content to readable HTML article format
 * Handles "Read More" functionality and content extraction
 * ═══════════════════════════════════════════════════════════════
 */

class AMCArticleRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.releaseData = null;
        this.isExpanded = false;
        this.summaryPageLimit = 3; // Show first 3 pages as summary
        
        if (!this.container) {
            console.error('AMCArticleRenderer: Container not found:', containerId);
            return;
        }
        
        this.init();
    }
    
    init() {
        // Hide the main text content when article is active
        this.hideTextContent();
    }
    
    hideTextContent() {
        const mainContent = document.querySelector('.pr-main-text-content');
        if (mainContent) {
            mainContent.classList.add('article-active');
        }
    }
    
    async loadRelease(releaseData) {
        this.releaseData = releaseData;
        
        // Try to extract PDF content first
        if (releaseData.uuid) {
            const extractedContent = await this.extractPDFContent(releaseData.uuid);
            if (extractedContent) {
                this.renderArticle(extractedContent);
                return;
            }
        }
        
        // Fallback to existing text content
        this.renderFromExistingContent(releaseData);
    }
    
    async extractPDFContent(releaseUuid) {
        try {
            const API_BASE_URL = 'http://localhost:5000';
            const headers = { 'Content-Type': 'application/json' };
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch(`${API_BASE_URL}/api/v1/center/releases/${releaseUuid}/extract-pdf-text`, { headers });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data.extractedText) {
                    return this.processPDFText(result.data.extractedText);
                }
            }
        } catch (error) {
            console.error('Error extracting PDF content:', error);
        }
        return null;
    }
    
    processPDFText(extractedText) {
        // Split text into paragraphs
        const paragraphs = extractedText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        
        if (paragraphs.length === 0) return null;
        
        // First paragraph is the lead
        const lead = paragraphs[0].trim();
        
        // Estimate pages (roughly 500 characters per page)
        const charsPerPage = 500;
        let currentLength = 0;
        let summaryParagraphs = [];
        let fullContentParagraphs = [];
        
        for (let i = 1; i < paragraphs.length; i++) {
            const paragraph = paragraphs[i].trim();
            currentLength += paragraph.length;
            
            if (currentLength <= charsPerPage * this.summaryPageLimit) {
                summaryParagraphs.push(paragraph);
            } else {
                fullContentParagraphs.push(paragraph);
            }
        }
        
        return {
            lead: lead,
            summary: summaryParagraphs,
            fullContent: fullContentParagraphs,
            keyFacts: this.extractKeyFacts(paragraphs)
        };
    }
    
    extractKeyFacts(paragraphs) {
        const facts = [];
        const factPatterns = [
            /price[:\s]+([^.\n]+)/i,
            /launch[:\s]+([^.\n]+)/i,
            /availability[:\s]+([^.\n]+)/i,
            /engine[:\s]+([^.\n]+)/i,
            /power[:\s]+([^.\n]+)/i,
            /range[:\s]+([^.\n]+)/i,
            /acceleration[:\s]+([^.\n]+)/i,
            /top speed[:\s]+([^.\n]+)/i
        ];
        
        paragraphs.forEach(paragraph => {
            factPatterns.forEach(pattern => {
                const match = paragraph.match(pattern);
                if (match) {
                    const label = pattern.source.split('[')[0].replace(/\\/g, '');
                    const value = match[1].trim();
                    if (value.length < 100) { // Reasonable length for a fact
                        facts.push({
                            label: label.charAt(0).toUpperCase() + label.slice(1),
                            value: value
                        });
                    }
                }
            });
        });
        
        return facts.slice(0, 6); // Limit to 6 key facts
    }
    
    renderFromExistingContent(releaseData) {
        const content = {
            lead: releaseData.leadParagraph || '',
            summary: releaseData.summary ? [releaseData.summary] : [],
            fullContent: [],
            keyFacts: []
        };
        
        this.renderArticle(content);
    }
    
    renderArticle(content) {
        if (!this.container || !this.releaseData) return;
        
        const clientLogo = this.releaseData.clientLogoPath ? 
            `http://localhost:5000${this.releaseData.clientLogoPath}` : '';
        
        this.container.innerHTML = `
            <div class="pr-content-wrapper">
                <!-- LEFT: Article -->
                <article class="pr-article">
                    <header class="pr-header">
                        ${clientLogo ? `<img src="${clientLogo}" id="client-logo" class="pr-logo" alt="${this.releaseData.brand || 'Client'} Logo">` : ''}
                        <h1 id="release-title">${this.releaseData.title || 'Press Release'}</h1>
                        <div class="pr-meta">
                            <span id="publish-date">${this.formatDate(this.releaseData.releaseDate)}</span>
                            <span id="location">${this.releaseData.location || this.releaseData.timezone || ''}</span>
                        </div>
                    </header>
                    
                    <div class="pr-summary">
                        <p class="pr-lead" id="lead-text">${content.lead}</p>
                        <div id="summary-content">${this.renderParagraphs(content.summary)}</div>
                        ${content.keyFacts.length > 0 ? this.renderKeyFacts(content.keyFacts) : ''}
                    </div>
                    
                    ${content.fullContent.length > 0 ? `
                        <div id="read-more-btn">
                            <button onclick="window.amcArticleRenderer.expandArticle()">
                                <i class="fas fa-book-open"></i> Read Full Article
                            </button>
                        </div>
                        
                        <div id="full-content" style="display:none;">
                            ${this.renderParagraphs(content.fullContent)}
                        </div>
                    ` : ''}
                    
                    ${this.renderPDFDownload()}
                    
                    ${this.renderSupplementaryContent()}
                </article>
                
                <!-- RIGHT: Keep existing sidebar -->
                <aside class="pr-sidebar">
                    ${this.renderSidebar()}
                </aside>
            </div>
        `;
        
        // Store reference globally for button onclick
        window.amcArticleRenderer = this;
    }
    
    renderParagraphs(paragraphs) {
        if (!paragraphs || paragraphs.length === 0) return '';
        
        return paragraphs.map(p => {
            // Simple formatting
            let formatted = p.trim();
            
            // Convert simple markdown-style formatting
            formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
            
            // Detect headings (lines that are short and don't end with punctuation)
            if (formatted.length < 100 && !/[.!?]$/.test(formatted) && formatted.length > 10) {
                return `<h3>${formatted}</h3>`;
            }
            
            return `<p>${formatted}</p>`;
        }).join('');
    }
    
    renderKeyFacts(facts) {
        if (!facts || facts.length === 0) return '';
        
        return `
            <div class="pr-key-facts" id="key-facts">
                <h4><i class="fas fa-info-circle"></i> Key Facts</h4>
                <ul>
                    ${facts.map(fact => `
                        <li>
                            <span class="fact-label">${fact.label}:</span>
                            <span class="fact-value">${fact.value}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }
    
    renderPDFDownload() {
        if (!this.releaseData.releaseDocs) return '';
        
        const mainPdf = this.releaseData.releaseDocs.find(d => d.mimetype === 'application/pdf');
        if (!mainPdf) return '';
        
        return `
            <div class="pr-pdf-download">
                <h4><i class="fas fa-file-pdf"></i> Complete Press Release</h4>
                <p>Download the full press release as PDF for offline reading or sharing.</p>
                <a href="#" class="btn-download" onclick="window.amcArticleRenderer.downloadPDF('${mainPdf._id}', '${mainPdf.originalName || 'press-release.pdf'}')">
                    <i class="fas fa-download"></i>
                    Download PDF
                </a>
            </div>
        `;
    }
    
    renderSupplementaryContent() {
        let html = '';
        
        // Notes to editors
        if (this.releaseData.notesToEditors && this.releaseData.notesToEditors.trim() !== '<p></p>') {
            html += `
                <div class="supplementary-text" id="notes-to-editors">
                    <h3>Notes to Editors</h3>
                    <div>${this.releaseData.notesToEditors}</div>
                </div>
            `;
        }
        
        // About client
        if (this.releaseData.aboutClient && this.releaseData.aboutClient.trim() !== '<p></p>') {
            html += `
                <div class="supplementary-text" id="about-client">
                    <h3>About ${this.releaseData.brand || 'the Company'}</h3>
                    <div>${this.releaseData.aboutClient}</div>
                </div>
            `;
        }
        
        return html;
    }
    
    renderSidebar() {
        // Return the existing sidebar content - we'll keep the original sidebar structure
        return `
            <!-- Sidebar content will be populated by existing JavaScript -->
            <div id="sidebar-placeholder">
                <p style="text-align: center; color: var(--text-secondary); padding: 20px;">
                    <i class="fas fa-spinner fa-spin"></i><br>
                    Loading media assets...
                </p>
            </div>
        `;
    }
    
    expandArticle() {
        const readMoreBtn = document.getElementById('read-more-btn');
        const fullContent = document.getElementById('full-content');
        
        if (readMoreBtn && fullContent) {
            readMoreBtn.style.display = 'none';
            fullContent.style.display = 'block';
            this.isExpanded = true;
            
            // Smooth scroll to full content
            fullContent.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }
    }
    
    downloadPDF(assetId, filename) {
        if (!assetId) {
            alert('PDF download is not available for this release.');
            return;
        }
        
        const API_BASE_URL = 'http://localhost:5000';
        const downloadUrl = `${API_BASE_URL}/api/v1/center/assets/download/${assetId}`;
        
        // Use the existing triggerDownload function if available
        if (window.triggerDownload) {
            window.triggerDownload(downloadUrl, filename);
        } else {
            // Fallback download method
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
    
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-GB', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
            });
        } catch (e) {
            return dateString;
        }
    }
    
    // Method to integrate with existing sidebar population
    integrateSidebar() {
        const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
        const originalSidebar = document.querySelector('.pr-right-sidebar');
        
        if (sidebarPlaceholder && originalSidebar) {
            // Move original sidebar content to our placeholder
            sidebarPlaceholder.innerHTML = originalSidebar.innerHTML;
            sidebarPlaceholder.id = 'integrated-sidebar';
        }
    }
}

// Global initialization function
function initializeArticleRenderer(containerId, releaseData) {
    const renderer = new AMCArticleRenderer(containerId);
    if (renderer.container) {
        renderer.loadRelease(releaseData);
        
        // Integrate with existing sidebar after a short delay
        setTimeout(() => {
            renderer.integrateSidebar();
        }, 100);
    }
    return renderer;
}

// Export for use in other scripts
window.AMCArticleRenderer = AMCArticleRenderer;
window.initializeArticleRenderer = initializeArticleRenderer;