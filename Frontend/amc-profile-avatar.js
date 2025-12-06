/* AutoMediaCenter - Profile Avatar with Role Halo & Account Menu
   - Drop-in component. No external CSS required (styles injected).
   - Reads user from localStorage: 'user' or fallback 'currentUser'
   - Role colors: media_user (blue), client_user (green), client_admin (amber), platform_admin (red)
   - Matches AMC Inter+spacing+shadow aesthetic
   - Light/Dark/Auto theme switcher (stores `amc_theme`)
   - Accessible: aria, Esc to close, outside click to close, focus management
*/

(() => {
  // ---------- Styles (injected once) ----------
  const css = `
  :root{
    --amc-font: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
    --amc-text: #0f172a;           /* slate-900 */
    --amc-muted:#64748b;           /* slate-500 */
    --amc-line: #e5e7eb;
    --amc-card:#ffffff;
    --amc-shadow: 0 20px 60px rgba(0,0,0,.20), 0 8px 20px rgba(0,0,0,.12);

    --role-blue:#3B82F6;    /* media_user */
    --role-green:#10B981;   /* client_user */
    --role-amber:#F59E0B;   /* client_admin */
    --role-red:#EF4444;     /* platform_admin */

    --amc-blue-600:#2563eb;
    --amc-blue-700:#1d4ed8;
  }

  /* Dark mode baseline (honors data-theme on <html>) */
  html[data-theme="dark"] {
    --amc-text:#e5e7eb;
    --amc-muted:#94a3b8;
    --amc-line:#273244;
    --amc-card:#0b1220;
    --amc-shadow: 0 22px 60px rgba(0,0,0,.50), 0 8px 22px rgba(0,0,0,.35);
  }

  .amc-avatar-root { font-family: var(--amc-font); }

  /* The anchor wrapper (inline) */
  .amc-avatar-anchor { display:inline-flex; align-items:center; gap:10px; }

  /* The avatar button */
  .amc-avatar-btn{
    position:relative;
    width:40px; height:40px;
    border:none; background:transparent;
    cursor:pointer; padding:0;
    display:grid; place-items:center;
    outline:none;
  }
  .amc-avatar-btn:focus-visible{ outline:2px solid var(--amc-blue-600); outline-offset:2px; border-radius:50%; }

  /* Halo ring (role colored) */
  .amc-avatar-ring{
    position:absolute; inset:0;
    border-radius:50%;
    background:
      radial-gradient(transparent 58%, rgba(0,0,0,0) 60%),
      conic-gradient(var(--ring-color), var(--ring-color));
    filter: drop-shadow(0 2px 6px rgba(0,0,0,.18));
  }
  /* Inner separation ring */
  .amc-avatar-inner-border{
    position:absolute; inset:3px;
    border-radius:50%;
    background: var(--amc-card);
  }

  /* The person glyph (matches provided shape: circle head + shoulders) */
  .amc-avatar-glyph{
    position:relative; z-index:1;
    width:32px; height:32px;
    border-radius:50%;
    background:
      radial-gradient(circle at 50% 38%, currentColor 9px, transparent 10px),
      radial-gradient(circle at 50% 80%, currentColor 18px, transparent 19px);
    color:#111827; /* dark glyph */
  }
  html[data-theme="dark"] .amc-avatar-glyph{ color:#e5e7eb; }

  /* Dropdown panel */
  .amc-menu{
    position:absolute; top:52px; right:0;
    width:320px; background:var(--amc-card);
    color:var(--amc-text);
    border-radius:16px;
    box-shadow:var(--amc-shadow);
    border:1px solid var(--amc-line);
    padding:14px 0;
    transform:translateY(6px);
    opacity:0; pointer-events:none;
    transition: opacity .18s ease, transform .18s ease;
    z-index:9999;
  }
  .amc-menu.open{ opacity:1; transform:translateY(0); pointer-events:auto; }

  .amc-menu-header{ padding:14px 18px 12px; border-bottom:1px solid var(--amc-line); }
  .amc-email{ font-weight:700; font-size:.98rem; }
  .amc-rolechip{
    display:inline-flex; align-items:center; gap:8px;
    background: rgba(0,0,0,.04);
    padding:6px 10px; border-radius:999px; margin-top:8px; font-size:.85rem;
  }
  html[data-theme="dark"] .amc-rolechip{ background: rgba(255,255,255,.06); }
  .amc-role-dot{ width:8px; height:8px; border-radius:50%; background:var(--ring-color); }
  .amc-role-text{ color:var(--amc-muted); font-weight:600; }

  .amc-menu-section{ padding:6px 8px; }
  .amc-item{
    width:100%; display:flex; align-items:center; gap:12px;
    border:none; background:transparent; text-align:left;
    padding:10px 12px; border-radius:10px; cursor:pointer; color:var(--amc-text);
  }
  .amc-item:hover{ background:rgba(0,0,0,.04); }
  html[data-theme="dark"] .amc-item:hover{ background:rgba(255,255,255,.06); }

  .amc-item-icon{ width:20px; height:20px; color:var(--amc-muted); display:grid; place-items:center; }

  .amc-language{ color:var(--amc-muted); margin-left:auto; font-size:.86rem; }
  .amc-theme-group{
    display:flex; gap:6px; margin-left:auto;
    background:rgba(0,0,0,.06); border-radius:8px; padding:3px;
  }
  html[data-theme="dark"] .amc-theme-group{ background:rgba(255,255,255,.08); }
  .amc-theme-btn{
    border:none; background:transparent; color:var(--amc-text);
    padding:6px 8px; border-radius:6px; cursor:pointer; font-size:.85rem;
  }
  .amc-theme-btn.active{ background:var(--amc-card); box-shadow:0 0 0 1px var(--amc-line) inset; }

  .amc-menu-footer{ margin-top:6px; padding:10px 12px; border-top:1px solid var(--amc-line); display:flex; gap:8px; justify-content:flex-end; }
  .amc-link{ font-size:.86rem; color:var(--amc-muted); text-decoration:none; }
  .amc-link:hover{ color:var(--amc-text); }

  /* Fallback floating position if #amc-profile-anchor is missing */
  .amc-float{
    position:fixed; top:10px; right:16px; z-index:9998;
  }
  `;

  if (!document.getElementById('amc-avatar-style')) {
    const style = document.createElement('style');
    style.id = 'amc-avatar-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------- Helpers ----------
  const ROLE_COLORS = {
    media_user: 'var(--role-blue)',
    client_user: 'var(--role-green)',
    client_admin: 'var(--role-amber)',
    platform_admin: 'var(--role-red)'
  };

  function getUserFromStorage() {
    try {
      const raw = localStorage.getItem('user') || localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function getRole(user) {
    return (user && (user.role || user.userRole)) || 'media_user';
  }

  function getRingColor(role) {
    return ROLE_COLORS[role] || 'var(--role-blue)';
  }

  function setTheme(theme) {
    // theme: 'light' | 'dark' | 'auto'
    if (theme === 'auto') {
      localStorage.removeItem('amc_theme');
      document.documentElement.removeAttribute('data-theme');
      return;
    }
    localStorage.setItem('amc_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }

  function initThemeFromStorage() {
    const saved = localStorage.getItem('amc_theme');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      document.documentElement.removeAttribute('data-theme'); // auto
    }
  }

  // ---------- Build component ----------
  function buildAvatar() {
    initThemeFromStorage();

    const user = getUserFromStorage() || {};
    const email = user.email || user.userEmail || 'user@example.com';
    const role = getRole(user);
    const ring = getRingColor(role);

    // Anchor
    let anchor = document.getElementById('amc-profile-anchor');
    const root = document.createElement('div');
    root.className = 'amc-avatar-root';

    const anchorWrap = document.createElement('div');
    anchorWrap.className = 'amc-avatar-anchor';

    // Button (avatar)
    const btn = document.createElement('button');
    btn.className = 'amc-avatar-btn';
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('title', 'Account');

    const ringEl = document.createElement('div');
    ringEl.className = 'amc-avatar-ring';
    ringEl.style.setProperty('--ring-color', ring);

    const innerBorder = document.createElement('div');
    innerBorder.className = 'amc-avatar-inner-border';

    const glyph = document.createElement('div');
    glyph.className = 'amc-avatar-glyph';

    btn.appendChild(ringEl);
    btn.appendChild(innerBorder);
    btn.appendChild(glyph);

    // Menu
    const menu = document.createElement('div');
    menu.className = 'amc-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Account');

    menu.innerHTML = `
      <div class="amc-menu-header">
        <div class="amc-email">${email}</div>
        <div class="amc-rolechip">
          <span class="amc-role-dot" style="background:${ring};"></span>
          <span class="amc-role-text">${role.replace('_',' ')}</span>
        </div>
      </div>

      <div class="amc-menu-section">
        <button class="amc-item" data-action="settings">
          <span class="amc-item-icon">⚙️</span>
          <span>Account settings</span>
        </button>

        <button class="amc-item" data-action="language">
          <span class="amc-item-icon">🌐</span>
          <span>Language</span>
          <span class="amc-language">Coming soon</span>
        </button>

        <div class="amc-item" style="cursor:default;">
          <span class="amc-item-icon">🌓</span>
          <span>Appearance</span>
          <div class="amc-theme-group" role="group" aria-label="Appearance">
            <button class="amc-theme-btn" data-theme="light">Light</button>
            <button class="amc-theme-btn" data-theme="dark">Dark</button>
            <button class="amc-theme-btn" data-theme="auto">Auto</button>
          </div>
        </div>

        <button class="amc-item" data-action="signout">
          <span class="amc-item-icon">↪️</span>
          <span>Sign out</span>
        </button>
      </div>

      <div class="amc-menu-footer">
        <a href="#" class="amc-link" data-action="privacy">Privacy</a>
        <a href="#" class="amc-link" data-action="help">Help</a>
      </div>
    `;

    // Active appearance
    const theme = localStorage.getItem('amc_theme') || 'auto';
    menu.querySelectorAll('.amc-theme-btn').forEach(btn => {
      if (btn.dataset.theme === theme) btn.classList.add('active');
    });

    // Assemble
    anchorWrap.appendChild(btn);
    anchorWrap.appendChild(menu);
    root.appendChild(anchorWrap);

    if (anchor) {
      anchor.appendChild(root);
    } else {
      // Fallback floating placement (top-right) if no anchor exists
      const float = document.createElement('div');
      float.className = 'amc-float';
      float.appendChild(root);
      document.body.appendChild(float);
    }

    // ---------- Interactions ----------
    function openMenu() {
      menu.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      // Focus first actionable element
      const first = menu.querySelector('[data-action="settings"]');
      if (first) first.focus();
      document.addEventListener('keydown', onKey);
      document.addEventListener('click', onDocClick, true);
    }

    function closeMenu() {
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onDocClick, true);
    }

    function onKey(e){
      if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); btn.focus(); }
    }
    function onDocClick(e){
      if (!menu.contains(e.target) && !btn.contains(e.target)) closeMenu();
    }

    btn.addEventListener('click', () => {
      if (menu.classList.contains('open')) closeMenu(); else openMenu();
    });

    // Menu actions
    menu.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const action = el.dataset.action;

      if (action === 'settings') {
        // TODO: wire to your settings page
        closeMenu();
        alert('Account settings — to be connected.');
      }
      if (action === 'language') {
        closeMenu();
        alert('Language coming soon.');
      }
      if (action === 'signout') {
        closeMenu();
        try {
          localStorage.removeItem('authToken'); // if used
          localStorage.removeItem('token');     // if used
          localStorage.removeItem('user');
          localStorage.removeItem('currentUser');
          sessionStorage.clear();
        } catch {}
        window.location.href = 'landing-page-twitter-style.html';
      }
    });

    // Appearance toggles
    menu.querySelectorAll('.amc-theme-btn').forEach(t => {
      t.addEventListener('click', () => {
        menu.querySelectorAll('.amc-theme-btn').forEach(b => b.classList.remove('active'));
        t.classList.add('active');
        setTheme(t.dataset.theme);
      });
    });
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildAvatar);
  } else {
    buildAvatar();
  }
})();