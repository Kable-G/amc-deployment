// models/AssetEvent.js

const mongoose = require('mongoose');

// Define the structure (schema) for documents in the 'assetevents' collection
const assetEventSchema = new mongoose.Schema({
  // Link to the user who performed the action
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',         // This should match the name you used when defining your User model
    required: true,
    index: true          // Good to index userId for querying user-specific events
  },

  // Link to the specific asset being interacted with (e.g., a release UUID)
  assetId: {
    type: String,        // Storing UUIDs as strings
    required: true,
    index: true          // Good to index assetId for querying events related to an asset
  },

  // Type of event that occurred
  eventType: {
    type: String,
    enum: ['preview', 'download', 'stream', 'publish', 'draft', 'publish_attempt'], // Updated enum
    required: true
  },

  // Additional context or information about the event
  relatedInfo: {
    type: String,
    required: false // Optional field
  },

  // IP address of the user when the event occurred
  ip: {
    type: String
  },

  // Browser/client information of the user
  userAgent: {
    type: String
  },

  // Referring URL (where the user came from, if available)
  referrer: {
    type: String
  }
  // The 'timestamp' field is removed here because { timestamps: true } below will add
  // 'createdAt' and 'updatedAt' fields automatically.
  // 'createdAt' will serve as the event timestamp.

}, {
  timestamps: true // Automatically adds 'createdAt' and 'updatedAt' fields
});

// Optional: Mongoose will create an index on _id by default.
// If you frequently query by userId and timestamp, or assetId and timestamp,
// compound indexes could be beneficial, but simple ones on userId and assetId are good starts.
// The 'index: true' in the schema fields above already creates individual indexes.
// A compound index example:
// assetEventSchema.index({ assetId: 1, createdAt: -1 });
// assetEventSchema.index({ userId: 1, createdAt: -1 });


// Create the Mongoose model based on the schema
const AssetEvent = mongoose.model('AssetEvent', assetEventSchema);

// Export the model so other files (like our routes) can use it
module.exports = AssetEvent; // Corrected typo