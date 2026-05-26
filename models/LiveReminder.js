// models/LiveReminder.js
// Stores scheduled stream reminders — cron fires them into Notification at the right time

'use strict';

const mongoose = require('mongoose');

const liveReminderSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventId:     { type: mongoose.Schema.Types.ObjectId, ref: 'LiveEvent', required: true },
  fireAt:      { type: Date, required: true },           // when to send the notification
  type:        { type: String, enum: ['24h', '1h', 'starting'], required: true },
  fired:       { type: Boolean, default: false },
  // Snapshot of event data at time of reminder creation
  streamTitle:     { type: String },
  streamBrand:     { type: String },
  streamStartTime: { type: Date },
  streamTimezone:  { type: String },
}, { timestamps: true });

liveReminderSchema.index({ fireAt: 1, fired: 0 }); // fast lookup for cron
liveReminderSchema.index({ userId: 1, eventId: 1 }); // check if already registered

module.exports = mongoose.model('LiveReminder', liveReminderSchema);