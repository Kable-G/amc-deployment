# AutoMediaCenter User Tracking & Analytics Report

## Executive Summary

AutoMediaCenter has a sophisticated multi-layered user tracking and analytics system that captures comprehensive user behavior, geographic data, business intelligence metrics, and audit trails. The system supports enterprise-grade analytics with GDPR compliance and advanced segmentation capabilities.

---

## 1. User Data Collection Architecture

### 1.1 Primary User Model (`User.js`)
**Collection:** `users`
**Core Tracking Fields:**
- **Identity:** `email`, `name`, `role`, `clientId`
- **Geographic:** `country` (user-provided)
- **Professional:** `jobTitle`, `company`
- **Timestamps:** `lastLoginAt`, `createdAt`, `updatedAt`
- **Status:** `isActive`, `emailVerified`

**User Roles Tracked:**
- `media_user` - Public media professionals
- `client_user` - Company employees
- `client_admin` - Company administrators
- `platform_admin` - AutoMediaCenter staff

### 1.2 Advanced Analytics Model (`UserAnalytics.js`)
**Collection:** `useranalytics`
**Comprehensive Tracking:**

#### Session Data
- IP address, user agent, browser, OS, device
- Screen resolution, timezone, language
- Session duration, referrer, landing/exit pages

#### Geographic Intelligence
- **Country, region, city**
- **Latitude/longitude coordinates**
- **ISP and organization data**
- **Sortable by country/region** ✅

#### Content Engagement
- Page views with time-on-page and scroll depth
- Content interactions (releases, radar alerts, vault assets)
- Download tracking with file types and completion rates
- Search behavior and query analysis

#### Business Intelligence
- **Lead scoring algorithm**
- **Engagement scoring**
- **Company size and industry classification**
- **Decision maker identification**
- **Intent signals tracking**

---

## 2. Login Routes & Timestamp Tracking

### 2.1 Authentication Routes

#### Primary Route: `/api/v1/auth/login`
- **File:** `routes/auth.routes.js`
- **Timestamp Field:** `lastLoginAt`
- **Used By:** All user types (recommended)
- **Features:** Rate limiting, security headers, audit logging

#### Alternative Route: `/api/v1/users/login`
- **File:** `routes/user.routes.js`
- **Timestamp Field:** `lastLogin`
- **Used By:** Enhanced user system
- **Features:** Advanced analytics integration

### 2.2 Timestamp Fields
- **`lastLoginAt`** - Primary login timestamp (ISO Date)
- **`lastLogin`** - Alternative login timestamp (ISO Date)
- **Frontend displays both** for compatibility

---

## 3. Geographic & Regional Analytics

### 3.1 Available Geographic Data
**User Model:**
- ✅ **Country** (user-provided during registration)

**UserAnalytics Model:**
- ✅ **Country, Region, City** (IP-based geolocation)
- ✅ **Latitude/Longitude** coordinates
- ✅ **ISP and Organization** data

### 3.2 Sorting & Filtering Capabilities
**Current Implementation:**
- ✅ Sort by country in user management
- ✅ Filter by role, status, creation date
- ✅ Search across email, name, company
- ✅ Geographic indexes for performance

**Potential Enhancements:**
- Region-based user segmentation
- Country-specific analytics dashboards
- Geographic user distribution reports

---

## 4. Audit Trail System

### 4.1 Audit Events Model (`AuditEvent.js`)
**Collection:** `auditevents`
**Tracked Events:**
- User lifecycle (creation, login, role changes)
- Authentication events (login attempts, password resets)
- Content management (uploads, releases, alerts)
- Security events (access validation, company mismatches)

### 4.2 Audit Capabilities
- **Company-scoped audit trails**
- **User-specific activity logs**
- **Platform-wide security monitoring**
- **IP address and user agent tracking**

---

## 5. Analytics & Reporting Features

### 5.1 User Management Dashboard
**Current Features:**
- Real-time user statistics by role
- Last login tracking with date/time
- Bulk operations (suspend, activate, delete)
- Advanced filtering and search
- Export capabilities

### 5.2 Business Intelligence
**Lead Scoring Algorithm:**
- Base engagement score
- Company email domain analysis (+50 points)
- Job title seniority indicators (+30 points)
- High-value content downloads (+25 each)
- Multiple session tracking (+20 points)

**Engagement Scoring:**
- Page views (1 point each, max 50)
- Time on site (1 point per minute, max 100)
- Downloads (5 points each, max 100)
- Content interactions (3 points each, max 150)
- Form completions (10 points each, max 100)

---

## 6. Privacy & Compliance

### 6.1 GDPR Compliance
- **Consent tracking** with timestamps and versions
- **Data export functionality** for user requests
- **Privacy-first design** with opt-in analytics
- **Secure data handling** with encryption

### 6.2 Data Retention
- **User data:** Retained per privacy policy
- **Analytics data:** Configurable retention periods
- **Audit logs:** Long-term retention for security

---

## 7. Technical Implementation

### 7.1 Database Indexes
**Performance Optimizations:**
- User queries by role, clientId, email
- Analytics queries by userId, country, timestamp
- Audit queries by clientId, action, date ranges

### 7.2 API Endpoints
**User Management:**
- `GET /api/v1/user-management/admin/users` - User list with analytics
- `GET /api/v1/user-management/admin/users/stats` - User statistics

**Analytics:**
- Session tracking, content engagement, download monitoring
- Real-time analytics updates via middleware

---

## 8. Recommendations

### 8.1 Enhanced Geographic Analytics
1. **Add region filter** to user management interface
2. **Create geographic distribution dashboard**
3. **Implement country-based user segmentation**
4. **Add timezone-aware analytics**

### 8.2 Advanced Reporting
1. **User journey mapping** across sessions
2. **Cohort analysis** by registration date/country
3. **Content performance** by geographic region
4. **Login pattern analysis** by time zones

### 8.3 Business Intelligence
1. **Predictive lead scoring** with ML models
2. **Automated user segmentation** based on behavior
3. **Real-time intent signal detection**
4. **Custom dashboard creation** for different roles

---

## 9. Current Status Summary

✅ **Working Features:**
- Multi-route login timestamp tracking
- Geographic data collection (country/region/city)
- Comprehensive user analytics
- Enterprise user management interface
- Audit trail system
- GDPR compliance framework

🔄 **Available for Enhancement:**
- Advanced geographic reporting
- Real-time analytics dashboards
- Predictive analytics
- Custom segmentation tools

**The system provides enterprise-grade user tracking with extensive geographic, behavioral, and business intelligence capabilities, fully supporting country/region-based sorting and analysis.**