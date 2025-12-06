# 🚀 AutoMediaCenter Server Setup Documentation

## 📋 CURRENT SERVER STATUS

**✅ ACTIVE SERVER FILE:** `server.js`
- This is your MAIN and ONLY server file
- All authentication is handled through this file
- MongoDB connection is properly configured
- All routes are mounted and working

## 🔧 SERVER ARCHITECTURE

### Authentication System
- **Real JWT-based authentication** is ENABLED
- Authentication routes: `/api/v1/auth/*`
- Admin routes: `/api/v1/admin/*` (Platform admin only)
- Company onboarding routes: `/api/companies/*` and `/api/v1/companies/*`

### Key Routes Mounted:
```javascript
// Core API Routes (v1)
app.use('/api/v1/auth', authRoutes);           // Authentication
app.use('/api/v1/admin', adminRoutes);         // Platform admin
app.use('/api/v1/events', eventsRoutes);       // Events
app.use('/api/v1/center', centerRoutes);       // Center
app.use('/api/v1/vault', vaultRoutes);         // Vault
app.use('/api/v1/radar', radarRoutes);         // Radar
app.use('/api/v1/analytics', analyticsRoutes); // Analytics
app.use('/api/v1/downloads', downloadRoutes);  // Downloads
app.use('/api/v1/zip', zipDownloadRoutes);     // ZIP downloads

// Enterprise Client Onboarding (dual mounting)
app.use('/api/companies', companyRoutes);      // Company management
app.use('/api/companies', userManagementRoutes); // User management
app.use('/api/audit', auditRoutes);            // Audit logs

// Alternative v1 mounting
app.use('/api/v1/companies', companyRoutes);
app.use('/api/v1/user-management', userManagementRoutes);
app.use('/api/v1/audit', auditRoutes);
```

## 👥 USER ROLES & AUTHENTICATION

### Test Users to Verify:
1. **Platform Admin:** `admin@automediacenter.com`
2. **Company Admin:** `martha.doe@mercedes.com` 
3. **Company User:** `joe.bloggs@mercedes.com`

### Authentication Flow:
1. Login via `/api/v1/auth/login`
2. Receive JWT token
3. Use token in Authorization header: `Bearer <token>`
4. Role-based access control enforced by middleware

## 🗄️ DATABASE CONNECTION

- **MongoDB Atlas** connection configured
- Connection string in `.env` file (MONGO_URI)
- Automatic retry and connection pooling enabled
- Debug mode available in development

## 📁 DIRECTORY STRUCTURE

```
Backend/
├── server.js                 ← MAIN SERVER FILE (USE THIS)
├── package.json              ← Dependencies
├── .env                      ← Environment variables
├── routes/                   ← All API routes
├── models/                   ← Database models
├── middleware/               ← Authentication & security
├── config/                   ← Configuration files
├── public/                   ← Static files
├── services/                 ← Business logic
└── old-files/                ← Archived utility scripts
```

## 🚨 IMPORTANT NOTES

### ✅ DO USE:
- `server.js` - This is your main server
- All files in `routes/`, `models/`, `middleware/`, `config/`, `services/`
- `.env` and `.env.production` for environment variables

### ❌ DON'T USE:
- Any files in `old-files/` directory
- Any `server-*.js` files (they've been moved to old-files)
- Test files (moved to old-files)

## 🔄 HOW TO START THE SERVER

```bash
cd Backend
npm start
# OR
node server.js
```

Server will start on port 5000 (or PORT from .env)
API base URL: `http://localhost:5000/api/v1/`

## 🧪 TESTING AUTHENTICATION

### 1. Login Test:
```bash
POST http://localhost:5000/api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@automediacenter.com",
  "password": "admin123"
}
```

### 2. Company Onboarding Test:
```bash
POST http://localhost:5000/api/companies/invite
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "companyName": "Test Company",
  "contactEmail": "test@company.com",
  "contactPerson": "John Doe",
  "planType": "enterprise"
}
```

## 📝 NEXT STEPS

1. ✅ Server cleanup completed
2. ⏳ Test MongoDB authentication
3. ⏳ Verify role-based access for all user types
4. ⏳ Test company onboarding flow
5. ⏳ Confirm all authentication endpoints work

---

**Last Updated:** $(date)
**Server Status:** ✅ ACTIVE - server.js
**Authentication:** ✅ ENABLED - JWT-based
**Database:** ✅ CONNECTED - MongoDB Atlas