/* ============================================================
   AutoMediaCenter - auth.js
   Role-based authentication helper
   ============================================================ */

/**
 * Safely parse the stored user object from localStorage.
 * Returns null if none is found or the JSON is invalid.
 */
export function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || localStorage.getItem("currentUser"));
  } catch (e) {
    console.warn("[auth.js] Failed to parse user object from localStorage.");
    return null;
  }
}

/**
 * Returns the current user's role.
 * Defaults to "media_user" if no valid role is found.
 */
export function getUserRole() {
  const user = getUser();
  return user?.role || "media_user";
}

/**
 * Returns the current user's client ID (if present).
 */
export function getClientId() {
  const user = getUser();
  return user?.clientId || null;
}

/**
 * Checks if the current user's role is >= the required role.
 * Roles are ordered: media_user < client_user < client_admin < platform_admin
 * @param {string} required - e.g. "client_user", "client_admin"
 */
export function hasRole(required) {
  const hierarchy = ["media_user", "client_user", "client_admin", "platform_admin"];
  const current = getUserRole();
  return hierarchy.indexOf(current) >= hierarchy.indexOf(required);
}

/**
 * Redirect helper - silently sends user back to landing page.
 */
function redirectToLanding() {
  window.location.href = "landing-page-twitter-style.html";
}

/**
 * Page guard - checks login status and role.
 * @param {string} [requiredRole] - optional role check.
 */
export function protectPage(requiredRole = null) {
  const user = getUser();
  if (!user) {
    console.warn("[auth.js] No user detected. Redirecting to landing page.");
    redirectToLanding();
    return;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    console.warn(`[auth.js] Insufficient privileges. Required: ${requiredRole}, current: ${getUserRole()}`);
    redirectToLanding();
  }
}

/**
 * Utility: Log out and clear localStorage
 */
export function logout() {
  localStorage.removeItem("user");
  localStorage.removeItem("currentUser");
  localStorage.removeItem("authToken");
  localStorage.removeItem("token");
  window.location.href = "landing-page-twitter-style.html";
}

/* ============================================================
   How to use:
   ------------------------------------------------------------
   1. Include this script in any page that needs auth logic:
      <script type="module" src="auth.js"></script>

   2. Protect an entire page (top of script):
      import { protectPage } from "./auth.js";
      protectPage("client_user"); // or "client_admin", etc.

   3. Use role info anywhere:
      import { getUser, getUserRole, hasRole } from "./auth.js";
      console.log(getUserRole()); // -> "client_admin"
      if (hasRole("client_admin")) { ... }

   4. Logout button:
      import { logout } from "./auth.js";
      document.getElementById("logout").addEventListener("click", logout);
   ============================================================ */