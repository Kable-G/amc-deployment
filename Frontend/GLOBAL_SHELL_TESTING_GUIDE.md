# 🧪 AutoMediaCenter Global Shell - Manual Testing Guide

## 📋 Quick Start Testing

### 1. **Open the Test Page**
```
Open: test_globalshell.html in your browser
```

### 2. **Initial Visual Check**
- ✅ Header appears at top with logo "AutoMediaCenter"
- ✅ Sidebar appears on left with menu items
- ✅ Main content area shows test instructions
- ✅ Role selector overlay appears in top-right corner

---

## 🎯 Core Functionality Tests

### **Test 1: Role Switching**
1. **Look for role selector** (top-right overlay with dropdown)
2. **Switch between roles:**
   - `media_user` → Should show: AutoMediaCenter, AutoMediaRadar, AutoMediaLive, Downloads, Profile
   - `client_user` → Should show: Dashboard, AutoMediaCenter, My Releases, AutoMediaVault, AutoMediaRadar, Analytics, Profile
   - `client_admin` → Should show: Dashboard, AutoMediaCenter, Upload Hub, My Releases, AutoMediaVault, Company Settings, User Management, Analytics, Profile
   - `platform_admin` → Should show: Platform Dashboard, AutoMediaCenter, AutoMediaRadar, AutoMediaLive, AutoMediaVault, Company Management, Invite Management, Mail Logs, System Analytics, Security, Settings, Profile

**✅ Expected:** Sidebar menu changes based on selected role

### **Test 2: Sidebar Collapse/Expand**
1. **Click the hamburger menu** (☰) in the sidebar header
2. **Observe sidebar behavior:**
   - Sidebar should collapse to ~72px width
   - Menu labels should disappear
   - Icons should remain visible
   - Main content should expand to fill space

**✅ Expected:** Smooth animation, persistent state after page reload

### **Test 3: Dark Mode Toggle**
1. **Click the moon icon** (🌙) in the header
2. **Observe changes:**
   - Background should change to dark theme
   - Text colors should invert
   - Icon should change to sun (☀️)
   - All components should adapt to dark theme

**✅ Expected:** Smooth transition, persistent state after page reload

### **Test 4: Avatar System**
1. **Click the avatar button** (user icon with colored ring) in header
2. **Check modal content:**
   - User email should display
   - User role should display with proper label
   - Menu options: Profile, Settings, Help & Support, Log out
3. **Test ring colors:**
   - `media_user` → Green ring
   - `client_user` → Blue ring
   - `client_admin` → Orange ring
   - `platform_admin` → Red ring

**✅ Expected:** Modal opens/closes, ring color matches role

---

## 🔧 Advanced Testing (DevTools Required)

### **Test 5: Cart Functionality**
1. **Open DevTools** (F12)
2. **Run in Console:**
   ```javascript
   amcSetCartCount(3)
   ```
3. **Check cart icon:**
   - Badge should show "3"
   - Cart icon should change color
   - Badge should animate when updated

### **Test 6: Notifications**
1. **Run in Console:**
   ```javascript
   amcSetNotifCount(5)
   ```
2. **Check notification bell:**
   - Badge should show "5"
   - Bell icon should change color
   - Badge should be visible

### **Test 7: User Email Update**
1. **Run in Console:**
   ```javascript
   localStorage.setItem('amc_user_email', 'test@company.com')
   location.reload()
   ```
2. **Check avatar modal:**
   - Email should update to "test@company.com"

### **Test 8: Programmatic Role Change**
1. **Run in Console:**
   ```javascript
   AMCShell.updateRole('platform_admin')
   ```
2. **Check sidebar:**
   - Menu should change to platform_admin items
   - Avatar ring should turn red

---

## 📱 Responsive Testing

### **Test 9: Mobile Responsiveness**
1. **Resize browser window** to mobile size (< 768px)
2. **Check behavior:**
   - Sidebar should hide automatically
   - Header should remain functional
   - Content should be readable
   - Touch targets should be appropriate

### **Test 10: Tablet View**
1. **Resize to tablet size** (768px - 1024px)
2. **Check layout:**
   - Sidebar should remain visible but narrower
   - Content should adapt properly

---

## 🎨 Visual & UX Testing

### **Test 11: Hover States**
1. **Hover over sidebar items:**
   - Background should change
   - Smooth transition effects
2. **Hover over header buttons:**
   - Icons should change color
   - Subtle lift effect

### **Test 12: Badge System**
1. **Look for badges** in sidebar (NEW, !, β, 🔥)
2. **Check badge visibility:**
   - Should be visible when sidebar expanded
   - Should hide when sidebar collapsed

### **Test 13: Tooltips (Collapsed Sidebar)**
1. **Collapse sidebar** using toggle
2. **Hover over menu items:**
   - Tooltips should appear on right side
   - Should show full menu item name

---

## 🔍 Error Testing

### **Test 14: Console Errors**
1. **Open DevTools Console**
2. **Check for errors:**
   - No JavaScript errors should appear
   - All resources should load successfully

### **Test 15: Missing Dependencies**
1. **Check Network tab** in DevTools
2. **Verify all files load:**
   - CSS files load successfully
   - JavaScript modules load
   - Font Awesome icons load
   - Google Fonts load

---

## ✅ Success Criteria Checklist

### **Core Functionality**
- [ ] Role switching works for all 4 roles
- [ ] Sidebar collapses/expands smoothly
- [ ] Dark mode toggles properly
- [ ] Avatar modal opens and displays correct info
- [ ] Cart counter updates and displays
- [ ] Notification counter works
- [ ] User email updates correctly

### **Visual & UX**
- [ ] All hover states work
- [ ] Transitions are smooth
- [ ] Badge system displays correctly
- [ ] Tooltips appear in collapsed mode
- [ ] Role-based ring colors work
- [ ] Typography is consistent

### **Responsive Design**
- [ ] Mobile layout works (< 768px)
- [ ] Tablet layout works (768px - 1024px)
- [ ] Desktop layout works (> 1024px)
- [ ] Touch targets are appropriate

### **Technical**
- [ ] No console errors
- [ ] All resources load successfully
- [ ] State persists after page reload
- [ ] Performance is smooth

---

## 🚨 Common Issues & Solutions

### **Issue: Sidebar doesn't appear**
- **Check:** CSS files are loading correctly
- **Check:** JavaScript modules are loading
- **Solution:** Verify file paths in HTML

### **Issue: Role switching doesn't work**
- **Check:** Role selector overlay is visible
- **Check:** Console for JavaScript errors
- **Solution:** Verify globalsidebardata.js is loading

### **Issue: Dark mode doesn't persist**
- **Check:** localStorage is working
- **Check:** CSS custom properties are supported
- **Solution:** Test in modern browser

### **Issue: Mobile layout broken**
- **Check:** Viewport meta tag is present
- **Check:** CSS media queries are working
- **Solution:** Test responsive breakpoints

---

## 📊 Performance Testing

### **Test 16: Load Time**
1. **Open DevTools Network tab**
2. **Reload page**
3. **Check load times:**
   - Total page load < 2 seconds
   - CSS loads quickly
   - JavaScript modules load efficiently

### **Test 17: Animation Performance**
1. **Toggle sidebar multiple times**
2. **Switch roles rapidly**
3. **Check for:**
   - Smooth 60fps animations
   - No visual glitches
   - Responsive interactions

---

## 🎉 Testing Complete!

If all tests pass, your Global Shell system is ready for production integration!

**Next Steps:**
1. Document any issues found
2. Test on different browsers (Chrome, Firefox, Safari, Edge)
3. Test on different devices (desktop, tablet, mobile)
4. Begin integration with existing pages