/**
 * ═══════════════════════════════════════════════════════════════
 * AMC CUSTOM PDF VIEWER COMPONENT - FINAL WORKING VERSION
 * Natural scrollbar from zoom overflow, no grey space hack
 * Requires: PDF.js library
 * ═══════════════════════════════════════════════════════════════
 */

class AMCPDFViewer {
    constructor(containerId, pdfUrl) {
        this.container = document.getElementById(containerId);
        this.pdfUrl = pdfUrl;
        this.pdfDoc = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.scale = 2.0; // 200% - creates natural overflow for scrollbar
        this.rendering = false;
        this.sidePanelMode = null;
        this.outline = [];
        
        this.hideTextContent();
        this.init();
    }
    
    hideTextContent() {
        const mainContent = document.querySelector('.pr-main-text-content');
        if (mainContent) {
            mainContent.classList.add('pdf-active');
        }
    }
    
    init() {
        this.renderUI();
        this.attachEventListeners();
        this.loadPDF();
    }
    
    renderUI() {
        this.container.innerHTML = `
            <div class="amc-pdf-viewer">
                <div class="amc-pdf-controls">
                    <div class="amc-pdf-controls-left">
                        <button class="amc-pdf-btn icon-only" id="amc-pdf-outline-toggle" title="Show outline">
                            <i class="fas fa-list-ul"></i>
                        </button>
                        <button class="amc-pdf-btn icon-only" id="amc-pdf-thumbnails-toggle" title="Show thumbnails">
                            <i class="fas fa-th"></i>
                        </button>
                    </div>
                    
                    <div class="amc-pdf-controls-center">
                        <button class="amc-pdf-btn icon-only" id="amc-pdf-prev" title="Previous page">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <div class="amc-pdf-page-info">
                            <span id="amc-pdf-page-num">1</span> / <span id="amc-pdf-page-count">--</span>
                        </div>
                        <button class="amc-pdf-btn icon-only" id="amc-pdf-next" title="Next page">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                    
                    <div class="amc-pdf-controls-zoom">
                        <button class="amc-pdf-btn icon-only" id="amc-pdf-zoom-out" title="Zoom out">
                            <i class="fas fa-minus"></i>
                        </button>
                        <span class="amc-pdf-zoom-level" id="amc-pdf-zoom-level">200%</span>
                        <button class="amc-pdf-btn icon-only" id="amc-pdf-zoom-in" title="Zoom in">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    
                    <div class="amc-pdf-controls-right">
                        <button class="amc-pdf-btn" id="amc-pdf-download" title="Download PDF">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="amc-pdf-btn icon-only" id="amc-pdf-print" title="Print">
                            <i class="fas fa-print"></i>
                        </button>
                    </div>
                </div>
                
                <div class="amc-pdf-viewer-area">
                    <div class="amc-pdf-side-panel" id="amc-pdf-side-panel">
                        <div id="amc-pdf-panel-content"></div>
                    </div>
                    
                    <div class="amc-pdf-canvas-container" id="amc-pdf-canvas-container">
                        <div class="amc-pdf-loading">
                            <div class="amc-pdf-loading-spinner"></div>
                            <div class="amc-pdf-loading-text">Loading PDF...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    attachEventListeners() {
        document.getElementById('amc-pdf-prev').addEventListener('click', () => this.prevPage());
        document.getElementById('amc-pdf-next').addEventListener('click', () => this.nextPage());
        document.getElementById('amc-pdf-zoom-in').addEventListener('click', () => this.zoomIn());
        document.getElementById('amc-pdf-zoom-out').addEventListener('click', () => this.zoomOut());
        document.getElementById('amc-pdf-outline-toggle').addEventListener('click', () => this.togglePanel('outline'));
        document.getElementById('amc-pdf-thumbnails-toggle').addEventListener('click', () => this.togglePanel('thumbnails'));
        document.getElementById('amc-pdf-download').addEventListener('click', () => this.download());
        document.getElementById('amc-pdf-print').addEventListener('click', () => this.print());
        
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch(e.key) {
                case 'ArrowLeft':
                case 'ArrowUp':
                    e.preventDefault();
                    this.prevPage();
                    break;
                case 'ArrowRight':
                case 'ArrowDown':
                    e.preventDefault();
                    this.nextPage();
                    break;
                case '+':
                case '=':
                    e.preventDefault();
                    this.zoomIn();
                    break;
                case '-':
                case '_':
                    e.preventDefault();
                    this.zoomOut();
                    break;
            }
        });
    }
    
    async loadPDF() {
        try {
            const loadingTask = pdfjsLib.getDocument(this.pdfUrl);
            this.pdfDoc = await loadingTask.promise;
            this.totalPages = this.pdfDoc.numPages;
            
            document.getElementById('amc-pdf-page-count').textContent = this.totalPages;
            
            await this.loadOutline();
            await this.renderPage(1);
            
            setTimeout(() => this.generateThumbnails(), 500);
            
        } catch (error) {
            console.error('Error loading PDF:', error);
            this.showError('Failed to load PDF. Please try downloading the file instead.');
        }
    }
    
    async loadOutline() {
        try {
            const outline = await this.pdfDoc.getOutline();
            if (outline && outline.length > 0) {
                this.outline = outline;
            }
        } catch (error) {
            console.error('Error loading outline:', error);
        }
    }
    
    async renderPage(pageNum) {
        if (this.rendering || !this.pdfDoc) return;
        
        this.rendering = true;
        this.currentPage = pageNum;
        
        try {
            const page = await this.pdfDoc.getPage(pageNum);
            
            // Calculate viewport
            const viewport = page.getViewport({ scale: this.scale });
            
            // ULTRA HIGH DPI for crisp text
            const outputScale = (window.devicePixelRatio || 1) * 2;
            
            // Create container
            const container = document.getElementById('amc-pdf-canvas-container');
            
            // NO WRAPPER - just the page div directly
            const pageDiv = document.createElement('div');
            pageDiv.className = 'amc-pdf-page';
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            // High DPI canvas setup
            canvas.width = Math.floor(viewport.width * outputScale);
            canvas.height = Math.floor(viewport.height * outputScale);
            
            // Display size
            canvas.style.width = Math.floor(viewport.width) + 'px';
            canvas.style.height = Math.floor(viewport.height) + 'px';
            
            pageDiv.appendChild(canvas);
            container.innerHTML = '';
            container.appendChild(pageDiv);
            
            // Scale context for high DPI
            context.scale(outputScale, outputScale);
            
            // Render with high quality
            const renderContext = {
                canvasContext: context,
                viewport: viewport,
                intent: 'display'
            };
            
            await page.render(renderContext).promise;
            
            // Update UI
            document.getElementById('amc-pdf-page-num').textContent = pageNum;
            this.updateNavigationButtons();
            this.updateZoomDisplay();
            
            console.log('Page rendered:', {
                pageNum,
                scale: this.scale,
                canvasWidth: canvas.width,
                canvasHeight: canvas.height,
                displayWidth: canvas.style.width,
                displayHeight: canvas.style.height,
                outputScale
            });
            
        } catch (error) {
            console.error('Error rendering page:', error);
        } finally {
            this.rendering = false;
        }
    }
    
    async generateThumbnails() {
        this.thumbnails = [];
        
        for (let i = 1; i <= this.totalPages; i++) {
            try {
                const page = await this.pdfDoc.getPage(i);
                const viewport = page.getViewport({ scale: 0.3 });
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;
                
                this.thumbnails.push(canvas.toDataURL());
            } catch (error) {
                console.error(`Error generating thumbnail for page ${i}:`, error);
            }
        }
    }
    
    togglePanel(mode) {
        const panel = document.getElementById('amc-pdf-side-panel');
        const outlineBtn = document.getElementById('amc-pdf-outline-toggle');
        const thumbsBtn = document.getElementById('amc-pdf-thumbnails-toggle');
        
        if (this.sidePanelMode === mode) {
            panel.classList.remove('open');
            outlineBtn.classList.remove('active');
            thumbsBtn.classList.remove('active');
            this.sidePanelMode = null;
            return;
        }
        
        this.sidePanelMode = mode;
        panel.classList.add('open');
        
        outlineBtn.classList.toggle('active', mode === 'outline');
        thumbsBtn.classList.toggle('active', mode === 'thumbnails');
        
        if (mode === 'outline') {
            this.renderOutline();
        } else if (mode === 'thumbnails') {
            this.renderThumbnails();
        }
    }
    
    renderOutline() {
        const panelContent = document.getElementById('amc-pdf-panel-content');
        
        if (!this.outline || this.outline.length === 0) {
            panelContent.innerHTML = `
                <div class="amc-pdf-outline-container">
                    <div class="amc-pdf-outline-title">Document Outline</div>
                    <div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 0.9em;">
                        No outline available for this document.
                    </div>
                </div>
            `;
            return;
        }
        
        let html = '<div class="amc-pdf-outline-container"><div class="amc-pdf-outline-title">Document Outline</div>';
        
        const renderOutlineItems = (items, level = 1) => {
            items.forEach(item => {
                html += `
                    <div class="amc-pdf-outline-item level-${level}">
                        ${item.title}
                    </div>
                `;
                if (item.items && item.items.length > 0) {
                    renderOutlineItems(item.items, level + 1);
                }
            });
        };
        
        renderOutlineItems(this.outline);
        html += '</div>';
        
        panelContent.innerHTML = html;
    }
    
    renderThumbnails() {
        const panelContent = document.getElementById('amc-pdf-panel-content');
        
        if (!this.thumbnails || this.thumbnails.length === 0) {
            panelContent.innerHTML = `
                <div class="amc-pdf-thumbnails-container">
                    <div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 0.9em;">
                        Generating thumbnails...
                    </div>
                </div>
            `;
            setTimeout(() => this.renderThumbnails(), 1000);
            return;
        }
        
        let html = '<div class="amc-pdf-thumbnails-container">';
        
        this.thumbnails.forEach((thumbnail, index) => {
            const pageNum = index + 1;
            const isActive = pageNum === this.currentPage;
            html += `
                <div class="amc-pdf-thumbnail ${isActive ? 'active' : ''}" data-page="${pageNum}">
                    <img src="${thumbnail}" alt="Page ${pageNum}" class="amc-pdf-thumbnail-img">
                    <div class="amc-pdf-thumbnail-label">Page ${pageNum}</div>
                </div>
            `;
        });
        
        html += '</div>';
        panelContent.innerHTML = html;
        
        panelContent.querySelectorAll('.amc-pdf-thumbnail').forEach(thumb => {
            thumb.addEventListener('click', () => {
                const pageNum = parseInt(thumb.dataset.page);
                this.renderPage(pageNum);
                panelContent.querySelectorAll('.amc-pdf-thumbnail').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });
        });
    }
    
    prevPage() {
        if (this.currentPage > 1) {
            this.renderPage(this.currentPage - 1);
        }
    }
    
    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.renderPage(this.currentPage + 1);
        }
    }
    
    async zoomIn() {
        this.scale = Math.min(this.scale + 0.25, 5.0);
        await this.renderPage(this.currentPage);
    }
    
    async zoomOut() {
        this.scale = Math.max(this.scale - 0.25, 0.75);
        await this.renderPage(this.currentPage);
    }
    
    updateZoomDisplay() {
        const zoomPercent = Math.round(this.scale * 100);
        document.getElementById('amc-pdf-zoom-level').textContent = `${zoomPercent}%`;
    }
    
    updateNavigationButtons() {
        const prevBtn = document.getElementById('amc-pdf-prev');
        const nextBtn = document.getElementById('amc-pdf-next');
        
        prevBtn.disabled = this.currentPage <= 1;
        nextBtn.disabled = this.currentPage >= this.totalPages;
    }
    
    download() {
        const link = document.createElement('a');
        link.href = this.pdfUrl;
        link.download = this.pdfUrl.split('/').pop() || 'document.pdf';
        link.click();
    }
    
    print() {
        window.open(this.pdfUrl, '_blank');
    }
    
    showError(message) {
        const container = document.getElementById('amc-pdf-canvas-container');
        container.innerHTML = `
            <div class="amc-pdf-error">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Unable to Load PDF</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="window.location.reload()">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
}

window.AMCPDFViewer = AMCPDFViewer;