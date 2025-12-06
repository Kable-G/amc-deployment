# 🚨 Login Issue - Quick Troubleshooting Guide

## 🔍 **IMMEDIATE CHECKS:**

### **1. Check Server Status**
```bash
# Check if server is running
npm run dev

# Look for these in console:
✅ "Server running on port 5000"
✅ "MongoDB connected successfully"
❌ Any error messages or crashes
```

### **2. Check Browser Console**
1. **Open DevTools** (F12)
2. **Go to Console tab**
3. **Look for errors** when trying to login
4. **Check Network tab** for failed API calls

### **3. Test Basic Server Health**
Open in browser: `http://localhost:5000/api/health`
**Expected:** `{"status":"OK","timestamp":"..."}`

## 🛠️ **COMMON SOLUTIONS:**

### **Solution 1: Clear Browser Data**
```javascript
// Run in browser console
localStorage.clear()
sessionStorage.clear()
location.reload()
```

### **Solution 2: Check Login Endpoint**
Test login API directly:
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@automediacenter.com","password":"admin123"}'
```

### **Solution 3: Reset Admin User**
```bash
# Run the admin reset script
node resetAdmin.js
```

### **Solution 4: Check MongoDB Connection**
```bash
# Test MongoDB connection
node test-mongo-connection.js
```

## 🔧 **SPECIFIC FIXES:**

### **If Server Won't Start:**
1. **Kill existing processes:**
   ```bash
   # Windows
   taskkill /f /im node.exe
   
   # Then restart
   npm run dev
   ```

2. **Check port conflicts:**
   ```bash
   netstat -ano | findstr :5000
   ```

### **If Login API Fails:**
1. **Check auth routes:**
   - File: `routes/auth.routes.js`
   - Endpoint: `POST /api/v1/auth/login`

2. **Check middleware:**
   - File: `middleware/auth-bypass.js`
   - Should allow fake authentication

### **If Database Issues:**
1. **Check MongoDB connection string** in `.env`
2. **Verify database exists** and has users
3. **Run:** `node test-mongo-connection.js`

## 🎯 **QUICK TEST SEQUENCE:**

### **Test 1: Server Health**
```
http://localhost:5000/api/health
Expected: {"status":"OK"}
```

### **Test 2: Login Page**
```
http://localhost:5000/login-test.html
Expected: Login form loads
```

### **Test 3: Admin Login**
```
Email: admin@automediacenter.com
Password: admin123
Expected: Successful login
```

### **Test 4: Test User Login**
```
Email: amctestuser001@outlook.com
Password: testpassword123
Expected: Successful login
```

## 🚨 **EMERGENCY ROLLBACK:**

If the radar routes change caused issues:

### **Revert Radar Routes:**
```bash
git checkout HEAD~1 routes/radarRoutes.js
```

### **Or Manual Revert:**
Replace lines 248-319 in `routes/radarRoutes.js` with:
```javascript
router.get('/history/by-uuid/:uuid', auth, async (req, res) => {
    try {
        let alert = await RadarAlertArchive.findOne({ uuid: req.params.uuid, user: req.user.id }).populate('user', 'email').lean();
        if (!alert) {
             alert = await RadarAlert.findOne({ uuid: req.params.uuid, user: req.user.id }).populate('user', 'email').lean();
            if(!alert) return res.status(404).json({ success: false, error: 'Alert not found in active or archived records.' });
        }
        res.json({ success: true, data: alert });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
```

## 📞 **WHAT TO CHECK FIRST:**

1. **✅ Server console** - Any error messages?
2. **✅ Browser console** - Any JavaScript errors?
3. **✅ Network tab** - Are API calls failing?
4. **✅ MongoDB** - Is database connected?
5. **✅ Port 5000** - Is server actually running?

## 🎯 **MOST LIKELY CAUSES:**

1. **Server crashed** during restart
2. **Port conflict** - something else using port 5000
3. **MongoDB connection** lost
4. **Browser cache** issues
5. **Authentication middleware** problem

**Try the solutions in order above. The login issue is likely unrelated to the radar routes change, but we can revert if needed.**