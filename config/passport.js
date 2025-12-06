const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;

// Configure Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.OAUTH_CALLBACK_BASE_URL}/google/callback`
}, (accessToken, refreshToken, profile, done) => {
  return done(null, {
    provider: 'google',
    profile: profile
  });
}));

// Configure Microsoft OAuth Strategy
passport.use(new MicrosoftStrategy({
  clientID: process.env.MICROSOFT_CLIENT_ID,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
  callbackURL: `${process.env.OAUTH_CALLBACK_BASE_URL}/microsoft/callback`,
  scope: ['user.read']
}, (accessToken, refreshToken, profile, done) => {
  return done(null, {
    provider: 'microsoft',
    profile: profile
  });
}));

// Configure LinkedIn OAuth Strategy
passport.use(new LinkedInStrategy({
  clientID: process.env.LINKEDIN_CLIENT_ID,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  callbackURL: `${process.env.OAUTH_CALLBACK_BASE_URL}/linkedin/callback`,
  scope: ['r_emailaddress', 'r_liteprofile']
}, (accessToken, refreshToken, profile, done) => {
  return done(null, {
    provider: 'linkedin',
    profile: profile
  });
}));

// Configure GitHub OAuth Strategy
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: `${process.env.OAUTH_CALLBACK_BASE_URL}/github/callback`
}, (accessToken, refreshToken, profile, done) => {
  return done(null, {
    provider: 'github',
    profile: profile
  });
}));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user from session
passport.deserializeUser((user, done) => {
  done(null, user);
});

module.exports = passport;