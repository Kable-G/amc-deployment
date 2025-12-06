# AMC Modular Integration Guide
## Complete Enterprise Header & Sidebar System

### 🎯 Overview

This modular system provides **ALL** the functionality from the existing enterprise AMC components (`amc-header.js`, `sidebar.js`, `amc-system-check3.html`) while completely eliminating main content interference. You get the full enterprise experience without breaking existing page layouts.

### ✨ What's Included

**Complete Enterprise Header:**
- ✅ Global search with scoped results (Ctrl+K shortcut)
- ✅ Notification & cart badge system with animations
- ✅ Tools dropdown with unit converter modal
- ✅ Avatar system integration ready
- ✅ Responsive tooltip system with positioning
- ✅ Glass morphism design with dark mode
- ✅ Theme management and event system

**Complete Enterprise Sidebar:**
- ✅ Role-based menu rendering (4 role levels)
- ✅ Collapsible sections with persistent state
- ✅ Colored section indicators and bars
- ✅ Tooltip system when collapsed
- ✅ Smooth animations and hover effects
- ✅ Keyboard shortcuts (Ctrl+B)
- ✅ Analytics event tracking
- ✅ Mobile responsive design

**Zero Interference Design:**
- ✅ Only adds `padding-top: 64px` to body
- ✅ No main content CSS interference
- ✅ Optional utility classes only
- ✅ Existing grids work perfectly
- ✅ Easy rollback capability

---

## 🚀 Quick Integration

### Step 1: Add Files to Your Project

Copy these 4 files to your project:
```
css/amc-header-only.css
css/amc-sidebar-only.css
components/amc-header-minimal.js
components/amc-sidebar-minimal.js
```

### Step 2: Add to Your HTML

Add to your `<head>` **in this exact order**:
```html
<!-- Font Awesome (if not already included) -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

<!-- Google Fonts (if not already included) -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700&display=swap" rel="stylesheet">

<!-- ⚠️ CRITICAL: AMC Role System - MUST be loaded first for proper role detection -->
<script src="components/amc-role.js"></script>

<!-- Modular CSS -->
<link rel="stylesheet" href="css/amc-header-only.css">
<link rel="stylesheet" href="css/amc-sidebar-only.css">

<!-- Optional: Avatar system CSS -->
<link rel="stylesheet" href="amc-avatar-styles.css">
```

Add to your `<body>`:
```html
<!-- Header placeholder -->
<amc-header></amc-header>

<!-- Sidebar container -->
<aside id="sidebar" class="amc-sidebar"></aside>

<!-- Your existing content (completely untouched) -->
<main class="your-existing-content">
    <!-- All your existing HTML works exactly as before -->
</main>

<!-- Role compatibility bridge (optional) -->
<script>
(function () {
    const resolvedRole = sessionStorage.getItem("amcRoleOverride") || 
                        localStorage.getItem("amc-role") || 
                        "client_user";
    
    let u = {};
    try { 
        u = JSON.parse(localStorage.getItem("user") || "{}"); 
    } catch(e) { 
        u = {}; 
    }
    u.role = resolvedRole;
    
    localStorage.setItem("user", JSON.stringify(u));
    localStorage.setItem("currentUser", JSON.stringify(u));
})();
</script>

<!-- Modular JavaScript -->
<script src="components/amc-header-minimal.js"></script>
<script src="components/amc-sidebar-minimal.js"></script>

<!-- Optional: Avatar system -->
<script src="amc-avatar-system.js"></script>
```

### Step 3: Optional Layout Adjustment

If you want your content to automatically offset for the sidebar, add the utility class:
```html
<main class="your-existing-content amc-sidebar-offset">
    <!-- Your content will automatically adjust for sidebar -->
</main>
```

**That's it!** Your page now has the complete enterprise header and sidebar system.

---

## 🔧 Advanced Configuration

### Header Configuration

```javascript
// Access the header instance
const header = window.amcHeader;

// Set cart count
header.setCartCount(5);

// Set notification count  
header.setNotificationCount(12);

// Toggle theme
header.toggleTheme();
```

### Sidebar Configuration

```javascript
// Access the sidebar instance
const sidebar = window.amcSidebar;

// Change user role
sidebar.setUserRole('platform_admin');

// Add badge to menu item
sidebar.addBadge('automediacenter.html', {
    type: 'primary',
    text: 'New'
});

// Remove badge
sidebar.removeBadge('automediacenter.html');

// Refresh sidebar
sidebar.refresh();
```

### Event System

```javascript
// Listen for component events
window.addEventListener('amcHeaderReady', (e) => {
    console.log('Header ready:', e.detail.instance);
});

window.addEventListener('amcSidebarReady', (e) => {
    console.log('Sidebar ready:', e.detail.instance);
});

window.addEventListener('amcGlobalSearch', (e) => {
    console.log('Search:', e.detail.query, e.detail.scope);
});

window.addEventListener('sectionToggled', (e) => {
    console.log('Section toggled:', e.detail.section, e.detail.isCollapsed);
});

window.addEventListener('themeChanged', () => {
    console.log('Theme changed');
});
```

---

## 📋 Integration Examples

### Example 1: Basic Integration (automediacenter.html)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>AutoMediaCenter</title>
    
    <!-- Your existing CSS -->
    <link rel="stylesheet" href="your-existing-styles.css">
    
    <!-- Add modular system -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <link rel="stylesheet" href="css/amc-header-only.css">
    <link rel="stylesheet" href="css/amc-sidebar-only.css">
</head>
<body>
    <!-- Add header and sidebar -->
    <amc-header></amc-header>
    <aside id="sidebar" class="amc-sidebar"></aside>
    
    <!-- Your existing content (unchanged) -->
    <main class="amc-content amc-sidebar-offset">
        <div class="content-header">
            <h1>AutoMediaCenter Dashboard</h1>
        </div>
        
        <!-- All your existing HTML works exactly as before -->
        <div class="dashboard-grid">
            <!-- Your existing grid layout -->
        </div>
    </main>
    
    <!-- Add JavaScript -->
    <script src="components/amc-header-minimal.js"></script>
    <script src="components/amc-sidebar-minimal.js"></script>
</body>
</html>
```

### Example 2: With Custom Role Management

```html
<script>
// Set custom role before components load
localStorage.setItem('amc-role', 'platform_admin');

// Or use session override
sessionStorage.setItem('amcRoleOverride', 'client_admin');

// Components will automatically use the role
</script>
<script src="components/amc-header-minimal.js"></script>
<script src="components/amc-sidebar-minimal.js"></script>
```

### Example 3: With Custom Badge Management

```html
<script>
window.addEventListener('amcSidebarReady', () => {
    // Add badges to specific menu items
    window.amcSidebar.addBadge('newradarfe.html', {
        type: 'danger',
        text: '5'
    });
    
    window.amcSidebar.addBadge('manage_releases.html', {
        type: 'warning',
        text: 'New'
    });
});
</script>
```

---

## 🎨 Theming & Customization

### CSS Variables

The system uses CSS variables for easy theming:

```css
:root {
    --bg-primary: #ffffff;
    --bg-secondary: #f8f9fa;
    --bg-tertiary: #e9ecef;
    --text-primary: #212529;
    --text-secondary: #6c757d;
    --text-headings: #343a40;
    --border-primary: #dee2e6;
    --accent-primary: #0d6efd;
}

body.dark-mode {
    --bg-primary: #121212;
    --bg-secondary: #1f2937;
    --bg-tertiary: #374151;
    --text-primary: #f3f4f6;
    --text-secondary: #9ca3af;
    --text-headings: #f9fafb;
    --border-primary: #374151;
    --accent-primary: #3b82f6;
}
```

### Custom Styling

Override specific components:
```css
/* Custom header styling */
.app-header {
    background: your-custom-gradient;
}

/* Custom sidebar styling */
.sidebar-section-header.core {
    color: your-custom-color;
}

/* Custom tooltip styling */
.sidebar-tooltip {
    background: your-custom-background;
}
```

---

## 🔍 Role-Based Access Control

### ⚠️ IMPORTANT: Role System Integration

The modular system now uses the **exact same robust role detection logic** as your existing pages (`automediacenter.html`, `manage_releases.html`, etc.). This fixes the previous issue where the modular system was "set in media user mode" and not using your established role-based logic.

### Role Detection Priority (Same as your existing system)

1. **AMC.role** - Set by `components/amc-role.js`
2. **Session Override** - `sessionStorage.amcRoleOverride`
3. **localStorage Detection** - Multiple fallback keys (`user`, `currentUser`)
4. **Default Fallback** - `media_user`

### Available Roles (Hierarchical)

1. **`media_user`** - Basic access (Core section only)
2. **`client_user`** - Core + Management sections
3. **`client_admin`** - Core + Management + Analytics sections
4. **`platform_admin`** - All sections (Core + Management + Analytics + Admin)

### Testing & Debugging Roles

Use the same URL parameters as your existing system:
- `?role=client_admin` - Override role for testing
- `?amcSeed=1` - Populate localStorage with test user data
- `?amcRoleDev=1` - Show role switcher UI for development

### Console Debugging

Look for these console messages to verify role detection is working:
```
🎯 AMC Sidebar: Using AMC.role from amc-role.js: client_admin
🎯 AMC Sidebar: Found role "client_admin" in localStorage.user.role
✅ AMC Sidebar initialized with role-based functionality using robust role detection
```

### Menu Structure by Role

**Media User:**
- AutoMediaCenter
- AutoMediaRadar  
- AutoMediaLive
- AutoMediaVault

**Client User (+ above):**
- Upload Dashboard
- Manage Releases
- Radar History

**Client Admin (+ above):**
- Company Dashboard
- Manage Live Events
- Manage Vault Assets
- Company Analytics
- AMC Analytics
- Radar Analytics
- Live Analytics

**Platform Admin (+ above):**
- Vault Analytics
- Platform Admin
- User Management
- Client Management
- Access Control
- System Settings

---

## 🛠️ Troubleshooting

### Common Issues

**1. Components not loading:**
```javascript
// Check if containers exist
console.log('Header container:', document.querySelector('amc-header'));
console.log('Sidebar container:', document.querySelector('#sidebar'));
```

**2. Role not working:**
```javascript
// Check role resolution
console.log('Current role:', localStorage.getItem('user'));
console.log('Role override:', sessionStorage.getItem('amcRoleOverride'));
```

**3. Tooltips not positioning correctly:**
```javascript
// Force tooltip recalculation
window.addEventListener('resize', () => {
    if (window.amcHeader) {
        window.amcHeader.initializeTooltipSystem();
    }
});
```

**4. Sidebar state not persisting:**
```javascript
// Check localStorage
console.log('Sidebar collapsed:', localStorage.getItem('amc_sidebar_collapsed'));
console.log('Collapsed sections:', localStorage.getItem('collapsedSections'));
```

### Debug Mode

Enable debug logging:
```javascript
// Enable debug mode
window.AMC_DEBUG = true;

// Components will log detailed information
```

---

## 🔄 Migration from Existing System

### From amc-globalshell.css

**Before:**
```html
<link rel="stylesheet" href="css/amc-globalshell.css">
```

**After:**
```html
<link rel="stylesheet" href="css/amc-header-only.css">
<link rel="stylesheet" href="css/amc-sidebar-only.css">
```

### From existing components

**Before:**
```html
<script src="components/amc-header.js"></script>
<script src="components/sidebar.js"></script>
```

**After:**
```html
<script src="components/amc-header-minimal.js"></script>
<script src="components/amc-sidebar-minimal.js"></script>
```

### Rollback Plan

If you need to rollback:

1. Remove the 4 modular files
2. Restore your original CSS/JS files
3. Remove `<amc-header>` and `#sidebar` elements
4. Remove the `amc-sidebar-offset` class

Your content will be completely unaffected.

---

## 📱 Mobile Responsiveness

The system is fully responsive:

- **Desktop (>1024px):** Full sidebar visible
- **Tablet (768-1024px):** Sidebar slides over content
- **Mobile (<768px):** Sidebar becomes full-width overlay

No additional configuration needed.

---

## ♿ Accessibility Features

- **Keyboard Navigation:** Full keyboard support
- **Screen Readers:** Proper ARIA labels and roles
- **Focus Management:** Visible focus indicators
- **High Contrast:** Supports high contrast mode
- **Reduced Motion:** Respects prefers-reduced-motion

---

## 🚀 Performance

- **Lazy Loading:** Components only initialize when needed
- **Event Delegation:** Efficient event handling
- **CSS Optimization:** Minimal CSS footprint
- **JavaScript Optimization:** Tree-shakeable modules
- **Memory Management:** Proper cleanup on destroy

---

## 📊 Analytics Integration

The system includes built-in analytics:

```javascript
// Track sidebar clicks
window.addEventListener('sidebarClick', (e) => {
    // Send to your analytics service
    analytics.track('sidebar_click', {
        item: e.detail.label,
        href: e.detail.href
    });
});

// Track search queries
window.addEventListener('amcGlobalSearch', (e) => {
    analytics.track('global_search', {
        query: e.detail.query,
        scope: e.detail.scope
    });
});
```

---

## 🔐 Security Considerations

- **Role Validation:** Client-side roles are for UX only
- **Server Validation:** Always validate permissions server-side
- **XSS Protection:** All user inputs are properly escaped
- **CSP Compatibility:** Works with Content Security Policy

---

## 📈 Browser Support

- **Chrome:** 90+
- **Firefox:** 88+
- **Safari:** 14+
- **Edge:** 90+

Uses modern CSS features with graceful degradation.

---

## 🤝 Support

For issues or questions:

1. Check the troubleshooting section above
2. Review the browser console for errors
3. Test with the provided `amc-modular-template.html`
4. Verify all files are correctly included

---

## 📝 Changelog

### v1.0.0 - Complete Enterprise System
- ✅ Full functionality from original components
- ✅ Zero main content interference
- ✅ Complete role-based access control
- ✅ Advanced tooltip and animation systems
- ✅ Mobile responsive design
- ✅ Accessibility compliance
- ✅ Theme management
- ✅ Analytics integration
- ✅ Unit converter modal system
- ✅ Badge management system

---

**🎉 You now have the complete enterprise AMC system with zero interference to your existing layouts!**