// Backend/utils/analyticsScope.js
const { Types } = require('mongoose');
const OID = (id) => (Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : id);

/**
 * Returns true if the user should see global (unscoped) analytics.
 */
function isGlobalRole(user) {
  const r = user?.role;
  return r === 'platform_admin' || r === 'platform_staff';
}

/**
 * Build a simple $match for collections that store clientId directly.
 * Returns {} for global roles.
 */
function scopeMatchDirect(user) {
  if (!user || user.role === 'platform_admin') return {};
  if (user.clientId) return { clientId: OID(user.clientId) };
  return { _id: { $exists: false } }; // safe no-match fallback
}

/**
 * For pipelines that start from AMCInteraction/MediaPickup without clientId,
 * append a $lookup to CenterRelease to scope by release.clientId,
 * then $match with that clientId, then optionally $unset the joined field.
 */
function appendClientScopeLookup(pipeline, user, {
  from = 'centerreleases',            // collection name
  localField = 'releaseId',           // field in the current collection
  foreignField = '_id',               // matching field in CenterRelease
  as = 'rel'
} = {}) {
  if (isGlobalRole(user)) return pipeline;

  if ((user?.role === 'client_admin' || user?.role === 'client_user') && user?.clientId) {
    pipeline.push(
      { $lookup: { from, localField, foreignField, as } },
      { $unwind: `$${as}` },
      { $match: { [`${as}.clientId`]: OID(user.clientId) } },
      { $unset: as }
    );
  } else if (user?.role === 'media_user' && user?._id) {
    // Scope to this user's own interactions
    pipeline.push({ $match: { userId: OID(user._id) } }); // or userEmail: user.email
  }
  return pipeline;
}

module.exports = {
  isGlobalRole,
  scopeMatchDirect,
  appendClientScopeLookup,
  OID,
};