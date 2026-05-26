// routes/liveRoutes.js
// AutoMediaLive — CRUD routes for live streaming events
// Pattern matches radarRoutes.js and centerRoutes.js exactly

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const LiveEvent = require('../models/LiveEvent');

// ── Auth middleware ────────────────────────────────────────────────────────
// Same import pattern used in radarRoutes.js and centerRoutes.js
const { authenticate } = require('../middleware/authMiddleware');
const nodemailer = require('nodemailer');
const User = require('../models/User');

// ── SMTP transporter — uses same env vars as vaultRoutes
console.log('[LiveRoutes] SMTP config — host:', process.env.SMTP_HOST, 'user:', process.env.SMTP_USER, 'pass:', process.env.SMTP_PASS ? 'SET' : 'MISSING');
const liveMailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  }
});

async function sendStreamCredentials({ toEmail, toName, eventTitle, brand, eventDateTime, timezone, streamKey, rtmpUrl, eventId, host }) {
  const eventDate = new Date(eventDateTime);
  const tz = timezone || 'UTC';
  const formattedDate = eventDate.toLocaleString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: tz, timeZoneName: 'short'
  });
  const maskedKey = streamKey.substring(0, 8) + '••••••••••••••••';
  const detailUrl = `https://${host}/amc-live-detail.html?id=${eventId}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="background:#0f172a;padding:28px 32px;">
    <table width="100%"><tr>
      <td><span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">AutoMediaCenter</span>
      <span style="color:#475569;font-size:13px;margin-left:8px;">Media Stream</span></td>
      <td align="right"><span style="background:#16a34a;color:#ffffff;font-size:10px;font-weight:700;padding:4px 10px;border-radius:20px;letter-spacing:0.05em;">STREAM CREDENTIALS</span></td>
    </tr></table>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px;">
    <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Hello ${toName || 'there'},</p>
    <p style="margin:0 0 24px;font-size:15px;color:#0f172a;line-height:1.5;">Your stream credentials for <strong>${eventTitle}</strong> are ready. Keep these secure and share only with your broadcast team.</p>

    <!-- Event details -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Event</p>
        <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#0f172a;">${eventTitle}</p>
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Brand</p>
        <p style="margin:0 0 12px;font-size:14px;color:#334155;">${brand}</p>
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Scheduled</p>
        <p style="margin:0;font-size:14px;color:#334155;">${formattedDate}</p>
      </td></tr>
    </table>

    <!-- Credentials -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 16px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#475569;">OBS Stream Settings</p>

        <p style="margin:0 0 4px;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">RTMPS Server (encrypted)</p>
        <p style="margin:0 0 16px;font-size:13px;font-family:monospace;color:#22c55e;background:rgba(34,197,94,0.08);padding:8px 12px;border-radius:6px;word-break:break-all;">${rtmpUrl}</p>

        <p style="margin:0 0 4px;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Stream Key <span style="color:#f59e0b;font-weight:400;text-transform:none;letter-spacing:0;">— Never share publicly</span></p>
        <p style="margin:0 0 8px;font-size:13px;font-family:monospace;color:#e2e8f0;background:rgba(255,255,255,0.06);padding:8px 12px;border-radius:6px;">${maskedKey}</p>
        <p style="margin:0;font-size:11px;color:#475569;">The full key is available in the Media Stream Control Panel. Log in to AutoMediaCenter to reveal and copy it.</p>
      </td></tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td align="center">
        <a href="${detailUrl}" style="display:inline-block;background:#3b82f6;color:#ffffff;font-size:14px;font-weight:700;padding:13px 32px;border-radius:8px;text-decoration:none;">Open in Media Stream →</a>
      </td></tr>
    </table>

    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">Share the RTMPS Server URL and your stream key with your broadcast team via a secure channel. Do not share the stream key publicly or via email to untrusted parties. If the key is compromised, reset it immediately in the Media Stream Control Panel.</p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;">
    <p style="margin:0;font-size:11px;color:#94a3b8;">AutoMediaCenter · <a href="https://automediacenter.com" style="color:#3b82f6;text-decoration:none;">automediacenter.com</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  await liveMailer.sendMail({
    from: '"AutoMediaCenter" <noreply@automediacenter.com>',
    to: `${toName || ''} <${toEmail}>`,
    subject: `Stream credentials — ${eventTitle}`,
    html,
  });
}
const LiveReminder = require('../models/LiveReminder');
const Notification = require('../models/Notification');


// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/live/events
// Returns all non-draft events, sorted upcoming first then by date
// Used by: automedialive.html on load
// ═══════════════════════════════════════════════════════════════════════════
router.get('/events', authenticate, async (req, res) => {
  try {
    const events = await LiveEvent.find({ status: { $ne: 'draft' } })
      .sort({ eventDateTime: 1 })
      .select('-streamKey -rtmpUrl -srtUrl')  // never expose keys to journalist view
      .populate('createdBy', 'email name')
      .lean();

    return res.json({ success: true, data: events });
  } catch (err) {
    console.error('[LiveRoutes] GET /events error:', err);
    return res.status(500).json({ success: false, error: 'Server error fetching live events' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/live/events/:id
// Single event detail — includes stream keys (admin/client_admin only)
// Used by: live_detail.html
// ═══════════════════════════════════════════════════════════════════════════
router.get('/events/:id', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid event ID' });
    }

    const event = await LiveEvent.findById(req.params.id).lean();

    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    // Strip stream keys for non-admin roles
    const role = req.user?.role;
    if (role !== 'platform_admin' && role !== 'client_admin') {
      delete event.streamKey;
      delete event.rtmpUrl;
      delete event.srtUrl;
    }

    return res.json({ success: true, data: event });
  } catch (err) {
    console.error('[LiveRoutes] GET /events/:id error:', err);
    return res.status(500).json({ success: false, error: 'Server error fetching event' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/live/events
// Create a new live event (Announce Upcoming Stream)
// Used by: AssetDBmenu1.6.html lAnnounce() button
// ═══════════════════════════════════════════════════════════════════════════
router.post('/events', authenticate, async (req, res) => {
  try {
    // Role gate — only client_user and above can create events
    const role = req.user?.role;
    const allowedRoles = ['client_user', 'client_admin', 'platform_admin'];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions to create live events' });
    }

    const {
      title,
      brand,
      company,
      description,
      eventDateTime,
      timezone,
      earlyAccessMins,
      startTrigger,
      category,
      primaryLanguage,
      captionLanguages,
      captionSource,
      teaserImageUrl,
      sourceType,
      rtmpUrl,
      streamKey,
      hlsUrl,
      srtUrl,
      transcodingProfile,
      latency,
      recordStream,
      autoArchive,
      accentColour,
      visibility,
      requireRegistration,
      rightsConfirmed,
      streamingRights,
      contentWarnings,
      linkedAssets,
    } = req.body;

    // Required field validation
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Event title is required' });
    }
    if (!brand || !brand.trim()) {
      return res.status(400).json({ success: false, error: 'Brand is required' });
    }
    if (!eventDateTime) {
      return res.status(400).json({ success: false, error: 'Event date/time is required' });
    }
    if (!rightsConfirmed || !streamingRights) {
      return res.status(400).json({ success: false, error: 'Rights must be confirmed before announcing' });
    }

    // Generate a stream key if RTMP and none supplied
    const resolvedStreamKey = streamKey ||
      (sourceType === 'rtmp_push' ? `amc-${Date.now()}-${Math.random().toString(36).substr(2, 8)}` : undefined);

    const newEvent = new LiveEvent({
      title: title.trim(),
      brand: brand.trim(),
      company: company?.trim(),
      description: description?.trim(),
      eventDateTime: new Date(eventDateTime),
      timezone: timezone || 'UTC',
      earlyAccessMins: earlyAccessMins ?? 15,
      startTrigger: startTrigger || 'manual',
      status: 'upcoming',
      category: category?.trim(),
      primaryLanguage: primaryLanguage || 'English',
      captionLanguages: captionLanguages || [],
      captionSource: captionSource || 'none',
      teaserImageUrl: teaserImageUrl?.trim(),
      sourceType: sourceType || 'rtmp_push',
      rtmpUrl: rtmpUrl?.trim(),
      streamKey: resolvedStreamKey,
      hlsUrl: hlsUrl?.trim(),
      srtUrl: srtUrl?.trim(),
      transcodingProfile: transcodingProfile || 'auto_adaptive',
      latency: latency || 'low',
      recordStream: recordStream !== false,
      autoArchive: autoArchive !== false,
      accentColour: accentColour || '#3b82f6',
      visibility: visibility || 'public',
      requireRegistration: !!requireRegistration,
      rightsConfirmed: !!rightsConfirmed,
      streamingRights: !!streamingRights,
      contentWarnings: !!contentWarnings,
      linkedAssets: linkedAssets || [],
      createdBy: req.user.id || req.user._id,
      clientId: req.user.clientId,
    });

    const saved = await newEvent.save();

    console.log(`[LiveRoutes] New live event created: "${saved.title}" (${saved._id}) by ${req.user.email}`);

    // ── Send stream credentials email to creator
    try {
      const userId = req.user.id || req.user._id;
      console.log(`[LiveRoutes] Looking up user ${userId} for credentials email`);
      const creator = await User.findById(userId).select('email name').lean();
      console.log(`[LiveRoutes] Creator lookup result:`, creator ? `${creator.email}` : 'NOT FOUND');
      if (creator?.email) {
        const host = req.get('host') || 'automediacenter.com';
        const rtmpForEmail = `rtmps://${host.split(':')[0]}/live`;
        await sendStreamCredentials({
          toEmail: creator.email,
          toName:  creator.name || creator.email,
          eventTitle: saved.title,
          brand:      saved.brand,
          eventDateTime: saved.eventDateTime,
          timezone:   saved.timezone,
          streamKey:  resolvedStreamKey,
          rtmpUrl:    rtmpForEmail,
          eventId:    saved._id,
          host:       host.split(':')[0],
        });
        console.log(`[LiveRoutes] ✅ Credentials email sent to ${creator.email}`);
      } else {
        console.warn(`[LiveRoutes] ⚠️ No email found for user ${userId} — skipping credentials email`);
      }
    } catch(emailErr) {
      console.warn('[LiveRoutes] ⚠️ Credentials email failed:', emailErr.message);
      console.warn('[LiveRoutes] Stack:', emailErr.stack?.split('\n')[1]);
    }

    return res.status(201).json({
      success: true,
      data: saved,
      message: `"${saved.title}" announced successfully`,
    });
  } catch (err) {
    console.error('[LiveRoutes] POST /events error:', err);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, error: messages.join(', ') });
    }
    return res.status(500).json({ success: false, error: 'Server error creating live event' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/v1/live/events/:id/status
// Update event status (upcoming → live → recording)
// Used by: manage_live.html, live stream webhook
// ═══════════════════════════════════════════════════════════════════════════
router.patch('/events/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'upcoming', 'ready', 'live', 'recording', 'cancelled'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Status must be one of: ${validStatuses.join(', ')}` });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid event ID' });
    }

    const event = await LiveEvent.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    // Ownership check — only creator, client_admin, or platform_admin
    const role = req.user?.role;
    const userId = (req.user.id || req.user._id)?.toString();
    const isOwner = event.createdBy?.toString() === userId;
    const isAdmin = role === 'platform_admin' || role === 'client_admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorised to update this event' });
    }

    event.status = status;

    // When ending stream (→ recording), save recording URLs and timestamp
    if (status === 'recording' && event.streamKey) {
      event.recordingHlsUrl = event.recordingHlsUrl || `/hls/live/${event.streamKey}/index.m3u8`;
      event.streamEndedAt = event.streamEndedAt || new Date();
      // MP4 path will be saved by donePublish when OBS actually disconnects
    }

    await event.save();

    return res.json({ success: true, data: event, message: `Status updated to ${status}` });
  } catch (err) {
    console.error('[LiveRoutes] PATCH /events/:id/status error:', err);
    return res.status(500).json({ success: false, error: 'Server error updating status' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/v1/live/events/:id
// Soft-cancel or hard-delete (admin only for hard delete)
// ═══════════════════════════════════════════════════════════════════════════
router.delete('/events/:id', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid event ID' });
    }

    const event = await LiveEvent.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const role = req.user?.role;
    const userId = (req.user.id || req.user._id)?.toString();
    const isOwner = event.createdBy?.toString() === userId;
    const isPlatformAdmin = role === 'platform_admin';

    if (!isOwner && !isPlatformAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorised to delete this event' });
    }

    // platform_admin gets hard delete; everyone else gets soft cancel
    if (isPlatformAdmin && req.query.hard === 'true') {
      await LiveEvent.findByIdAndDelete(req.params.id);
      return res.json({ success: true, message: 'Event permanently deleted' });
    }

    event.status = 'cancelled';
    await event.save();
    return res.json({ success: true, message: 'Event cancelled' });
  } catch (err) {
    console.error('[LiveRoutes] DELETE /events/:id error:', err);
    return res.status(500).json({ success: false, error: 'Server error deleting event' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/live/events/:id/reminder
// Register 3 scheduled reminders: 24h before, 1h before, at early-live window
// ═══════════════════════════════════════════════════════════════════════════
router.post('/events/:id/reminder', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid event ID' });
    }

    const event = await LiveEvent.findById(req.params.id).lean();
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const userId = req.user.id || req.user._id;
    const startTime = new Date(event.eventDateTime);
    const earlyMs   = (event.earlyAccessMins || 15) * 60 * 1000;

    // Check if already registered
    const existing = await LiveReminder.findOne({ userId, eventId: event._id, fired: false });
    if (existing) {
      return res.json({ success: true, message: 'Reminder already set', alreadySet: true });
    }

    // Schedule three reminders
    const reminders = [
      {
        type:   '24h',
        fireAt: new Date(startTime.getTime() - 24 * 60 * 60 * 1000),
      },
      {
        type:   '1h',
        fireAt: new Date(startTime.getTime() - 60 * 60 * 1000),
      },
      {
        type:   'starting',
        fireAt: new Date(startTime.getTime() - earlyMs),
      },
    ].filter(r => r.fireAt > new Date()); // only schedule future reminders

    if (reminders.length === 0) {
      return res.status(400).json({ success: false, error: 'Event has already started' });
    }

    await LiveReminder.insertMany(reminders.map(r => ({
      userId,
      eventId:         event._id,
      fireAt:          r.fireAt,
      type:            r.type,
      fired:           false,
      streamTitle:     event.title,
      streamBrand:     event.brand,
      streamStartTime: startTime,
      streamTimezone:  event.timezone || 'UTC',
    })));

    console.log(`[LiveRoutes] ${reminders.length} reminder(s) set for "${event.title}" by user ${userId}`);

    return res.json({
      success: true,
      message: `${reminders.length} reminder${reminders.length > 1 ? 's' : ''} set`,
      remindersSet: reminders.length,
      reminderTimes: reminders.map(r => ({ type: r.type, fireAt: r.fireAt })),
    });
  } catch (err) {
    console.error('[LiveRoutes] POST /reminder error:', err);
    return res.status(500).json({ success: false, error: 'Failed to set reminder' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/live/events/:id/reset-key
// Generate a new stream key — old key becomes invalid immediately
// Only event creator, client_admin, or platform_admin can reset
// ═══════════════════════════════════════════════════════════════════════════
router.post('/events/:id/reset-key', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid event ID' });
    }
    const event = await LiveEvent.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const role   = req.user?.role;
    const userId = (req.user.id || req.user._id)?.toString();
    const isOwner = event.createdBy?.toString() === userId;
    const isAdmin = role === 'platform_admin' || role === 'client_admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorised to reset this stream key' });
    }

    // Generate new stream key
    const newKey = 'amc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
    event.streamKey = newKey;
    await event.save();

    console.log(`[LiveRoutes] Stream key reset for "${event.title}" by user ${userId}`);

    return res.json({
      success: true,
      newStreamKey: newKey,
      message: 'Stream key reset — old key is now invalid'
    });
  } catch (err) {
    console.error('[LiveRoutes] POST /reset-key error:', err);
    return res.status(500).json({ success: false, error: 'Failed to reset stream key' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/live/events/:id/recording
// Returns recording URLs (HLS VOD + MP4 download) for an archived event
// Used by: amc-live-detail.html when status === 'recording'
// ═══════════════════════════════════════════════════════════════════════════
router.get('/events/:id/recording', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid event ID' });
    }

    const event = await LiveEvent.findById(req.params.id)
      .select('title status recordingHlsUrl recordingMp4Url streamKey streamEndedAt')
      .lean();

    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    // Build URLs — fallback to convention if not stored in DB
    const hlsUrl = event.recordingHlsUrl || (event.streamKey ? `/hls/live/${event.streamKey}/index.m3u8` : null);
    const mp4Url = event.recordingMp4Url || null;

    return res.json({
      success: true,
      data: {
        status: event.status,
        hlsUrl,
        mp4Url,
        streamEndedAt: event.streamEndedAt || null,
      }
    });
  } catch (err) {
    console.error('[LiveRoutes] GET /events/:id/recording error:', err);
    return res.status(500).json({ success: false, error: 'Server error fetching recording' });
  }
});


module.exports = router;







