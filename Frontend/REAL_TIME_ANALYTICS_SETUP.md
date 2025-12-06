# Real-Time Analytics Setup Guide

## Overview
This system captures **real user interactions** from your AutoMediaCenter pages and displays them in your existing `amc-analytics.html` dashboard.

## How It Works
1. **Real Tracking**: `amc-real-tracker.js` captures actual user clicks, downloads, page views, modal opens
2. **Backend Storage**: `analytics.routes.js` receives and stores real data (no fake data)
3. **Dashboard Connection**: `amc-analytics-connector.js` feeds real data to your existing analytics dashboard

## Quick Setup (3 Steps)

### Step 1: Add Real Tracking to Your Pages
Add this script tag to the pages you want to track:

**Add to `automediacenter.html`:**
```html
<!-- Add before closing </body> tag -->
<script src="amc-real-tracker.js"></script>
```

**Add to `amc-release-detail.html`:**
```html
<!-- Add before closing </body> tag -->
<script src="amc-real-tracker.js"></script>
```

**Add to any other pages you want to track:**
```html
<script src="amc-real-tracker.js"></script>
```

### Step 2: Connect Your Analytics Dashboard
Add this to your existing `amc-analytics.html`:

```html
<!-- Add before closing </body> tag, after your existing scripts -->
<script src="amc-analytics-connector.js"></script>
```

### Step 3: Test the System
1. **Start your backend server** (it already has the analytics routes)
2. **Login** using `login-test.html` (Level 2+ required for analytics)
3. **Visit tracked pages** - click downloads, open modals, view releases
4. **Check analytics dashboard** - should show real data within 30 seconds

## What Gets Tracked (Real Data Only)

### Automatic Tracking
- **Page Views**: Every time someone visits a tracked page
- **Downloads**: Any click on download links or buttons
- **Modal Opens**: When modals/popups are opened
- **Release Views**: When someone views release detail pages
- **Time on Page**: How long users spend on pages

### Manual Tracking (Optional)
You can also track custom events:
```javascript
// Track a search
window.amcTracker.trackSearch('ferrari 2024', 15);

// Track a filter usage
window.amcTracker.trackFilter('brand', 'audi');

// Track any custom event
window.amcTracker.trackCustomEvent('video_play', { videoId: 'abc123' });
```

## Dashboard Features

### Real-Time Updates
- Dashboard refreshes every 30 seconds automatically
- Manual refresh button available
- Connection status indicator

### Data Available
- **Total Statistics**: Page views, downloads, modal opens, release views
- **Today's Activity**: Current day statistics
- **Hourly Activity**: Activity by hour of day
- **Top Pages**: Most visited pages
- **Top Downloads**: Most downloaded files
- **Recent Activity**: Live feed of recent user actions
- **Active Users**: Users active in last 24 hours

## Authentication Requirements
- **Level 1 (Public)**: Cannot access analytics
- **Level 2 (Client)**: Can view analytics dashboard
- **Level 3 (Admin)**: Can view detailed analytics and reset data

## File Structure
```
Frontend/
├── amc-real-tracker.js          # Captures real user interactions
├── amc-analytics-connector.js   # Connects real data to dashboard
├── amc-analytics.html           # Your existing dashboard (unchanged)
├── automediacenter.html         # Add tracker script here
└── amc-release-detail.html      # Add tracker script here

Backend/
└── routes/analytics.routes.js   # Handles real data storage/retrieval
```

## Testing Checklist

### 1. Backend Test
```bash
# Check if analytics endpoint is working
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/v1/analytics/data
```

### 2. Tracking Test
1. Open browser console on a tracked page
2. Look for: "AMC Analytics Tracker initialized"
3. Perform actions (click downloads, open modals)
4. Check console for tracking confirmations

### 3. Dashboard Test
1. Login as Level 2+ user
2. Open `amc-analytics.html`
3. Look for: "Analytics connector initialized"
4. Check connection status indicator
5. Verify real data appears

## Troubleshooting

### No Data Showing
- Check authentication (Level 2+ required)
- Verify backend server is running
- Check browser console for errors
- Ensure tracker scripts are loaded

### Tracking Not Working
- Check authentication token exists
- Verify network requests in browser dev tools
- Check backend logs for tracking requests

### Dashboard Not Updating
- Check connection status indicator
- Verify analytics connector is loaded
- Check browser console for fetch errors

## Production Notes
- Current system uses in-memory storage (resets on server restart)
- For production, consider MongoDB storage for persistence
- Add rate limiting for analytics endpoints
- Consider data retention policies

## API Endpoints
- `POST /api/v1/analytics/track` - Track user events
- `GET /api/v1/analytics/data` - Get analytics data (Level 2+)
- `GET /api/v1/analytics/detailed` - Get detailed data (Level 3 only)

This system captures **only real user interactions** - no fake or simulated data!