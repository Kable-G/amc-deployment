const cron = require("node-cron");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Invite = require("./models/Invite");
const { sendInviteEmail } = require("./inviteMailer");

dotenv.config();

// Connect to DB if not already connected
if (mongoose.connection.readyState === 0) {
  mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).then(() => console.log("📦 Mongo connected for retryCron"))
    .catch(err => console.error("Mongo error:", err));
}

// Every day at 03:00 server time
cron.schedule("0 3 * * *", async () => {
  console.log("⏰ Running daily invite retry job...");
  const failedInvites = await Invite.find({ emailStatus: "failed" });
  if (!failedInvites.length) {
    console.log("✅ No failed invites found.");
    return;
  }

  for (const invite of failedInvites) {
    console.log(`🔄 Retrying invite to ${invite.email} (${invite.companyName})`);
    await sendInviteEmail(invite);
  }
  console.log("🏁 Daily invite retry job completed.");
});

console.log("📅 Daily invite retry cron job scheduled for 03:00");