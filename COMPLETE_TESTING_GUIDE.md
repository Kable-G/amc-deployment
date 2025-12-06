# 🧪 COMPLETE TESTING GUIDE
## AutoMediaCenter Multi-Tenant Email Invitation System

### 🚀 **TESTING OVERVIEW**

This guide will walk you through testing **EVERY COMPONENT** of the system:
1. **Backend API Testing** (Authentication, Security, Email)
2. **Frontend Integration Testing** (Dashboards, Forms, UI)
3. **Email System Testing** (SMTP, Templates, Delivery)
4. **Security Testing** (Data Isolation, Access Control)
5. **Multi-Tenant Testing** (Company Separation, Role-Based Access)

---

## 📋 **PRE-TESTING SETUP**

### **1. Start the Backend Server**
```bash
cd Backend
npm start
# Should see: "Server running on port 5000"
# Should see: "Connected to MongoDB"
```

### **2. Start the Frontend Server**
```bash
cd Frontend
# Open any HTML file in browser or use Live Server
# Recommended: http://localhost:3000 or file:// URLs
```

### **3. Verify Environment Configuration**
```bash
# Check Backend/.env file exists with:
MONGODB_URI=mongodb://localhost:27017/automediacenter
JWT_SECRET=your-secret-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
BASE_URL=http://localhost:3000
```

---

## 🔐 **PHASE 1: AUTHENTICATION SYSTEM TESTING**

### **Test 1.1: Platform Admin Login**
```bash
# Method: POST
# URL: http://localhost:5000/api/v1/auth/login
# Headers: Content-Type: application/json
# Body:
{
  "email": "admin@automediacenter.com",
  "password": "admin123"
}

# Expected Response:
{
  "success": true,
  "message": "Login successful.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "admin@automediacenter.com",
    "role": "platform_admin",
    "clientId": null
  }
}
```

### **Test 1.2: Token Validation**
```bash
# Method: GET
# URL: http://localhost:5000/api/v1/auth/validate-permissions
# Headers: 
#   Content-Type: application/json
#   Authorization: Bearer <token-from-login>

# Expected Response:
{
  "success": true,
  "user": {
    "role": "platform_admin",
    "level": 3,
    "permissions": {
      "canAccessAdmin": true
    }
  }
}
```

### **Test 1.3: Invalid Token Handling**
```bash
# Method: GET
# URL: http://localhost:5000/api/v1/auth/validate-permissions
# Headers: Authorization: Bearer invalid-token

# Expected Response:
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid access token"
}
```

---

## 🏢 **PHASE 2: COMPANY MANAGEMENT TESTING**

### **Test 2.1: Create Company (Platform Admin)**
```bash
# Method: POST
# URL: http://localhost:5000/api/admin/companies
# Headers: 
#   Content-Type: application/json
#   Authorization: Bearer <platform-admin-token>
# Body:
{
  "companyId": "TEST001",
  "name": "Test Company Inc",
  "contactEmail": "contact@testcompany.com",
  "contactPerson": "John Doe",
  "contactPhone": "+1-555-0123",
  "companyWebsite": "https://testcompany.com"
}

# Expected Response:
{
  "success": true,
  "message": "Company created successfully",
  "company": {
    "id": "...",
    "companyId": "TEST001",
    "name": "Test Company Inc",
    "status": "pending"
  }
}
```

### **Test 2.2: List All Companies**
```bash
# Method: GET
# URL: http://localhost:5000/api/admin/companies
# Headers: Authorization: Bearer <platform-admin-token>

# Expected Response:
{
  "success": true,
  "companies": [
    {
      "id": "...",
      "companyId": "TEST001",
      "name": "Test Company Inc",
      "status": "pending"
    }
  ]
}
```

### **Test 2.3: Activate Company**
```bash
# Method: PATCH
# URL: http://localhost:5000/api/admin/companies/<company-id>
# Headers: 
#   Content-Type: application/json
#   Authorization: Bearer <platform-admin-token>
# Body:
{
  "status": "active"
}

# Expected Response:
{
  "success": true,
  "message": "Company updated successfully"
}
```

---

## 📧 **PHASE 3: EMAIL INVITATION TESTING**

### **Test 3.1: Send Client Admin Invitation**
```bash
# Method: POST
# URL: http://localhost:5000/api/admin/companies/<company-id>/invite
# Headers: 
#   Content-Type: application/json
#   Authorization: Bearer <platform-admin-token>
# Body:
{
  "email": "admin@testcompany.com",
  "name": "Jane Smith",
  "role": "client_admin"
}

# Expected Response:
{
  "success": true,
  "message": "Invitation sent successfully",
  "invite": {
    "id": "...",
    "email": "admin@testcompany.com",
    "role": "client_admin",
    "emailStatus": "sent"
  }
}
```

### **Test 3.2: Check Email Delivery**
1. **Check your email inbox** for invitation email
2. **Verify email content:**
   - Subject: "Invitation to join Test Company Inc on AutoMediaCenter"
   - Greeting: "Hello Jane" (first name only)
   - Company name mentioned
   - Accept invitation button/link
   - Professional HTML formatting

### **Test 3.3: Validate Invitation Token**
```bash
# Method: GET
# URL: http://localhost:5000/api/v1/auth/validate-invite?token=<token-from-email>

# Expected Response:
{
  "success": true,
  "invitation": {
    "email": "admin@testcompany.com",
    "role": "client_admin",
    "company": {
      "name": "Test Company Inc"
    }
  }
}
```

### **Test 3.4: Accept Invitation**
```bash
# Method: POST
# URL: http://localhost:5000/api/v1/auth/accept-invite
# Headers: Content-Type: application/json
# Body:
{
  "token": "<token-from-email>",
  "name": "Jane Smith",
  "password": "securepassword123",
  "email": "admin@testcompany.com"
}

# Expected Response:
{
  "success": true,
  "message": "Account created successfully! Welcome to AutoMediaCenter.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "role": "client_admin",
    "clientId": "<company-id>"
  }
}
```

---

## 🛡️ **PHASE 4: SECURITY TESTING**

### **Test 4.1: Company Data Isolation**
```bash
# Login as client_admin for Company A
# Try to access Company B's data:

# Method: GET
# URL: http://localhost:5000/api/client-admin/company
# Headers: Authorization: Bearer <client-admin-token>

# Should ONLY return Company A's data, never Company B's
```

### **Test 4.2: Cross-Company Access Prevention**
```bash
# Try to access another company's team:
# Method: GET
# URL: http://localhost:5000/api/client-admin/team
# Headers: Authorization: Bearer <client-admin-token>

# Should ONLY return team members from user's own company
```

### **Test 4.3: Deactivated User Access**
```bash
# 1. Deactivate a user in database:
db.users.updateOne(
  { email: "admin@testcompany.com" },
  { $set: { isActive: false } }
)

# 2. Try to use their token:
# Method: GET
# URL: http://localhost:5000/api/client-admin/company
# Headers: Authorization: Bearer <deactivated-user-token>

# Expected Response:
{
  "success": false,
  "error": "Forbidden",
  "message": "User account has been deactivated",
  "action": "redirect_login"
}
```

### **Test 4.4: Suspended Company Access**
```bash
# 1. Suspend company in database:
db.companies.updateOne(
  { companyId: "TEST001" },
  { $set: { status: "suspended" } }
)

# 2. Try to access with company user token:
# Expected Response:
{
  "success": false,
  "error": "Forbidden",
  "message": "Company is suspended and cannot access the system",
  "action": "contact_admin"
}
```

---

## 🎯 **PHASE 5: CLIENT ADMIN DASHBOARD TESTING**

### **Test 5.1: Access Client Admin Dashboard**
1. **Open:** `client-admin-dashboard.html`
2. **Login with client admin credentials**
3. **Verify dashboard loads:**
   - Company information displayed
   - Team members list
   - Invitation management section

### **Test 5.2: Company Information Management**
```javascript
// Should see company details form with:
// - Company name (read-only)
// - Contact person (editable)
// - Contact phone (editable)
// - Company website (editable)
// - Update button working
```

### **Test 5.3: Team Member Management**
```javascript
// Should see team members table with:
// - List of all company team members
// - Edit member button (name, role)
// - Deactivate member button
// - Cannot deactivate self
```

### **Test 5.4: Send Client User Invitation**
```javascript
// Test invitation form:
// 1. Fill in email, name, role
// 2. Click "Send Invitation"
// 3. Verify success message
// 4. Check email delivery
// 5. Verify invitation appears in pending list
```

---

## 🌐 **PHASE 6: FRONTEND INTEGRATION TESTING**

### **Test 6.1: Platform Admin Dashboard**
1. **Open:** `platform-admin-dashboard.html`
2. **Login as platform admin**
3. **Test company creation form**
4. **Test company list display**
5. **Test send invitation functionality**

### **Test 6.2: Invitation Accept Page**
1. **Click invitation link from email**
2. **Verify:** `invite-accept.html` loads
3. **Fill account creation form**
4. **Submit and verify auto-login**
5. **Verify redirect to appropriate dashboard**

### **Test 6.3: Authentication Flow**
```javascript
// Test complete authentication flow:
// 1. Login page → Dashboard
// 2. Token storage in localStorage
// 3. Automatic token validation
// 4. Logout functionality
// 5. Protected page access
```

---

## 📊 **PHASE 7: DATABASE VERIFICATION**

### **Test 7.1: Check Database Collections**
```javascript
// Connect to MongoDB and verify:

// 1. Users collection
db.users.find().pretty()
// Should show users with correct roles and clientId

// 2. Companies collection  
db.companies.find().pretty()
// Should show companies with correct status

// 3. Invites collection
db.invites.find().pretty()
// Should show invitations with status tracking

// 4. Audit events collection
db.auditevents.find().pretty()
// Should show security events and user actions
```

### **Test 7.2: Data Relationships**
```javascript
// Verify user-company relationships:
db.users.aggregate([
  {
    $lookup: {
      from: "companies",
      localField: "clientId", 
      foreignField: "_id",
      as: "company"
    }
  }
])
```

---

## 🚨 **PHASE 8: ERROR HANDLING TESTING**

### **Test 8.1: Invalid Email Addresses**
```bash
# Try sending invitation to invalid email:
{
  "email": "invalid-email",
  "name": "Test User",
  "role": "client_user"
}

# Expected: Validation error
```

### **Test 8.2: Duplicate Invitations**
```bash
# Send invitation to same email twice:
# Expected: "Pending invitation already exists" error
```

### **Test 8.3: Expired Tokens**
```bash
# Use invitation token after 7 days:
# Expected: "This invitation has expired" error
```

### **Test 8.4: Network Failures**
```bash
# Test with SMTP server down:
# Expected: Email marked as "failed" with retry logic
```

---

## 📈 **PHASE 9: PERFORMANCE TESTING**

### **Test 9.1: Load Testing**
```bash
# Use curl or Postman to send multiple requests:
for i in {1..100}; do
  curl -X GET "http://localhost:5000/api/client-admin/company" \
    -H "Authorization: Bearer <token>" &
done

# Verify: All requests return correct company data only
```

### **Test 9.2: Database Query Performance**
```javascript
// Check query execution time:
db.users.find({ clientId: ObjectId("...") }).explain("executionStats")
// Should use index on clientId field
```

---

## ✅ **TESTING CHECKLIST**

### **Authentication & Security**
- [ ] Platform admin login works
- [ ] Client admin login works  
- [ ] Token validation works
- [ ] Invalid tokens rejected
- [ ] Deactivated users blocked
- [ ] Suspended companies blocked
- [ ] Cross-company access prevented
- [ ] Real-time status validation works

### **Company Management**
- [ ] Company creation works
- [ ] Company listing works
- [ ] Company status updates work
- [ ] Company data isolation enforced

### **Email System**
- [ ] SMTP configuration works
- [ ] Email templates render correctly
- [ ] Personalized greetings work
- [ ] Email delivery successful
- [ ] Retry logic handles failures
- [ ] Email status tracking works

### **Invitation System**
- [ ] Platform admin can invite client admins
- [ ] Client admin can invite client users
- [ ] Token generation secure
- [ ] Token validation works
- [ ] Invitation acceptance works
- [ ] Auto-login after acceptance works
- [ ] Duplicate invitation prevention works
- [ ] Expired token handling works

### **Frontend Integration**
- [ ] Platform admin dashboard works
- [ ] Client admin dashboard works
- [ ] Invitation accept page works
- [ ] Authentication flow complete
- [ ] Error messages display correctly
- [ ] Success messages display correctly

### **Database Integrity**
- [ ] User-company relationships correct
- [ ] Invitation tracking accurate
- [ ] Audit events logged properly
- [ ] Data isolation maintained

---

## 🐛 **TROUBLESHOOTING COMMON ISSUES**

### **Email Not Sending**
```bash
# Check SMTP configuration:
# 1. Verify Gmail App Password (not regular password)
# 2. Check SMTP_HOST=smtp.gmail.com
# 3. Check SMTP_PORT=587
# 4. Verify BASE_URL points to frontend
```

### **Token Validation Failing**
```bash
# Check JWT_SECRET:
# 1. Ensure JWT_SECRET is set in .env
# 2. Restart server after changing .env
# 3. Clear browser localStorage
```

### **Database Connection Issues**
```bash
# Check MongoDB:
# 1. Ensure MongoDB is running
# 2. Verify MONGODB_URI in .env
# 3. Check database permissions
```

### **CORS Issues**
```bash
# Add CORS headers if needed:
app.use(cors({
  origin: ['http://localhost:3000', 'file://'],
  credentials: true
}));
```

---

## 🎯 **SUCCESS CRITERIA**

**✅ SYSTEM IS WORKING CORRECTLY WHEN:**

1. **Platform admin can create companies and send invitations**
2. **Emails are delivered with correct personalization**
3. **Users can accept invitations and create accounts**
4. **Client admins can only see their company's data**
5. **Security middleware blocks unauthorized access**
6. **Deactivated users and suspended companies are blocked**
7. **All database relationships are correct**
8. **Frontend dashboards load and function properly**
9. **Error handling works for all edge cases**
10. **Audit logs capture all security events**

**🚨 IMMEDIATE ACTION REQUIRED IF:**
- Cross-company data is visible
- Deactivated users can still access system
- Suspended companies can still operate
- Email invitations are not delivered
- Database relationships are incorrect

---

**Testing Guide Version:** 1.0  
**Last Updated:** 2025-01-09  
**Estimated Testing Time:** 2-3 hours for complete testing  
**Required Tools:** Browser, Postman/curl, MongoDB client