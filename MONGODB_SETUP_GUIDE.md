# MongoDB Atlas Three-Level User System Setup Guide

## Overview
This guide will help you set up the proper user profiles in MongoDB Atlas to fix the authentication issues with AssetDBmenu1.6.html access.

## The Problem
Currently, your `public@test.com` user has the role `media_user` (Level 1), but AssetDBmenu1.6.html requires Level 2+ access (`client_user`, `client_admin`, or `platform_admin`). The page is loading but making API calls that fail, creating the corrupted interface with multiple "Access Denied" messages.

## The Solution
Set up proper user profiles with the correct roles and client associations in MongoDB Atlas.

---

## Step 1: Run the Setup Script

### Option A: Automatic Setup (Recommended)
```bash
# Navigate to your Backend directory
cd C:\Users\Administrator\Documents\2025\amc\Backend

# Run the setup script
node setup-mongodb-users.js
```

### Option B: Manual MongoDB Atlas Setup
If the script fails, you can manually create users in MongoDB Atlas:

1. **Go to MongoDB Atlas Dashboard**
   - Visit https://cloud.mongodb.com
   - Navigate to your cluster
   - Click "Browse Collections"

2. **Create Test Client Company**
   - Go to the `clients` collection
   - Click "Insert Document"
   - Add this document:
   ```json
   {
     "name": "Test Client Corp",
     "description": "Test client company for three-level authentication system",
     "contactEmail": "contact@testclient.com",
     "isActive": true,
     "createdAt": {"$date": "2025-01-29T15:00:00.000Z"},
     "updatedAt": {"$date": "2025-01-29T15:00:00.000Z"}
   }
   ```
   - **Copy the generated `_id` value** - you'll need this for user setup

3. **Create/Update Users**
   - Go to the `users` collection
   - For each user below, either update existing or create new:

---

## Step 2: User Profiles to Create/Update

### Level 1: Public User (media_user)
```json
{
  "email": "public@test.com",
  "password": "$2a$10$[HASHED_PASSWORD]",
  "name": "Public Test User",
  "role": "media_user",
  "clientId": null,
  "isActive": true,
  "createdAt": {"$date": "2025-01-29T15:00:00.000Z"},
  "updatedAt": {"$date": "2025-01-29T15:00:00.000Z"}
}
```
**Access:** Can only view public pages (AutoMediaCenter, AutoMediaRadar)
**Cannot Access:** AssetDBmenu1.6.html, management tools

### Level 2: Client User (client_user)
```json
{
  "email": "testuser@example.com",
  "password": "$2a$10$[HASHED_PASSWORD]",
  "name": "Your Existing Account",
  "role": "client_user",
  "clientId": {"$oid": "[CLIENT_ID_FROM_STEP_2]"},
  "isActive": true,
  "createdAt": {"$date": "2025-01-29T15:00:00.000Z"},
  "updatedAt": {"$date": "2025-01-29T15:00:00.000Z"}
}
```
**Access:** Can access AssetDBmenu1.6.html, upload dashboard, manage own releases

### Level 2: Client Admin (client_admin)
```json
{
  "email": "clientadmin@test.com",
  "password": "$2a$10$[HASHED_PASSWORD]",
  "name": "Client Admin User",
  "role": "client_admin",
  "clientId": {"$oid": "[CLIENT_ID_FROM_STEP_2]"},
  "isActive": true,
  "createdAt": {"$date": "2025-01-29T15:00:00.000Z"},
  "updatedAt": {"$date": "2025-01-29T15:00:00.000Z"}
}
```
**Access:** All client_user permissions + client admin functions

### Level 3: Platform Admin (platform_admin)
```json
{
  "email": "admin@test.com",
  "password": "$2a$10$[HASHED_PASSWORD]",
  "name": "Platform Admin User",
  "role": "platform_admin",
  "clientId": null,
  "isActive": true,
  "createdAt": {"$date": "2025-01-29T15:00:00.000Z"},
  "updatedAt": {"$date": "2025-01-29T15:00:00.000Z"}
}
```
**Access:** Full platform access, can manage all users and content

---

## Step 3: Password Hashing

If creating users manually, you need to hash passwords. Use this Node.js snippet:

```javascript
const bcrypt = require('bcryptjs');

async function hashPassword() {
    const password = 'password123';
    const hashed = await bcrypt.hash(password, 10);
    console.log('Hashed password:', hashed);
}

hashPassword();
```

Replace `$2a$10$[HASHED_PASSWORD]` with the output from this script.

---

## Step 4: Test the Setup

1. **Open the test page:**
   ```
   http://localhost:5000/login-test-mongodb.html
   ```

2. **Test each user level:**
   - Login as `public@test.com` (should NOT access AssetDBmenu1.6.html)
   - Login as `testuser@example.com` (should access AssetDBmenu1.6.html)
   - Login as `clientadmin@test.com` (should access AssetDBmenu1.6.html)
   - Login as `admin@test.com` (should access everything)

3. **Test AssetDBmenu1.6.html access:**
   ```
   http://localhost:5000/AssetDBmenu1.6.html
   ```

---

## Step 5: Verify the Fix

After setting up users correctly:

1. **Login as media_user (public@test.com):**
   - Should get clean "Access Denied" page instead of corrupted interface
   - No multiple error overlays

2. **Login as client_user or higher:**
   - Should access AssetDBmenu1.6.html without issues
   - All API calls should work properly

---

## Troubleshooting

### If the script fails:
1. Check your `.env` file has correct `MONGO_URI`
2. Ensure your MongoDB Atlas cluster is running
3. Check network connectivity to Atlas

### If users aren't created:
1. Verify the User and Client models exist in your `models/` directory
2. Check for any validation errors in the console output

### If authentication still fails:
1. Clear browser localStorage: `localStorage.clear()`
2. Restart your backend server
3. Check the server logs for authentication errors

---

## Expected Results

After successful setup:

✅ **media_user** gets proper "Access Denied" page (not corrupted interface)
✅ **client_user** and above can access AssetDBmenu1.6.html
✅ No more multiple authentication error overlays
✅ Clean, proper access control

---

## Commands Summary

```bash
# Run the automated setup
node setup-mongodb-users.js

# Test the users
# Visit: http://localhost:5000/login-test-mongodb.html

# Test admin page access
# Visit: http://localhost:5000/AssetDBmenu1.6.html
```

All passwords are: `password123`