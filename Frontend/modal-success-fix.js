/**
 * SUCCESS MODAL FIX - JavaScript solution
 * Intercepts success messages and creates proper modal display
 */

(function() {
    'use strict';
    
    console.log('🔧 Success Modal Fix loaded');
    
    // Create modal HTML structure
    function createSuccessModal(title, message, uuid) {
        // Remove any existing modal
        const existingModal = document.getElementById('success-modal-fix');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.id = 'success-modal-fix';
        backdrop.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(0, 0, 0, 0.6) !important;
            z-index: 99999 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        `;
        
        // Create modal content
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white !important;
            border-radius: 12px !important;
            padding: 40px !important;
            max-width: 500px !important;
            width: 90% !important;
            text-align: center !important;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4) !important;
            border: 3px solid #28a745 !important;
            position: relative !important;
        `;
        
        modal.innerHTML = `
            <div style="color: #28a745; font-size: 48px; margin-bottom: 20px;">✅</div>
            <h2 style="color: #28a745; margin-bottom: 20px; font-size: 24px; font-weight: bold;">Media Release Uploaded Successfully!</h2>
            <p style="color: #333; margin-bottom: 15px; font-size: 16px; line-height: 1.5;"><strong>Title:</strong> ${title}</p>
            <p style="color: #666; margin-bottom: 25px; font-size: 14px;">Release UUID: ${uuid}</p>
            <div style="margin-top: 30px;">
                <button id="modal-ok-btn" style="
                    background: #28a745 !important;
                    color: white !important;
                    border: none !important;
                    padding: 12px 30px !important;
                    border-radius: 6px !important;
                    cursor: pointer !important;
                    font-size: 16px !important;
                    font-weight: bold !important;
                    margin-right: 10px !important;
                ">OK</button>
                <button id="modal-create-another-btn" style="
                    background: #007bff !important;
                    color: white !important;
                    border: none !important;
                    padding: 12px 30px !important;
                    border-radius: 6px !important;
                    cursor: pointer !important;
                    font-size: 16px !important;
                    font-weight: bold !important;
                ">Create Another Release</button>
            </div>
        `;
        
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
        
        // Add event listeners
        document.getElementById('modal-ok-btn').addEventListener('click', function() {
            backdrop.remove();
            // Optionally redirect to main page
            if (typeof showHubGrid === 'function') {
                showHubGrid();
            }
        });
        
        document.getElementById('modal-create-another-btn').addEventListener('click', function() {
            backdrop.remove();
            // Reload the form for another release
            location.reload();
        });
        
        // Close on backdrop click
        backdrop.addEventListener('click', function(e) {
            if (e.target === backdrop) {
                backdrop.remove();
                if (typeof showHubGrid === 'function') {
                    showHubGrid();
                }
            }
        });
        
        // Close on ESC key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && document.getElementById('success-modal-fix')) {
                backdrop.remove();
                if (typeof showHubGrid === 'function') {
                    showHubGrid();
                }
            }
        });
        
        console.log('✅ Success modal displayed for:', title);
    }
    
    // Override console.log to catch success messages
    const originalLog = console.log;
    console.log = function(...args) {
        originalLog.apply(console, args);
        
        // Check for success modal trigger
        if (args.length > 0 && typeof args[0] === 'string') {
            if (args[0].includes('🎉 Showing success modal for published release')) {
                console.log('🔧 Intercepted success modal trigger');
                
                // Try to extract release details from the next log
                setTimeout(() => {
                    // Look for release data in window or try to extract from recent logs
                    if (window.lastSuccessfulRelease) {
                        const release = window.lastSuccessfulRelease;
                        createSuccessModal(
                            release.title || 'Media Release',
                            'Your media release has been successfully uploaded to AutoMediaCenter.',
                            release.uuid || 'Unknown'
                        );
                    } else {
                        // Fallback - create generic success modal
                        createSuccessModal(
                            'Media Release',
                            'Your media release has been successfully uploaded to AutoMediaCenter.',
                            'Success'
                        );
                    }
                }, 100);
            }
        }
    };
    
    // Also intercept fetch responses to catch successful submissions
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        return originalFetch.apply(this, args).then(response => {
            if (response.ok && response.status === 201) {
                // This might be a successful release submission
                response.clone().json().then(data => {
                    if (data.success && data.data && data.data.title) {
                        // Store the successful release data
                        window.lastSuccessfulRelease = data.data;
                        console.log('🔧 Stored successful release data:', data.data.title);
                        
                        // Show modal immediately
                        setTimeout(() => {
                            createSuccessModal(
                                data.data.title,
                                'Your media release has been successfully uploaded to AutoMediaCenter.',
                                data.data.uuid
                            );
                        }, 500);
                    }
                }).catch(() => {
                    // Ignore JSON parsing errors
                });
            }
            return response;
        });
    };
    
    console.log('✅ Success Modal Fix initialized');
})();