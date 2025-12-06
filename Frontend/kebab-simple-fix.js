/**
 * DEAD SIMPLE KEBAB MENU - NO BULLSHIT
 * Just basic show/hide with CSS positioning
 */

console.log('🚀 SIMPLE KEBAB SYSTEM LOADING...');

// Wait for everything to load
setTimeout(() => {
    console.log('💫 Initializing SIMPLE kebab system...');
    
    // Simple click handler - NO PORTAL, NO COMPLEXITY
    document.addEventListener('click', function(e) {
        // Close all menus first
        document.querySelectorAll('.kebab-menu').forEach(menu => {
            menu.style.display = 'none';
        });
        
        // Check if clicked on kebab button
        if (e.target.classList.contains('kebab-btn') || e.target.closest('.kebab-btn')) {
            console.log('🖱️ KEBAB CLICKED!');
            
            const btn = e.target.classList.contains('kebab-btn') ? e.target : e.target.closest('.kebab-btn');
            const cell = btn.closest('td');
            const menu = cell.querySelector('.kebab-menu');
            
            if (menu) {
                console.log('✅ Found menu, showing it...');
                
                // Show the menu right next to the button
                menu.style.cssText = `
                    display: block !important;
                    position: absolute !important;
                    right: 0 !important;
                    top: 100% !important;
                    background: white !important;
                    border: 1px solid #ccc !important;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
                    border-radius: 8px !important;
                    padding: 8px !important;
                    z-index: 9999 !important;
                    min-width: 150px !important;
                `;
                
                // Style the menu items
                menu.querySelectorAll('.kebab-item').forEach(item => {
                    item.style.cssText = `
                        display: block !important;
                        padding: 8px 12px !important;
                        border: none !important;
                        background: none !important;
                        cursor: pointer !important;
                        width: 100% !important;
                        text-align: left !important;
                        border-radius: 4px !important;
                        margin: 2px 0 !important;
                    `;
                    
                    // Hover effects
                    item.addEventListener('mouseenter', () => {
                        item.style.backgroundColor = '#f0f0f0';
                    });
                    item.addEventListener('mouseleave', () => {
                        item.style.backgroundColor = 'transparent';
                    });
                });
                
                console.log('✅ Menu displayed!');
                e.stopPropagation();
            } else {
                console.log('❌ No menu found');
            }
        }
    });
    
    // Handle menu item clicks
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('kebab-item')) {
            console.log('🎬 Menu item clicked:', e.target.dataset.action);
            
            const action = e.target.dataset.action;
            const userId = e.target.dataset.userId;
            const title = e.target.dataset.title || 'this user';
            
            // Close menu
            e.target.closest('.kebab-menu').style.display = 'none';
            
            // Handle actions
            if (action === 'view' && typeof showUserDetails === 'function') {
                showUserDetails(userId);
            } else if (action === 'edit' && typeof editUser === 'function') {
                editUser(userId);
            } else if (action === 'suspend' && typeof suspendUser === 'function') {
                if (confirm(`Suspend ${title}?`)) {
                    suspendUser(userId);
                }
            } else if (action === 'activate' && typeof activateUser === 'function') {
                if (confirm(`Activate ${title}?`)) {
                    activateUser(userId);
                }
            } else if (action === 'delete' && typeof deleteUser === 'function') {
                if (confirm(`DELETE ${title}? This cannot be undone!`)) {
                    deleteUser(userId);
                }
            }
        }
    });
    
    // Make sure table cells are positioned relative
    document.querySelectorAll('td').forEach(td => {
        if (td.querySelector('.kebab-btn')) {
            td.style.position = 'relative';
        }
    });
    
    console.log('✅ SIMPLE KEBAB SYSTEM READY!');
    
}, 2000); // Wait 2 seconds for everything to load

// Re-initialize when table updates
const originalRender = window.renderUsersTable;
if (originalRender) {
    window.renderUsersTable = function() {
        originalRender.apply(this, arguments);
        setTimeout(() => {
            console.log('🔄 Re-initializing simple kebab after table render...');
            document.querySelectorAll('td').forEach(td => {
                if (td.querySelector('.kebab-btn')) {
                    td.style.position = 'relative';
                }
            });
        }, 500);
    };
}

console.log('💫 SIMPLE KEBAB SYSTEM LOADED');