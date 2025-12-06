# AutoMediaCenter User Management - Platform Admin Guide

## Overview
The User Management interface provides comprehensive control over all registered users across the AutoMediaCenter platform. This guide covers all features and operations available to Platform Administrators.

---

## 📊 Dashboard Overview

### Statistics Cards
At the top of the page, you'll see 5 color-coded statistics cards:

- **🟣 Total Users** - All registered users across the platform
- **🔵 Media Users** - Users with media access (no company association)
- **🟢 Client Users** - Standard users belonging to client companies
- **🟡 Client Admin Users** - Administrative users for client companies
- **🔴 Platform Admin Users** - Your team members with full platform access

Each card shows the current count and monthly growth (+X this month).

---

## 🔍 Search & Filtering

### Real-Time Search
- **Search Box**: Type in the search field to instantly filter users
- **Search Across**: Email addresses, names, and company names
- **Real-Time**: Results update as you type (300ms delay)
- **Clear Search**: Press `Escape` to clear the search field

### Filter Options
- **All Roles**: Filter by user role (Media User, Client User, Client Admin, Platform Admin)
- **All Status**: Filter by account status (Active, Suspended)
- **Combined Filtering**: Search and filters work together

---

## 👥 User Table

### Table Columns
1. **☑️ Checkbox** - Select users for bulk operations
2. **User** - Email address, User ID, and full name
3. **Role** - Color-coded role pills with glass treatment:
   - 🔵 **Media User** - Blue pill
   - 🟢 **Client User** - Green pill  
   - 🟡 **Client Admin** - Yellow pill
   - 🔴 **Platform Admin** - Red pill
4. **Company** - Associated company or "AutoMediaCenter"/"No Company"
5. **Status** - Account status pills:
   - 🟢 **Active** - User can login
   - 🔴 **Suspended** - User cannot login
6. **Last Login** - Date of last successful login or "Never"
7. **Actions** - Individual user actions (⋮ menu)

### Pagination
- **12 users per page** for optimal performance
- **Navigation**: Use ◀️ ▶️ buttons to navigate pages
- **Page Info**: Shows "Page X of Y" and "Showing X-Y of Z users"

---

## ⚡ Bulk Operations

### Selecting Users
1. **Individual Selection**: Check boxes next to specific users
2. **Select All**: Use the header checkbox to select all users on current page
3. **Mixed Selection**: Combine individual and select-all as needed

### Bulk Actions Bar
When users are selected, a blue actions bar appears with:

#### 🟢 Activate Button
- **Purpose**: Reactivate suspended user accounts
- **Action**: Sets `isActive: true` in database
- **Result**: Users can login again, status shows green "Active" pill
- **Confirmation**: "Are you sure you want to activate X user(s)?"

#### 🟡 Suspend Button  
- **Purpose**: Temporarily disable user accounts (RECOMMENDED over delete)
- **Action**: Sets `isActive: false` in database
- **Result**: Users cannot login, status shows red "Suspended" pill
- **Confirmation**: "Are you sure you want to suspend X user(s)? This will revoke their access but preserve their data."
- **Reversible**: Can be undone with Activate

#### 🔴 Delete Button
- **Purpose**: Permanently remove users from the system
- **Action**: Completely removes user records from database
- **Result**: Users disappear from table entirely
- **⚠️ WARNING**: This action is **IRREVERSIBLE** and destroys all user data
- **Confirmation**: "⚠️ DANGER: Are you sure you want to permanently delete X user(s)? This action cannot be undone and will remove all user data. Consider suspending users instead to preserve data."

#### ⚪ Cancel Button
- **Purpose**: Clear all selections and hide bulk actions bar
- **Action**: Unchecks all checkboxes (frontend only)
- **Result**: Bulk actions bar disappears, no server interaction

---

## 🔧 Individual User Actions

### Kebab Menu (⋮)
Click the three dots in the Actions column for individual user options:

#### 👁️ View
- **Purpose**: Display detailed user information
- **Status**: Coming soon

#### ✏️ Edit  
- **Purpose**: Modify user details and permissions
- **Status**: Coming soon

#### 🟡 Suspend / 🟢 Activate
- **Purpose**: Toggle individual user account status
- **Suspend**: Disables login, preserves data (reversible)
- **Activate**: Re-enables suspended accounts
- **Confirmation**: Required for both actions

#### 🔴 Delete
- **Purpose**: Permanently remove individual user
- **⚠️ WARNING**: Irreversible action, destroys all user data
- **Confirmation**: "⚠️ DANGER: Are you sure you want to permanently delete [email]? This action cannot be undone and will remove all user data. Consider suspending the user instead to preserve data."

---

## 📋 Recommended Workflows

### 🚫 User Removal Process (RECOMMENDED)
**DON'T immediately delete users. Follow this safe workflow:**

1. **Suspend User** → User loses access but data is preserved
2. **Wait 30 days** → Grace period for potential recovery
3. **Purge if needed** → Permanent deletion after confirmation period

### 🔍 Regular Maintenance
1. **Audit Regularly** → Use "Last Login" column to find inactive users
2. **Bulk Suspend** → Suspend multiple inactive users at once  
3. **Export Data** → Keep records before any deletions (Export feature coming soon)

### 🏢 Company Management
1. **Monitor Associations** → Check company assignments are correct
2. **Role Verification** → Ensure users have appropriate roles
3. **Access Review** → Regular review of admin privileges

---

## 🎨 Visual Indicators

### Role Pills (Glass Treatment)
- **Media User**: 🔵 Blue with glass morphism effect
- **Client User**: 🟢 Green with glass morphism effect  
- **Client Admin**: 🟡 Yellow with glass morphism effect
- **Platform Admin**: 🔴 Red with glass morphism effect

### Status Pills
- **Active**: 🟢 Green pill - User can login normally
- **Suspended**: 🔴 Red pill - User login is blocked

### Company Display
- **AutoMediaCenter**: Platform admin users
- **Company Name**: Client users show their associated company
- **No Company**: Media users without company association
- **Missing Company Association**: Error state requiring attention

---

## 🔒 Security Features

### Account Suspension
- **Login Blocking**: Suspended users receive "Account suspended" error
- **Data Preservation**: All user data remains intact
- **Reversible**: Can be reactivated at any time
- **Audit Trail**: All suspension/activation actions are logged

### Audit Logging
All user management actions are automatically logged with:
- **Who**: Platform admin performing the action
- **What**: Specific action taken (suspend, activate, delete)
- **When**: Timestamp of the action
- **Target**: Which user(s) were affected
- **Metadata**: Additional context (bulk operation, user count, etc.)

### Access Control
- **Platform Admin Only**: All user management functions require platform_admin role
- **Authentication Required**: Valid JWT token must be present
- **Company Isolation**: Client admins can only manage their own company users

---

## 🌓 Interface Features

### Dark/Light Mode
- **Toggle**: Click the moon/sun icon in the header
- **Persistence**: Mode preference is saved in browser
- **Full Support**: All elements adapt to chosen theme

### Responsive Design
- **Mobile Friendly**: Table adapts to smaller screens
- **Touch Optimized**: Buttons sized for touch interaction
- **Flexible Layout**: Adjusts to different screen sizes

### Real-Time Updates
- **Instant Feedback**: Actions show immediate results
- **Auto Refresh**: Table updates after successful operations
- **Status Sync**: UI reflects current database state

---

## ⚠️ Important Warnings

### 🔴 Deletion is Permanent
- **No Recovery**: Deleted users cannot be restored
- **Data Loss**: All associated data is permanently removed
- **Recommendation**: Always suspend first, delete only after confirmation period

### 🟡 Suspension Best Practices
- **Preferred Method**: Use suspension instead of deletion when possible
- **Grace Period**: Allow time for potential reactivation requests
- **Documentation**: Keep records of why users were suspended

### 🔵 Company Associations
- **Critical Data**: Ensure company assignments are correct
- **Access Impact**: Wrong company = wrong data access
- **Regular Audits**: Review associations periodically

---

## 🆘 Troubleshooting

### Common Issues

#### "Failed to suspend/activate/delete users"
- **Cause**: Backend API error or network issue
- **Solution**: Check browser console for detailed error, retry operation
- **Escalation**: Contact technical team if persistent

#### User not showing expected status
- **Cause**: Browser cache or delayed update
- **Solution**: Refresh the page (F5) to reload current data
- **Prevention**: System auto-refreshes after operations

#### Search not finding users
- **Cause**: Exact match expectations or typos
- **Solution**: Search is partial match - try shorter terms
- **Tip**: Search works across email, name, and company fields

#### Company showing as "Missing Company Association"
- **Cause**: User has clientId but company no longer exists
- **Solution**: Either reassign user to valid company or convert to media_user
- **Prevention**: Don't delete companies with active users

---

## 📞 Support

For technical issues or questions about user management:
1. **Check Browser Console**: F12 → Console tab for error details
2. **Document the Issue**: Screenshot + steps to reproduce
3. **Contact Technical Team**: Provide console logs and user details
4. **Emergency Access**: Platform admins can always access via direct database if needed

---

## 🔄 Version History

- **v1.0**: Initial enterprise user management implementation
- **Features**: Bulk operations, advanced filtering, audit logging, suspension system
- **Security**: Platform admin only, comprehensive logging, reversible actions
- **UI**: Glass morphism pills, dark/light mode, responsive design

---

*This guide covers all current functionality. Features marked as "Coming soon" will be added in future updates.*