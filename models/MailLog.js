const mongoose = require("mongoose");

const mailLogSchema = new mongoose.Schema({
  recipient: { type: String, required: true },
  companyName: { type: String },
  subject: { type: String },
  status: { type: String, enum: ["sent", "failed", "retrying"], default: "sent" },
  errorMessage: { type: String },
  attempt: { type: Number, default: 1 },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("MailLog", mailLogSchema);