/* kebab-portal-NO-HOVER.js — stable, delegated, flip+clamp positioning */

(function () {
  // Prevent double binding, but DO NOT stop the file completely
  if (window.__kebabPortalInit) {
    console.log('⚠️ Kebab portal already initialised — keeping existing bindings');
    return;
  }
  window.__kebabPortalInit = true;

  // Ensure a portal exists (your HTML has one, but this is a safety net)
  let portal = document.getElementById('kebab-portal');
  if (!portal) {
    portal = document.createElement('div');
    portal.id = 'kebab-portal';
    portal.style.position = 'fixed';
    portal.style.inset = '0';
    portal.style.pointerEvents = 'none';  // children re-enable
    portal.style.zIndex = '2147483646';
    document.body.appendChild(portal);
  }

  let openFloat = null;
  let openButton = null;

  function closeAllKebabs() {
    if (openFloat && openFloat.parentNode) openFloat.parentNode.removeChild(openFloat);
    if (openButton) openButton.setAttribute('aria-expanded', 'false');
    openFloat = null;
    openButton = null;
  }

  function findInlineMenuFor(btn) {
    // Your rows render: <td class="cell--actions"><div class="kebab-wrap"><button .kebab-btn/> <div .kebab-menu/></div></td>
    const wrap = btn.closest('.kebab-wrap') || btn.closest('td') || btn.parentElement;
    return wrap ? wrap.querySelector('.kebab-menu') : null;
  }

  function openKebab(btn) {
    const inlineMenu = findInlineMenuFor(btn);
    if (!inlineMenu) {
      console.warn('❌ No inline .kebab-menu found for button', btn);
      return;
    }

    // Start clean
    closeAllKebabs();

    // Clone & prepare
    const float = inlineMenu.cloneNode(true);
    float.classList.remove('kebab-menu');
    float.classList.add('kebab-float');
    float.hidden = false;
    float.removeAttribute('id');

    // Temporarily hidden for measurement (must be in DOM)
    float.style.cssText = `
      position: fixed; left:0; top:0;
      opacity:0; visibility:hidden; pointer-events:none;
      display:block; transform:none;
    `;
    portal.appendChild(float);

    // Measure real size
    const w = Math.ceil(float.offsetWidth || 180);
    const h = Math.ceil(float.offsetHeight || 160);

    const r = btn.getBoundingClientRect();
    const margin = 8;

    // Default: render BELOW, right-aligned to button's right
    let left = Math.round(r.right - w);
    let top  = Math.round(r.bottom + 6);

    // Flip above if needed
    if (top + h > window.innerHeight - margin) {
      top = Math.round(r.top - h - 10);
    }

    // Clamp to viewport
    if (left + w > window.innerWidth - margin) left = window.innerWidth - margin - w;
    if (left < margin) left = margin;
    if (top < margin) top = margin;

    const isDark =
      document.body.classList.contains('dark-mode') ||
      document.documentElement.classList.contains('dark');

    // Final visible styles
    float.style.cssText = `
      position: fixed !important;
      left: ${left}px !important;
      top: ${top}px !important;
      min-width: ${w}px !important;
      background: ${isDark ? '#2d2d2d' : '#ffffff'} !important;
      border: 1px solid ${isDark ? '#404040' : '#e5e7eb'} !important;
      box-shadow: 0 18px 48px ${isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.25)'} !important;
      border-radius: 12px !important;
      padding: 6px !important;
      z-index: 2147483646 !important;
      pointer-events: auto !important;   /* <-- re-enable */
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    `;

    // Add a small arrow (CSS-only)
    float.classList.add('kebab-float--arrow');

    // Make sure menu items are clickable + keep data-*
    float.querySelectorAll('.kebab-item').forEach((b, i) => {
      const src = inlineMenu.querySelectorAll('.kebab-item')[i];
      if (src) {
        [...src.attributes].forEach(a => {
          if (a.name.startsWith('data-')) b.setAttribute(a.name, a.value);
        });
      }
      
      const action = b.dataset.action;
      
      b.style.cssText = `
        display: block !important;
        width: 100% !important;
        text-align: left !important;
        border: none !important;
        padding: 10px 14px !important;
        border-radius: 8px !important;
        cursor: pointer !important;
        font-size: 14px !important;
        white-space: nowrap !important;
        margin-top: ${i > 0 ? '6px' : '0'} !important;
      `;
      
      // Colors
      if (action === 'view' || action === 'activate') {
        b.style.background = 'rgba(16, 185, 129, 0.3)';
        b.style.color = isDark ? '#34d399' : '#10b981';
      } else if (action === 'edit') {
        b.style.background = 'rgba(59, 130, 246, 0.3)';
        b.style.color = isDark ? '#60a5fa' : '#3b82f6';
      } else if (action === 'suspend') {
        b.style.background = 'rgba(245, 158, 11, 0.3)';
        b.style.color = isDark ? '#fbbf24' : '#f59e0b';
      } else if (action === 'delete') {
        b.style.background = 'rgba(239, 68, 68, 0.3)';
        b.style.color = isDark ? '#f87171' : '#ef4444';
      }
      
      b.style.whiteSpace = 'nowrap';
    });

    btn.setAttribute('aria-expanded', 'true');
    openFloat = float;
    openButton = btn;
  }

  // -------- Global listeners (delegated) --------

  // Open: capture phase prevents immediate close by other bubbling handlers
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.kebab-btn');
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation?.();
    openKebab(btn);
  }, true); // capture!

  // Close when clicking outside (bubble is fine)
  document.addEventListener('click', (ev) => {
    if (!openFloat) return;
    if (openFloat.contains(ev.target)) return;            // click inside menu
    if (ev.target.closest('.kebab-btn')) return;          // click on another kebab → open will handle
    closeAllKebabs();
  });

  // ESC / resize / scroll
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllKebabs(); });
  window.addEventListener('resize', closeAllKebabs, { passive: true });
  window.addEventListener('scroll', closeAllKebabs, true);

  // Action routing (optional)
  document.addEventListener('click', (e) => {
    const item = e.target.closest('#kebab-portal .kebab-item');
    if (!item) return;

    const userId = item.dataset.userId;
    const title  = item.dataset.title || 'this user';
    const action = item.dataset.action;

    // Call your existing handlers if present
    if (action === 'view' && typeof window.showUserDetails === 'function') window.showUserDetails(userId);
    if (action === 'edit' && typeof window.editUser === 'function') window.editUser(userId);
    if (action === 'suspend' && typeof window.suspendUser === 'function') {
      if (confirm(`Suspend ${title}?`)) window.suspendUser(userId);
    }
    if (action === 'activate' && typeof window.activateUser === 'function') {
      if (confirm(`Activate ${title}?`)) window.activateUser(userId);
    }
    if (action === 'delete' && typeof window.deleteUser === 'function') {
      if (confirm(`⚠️ Permanently delete ${title}?`)) window.deleteUser(userId);
    }

    closeAllKebabs();
  });

  console.log('✅ Kebab Portal System Ready (No Hover)');
})();

// Called after the table is re-rendered to (optionally) reattach per-row data
function rehydrateKebabs() {
  // If you attach data/ids to new rows or need to mark buttons, do it here.
  // You do NOT need to re-bind document/window listeners.
  document.querySelectorAll('.kebab-btn').forEach(btn => {
    // Example: ensure attribute exists for A11Y / state
    if (!btn.hasAttribute('aria-haspopup')) btn.setAttribute('aria-haspopup', 'menu');
  });
}

// If your app overwrites renderUsersTable, shim it to rehydrate without rebind
const __origRender = window.renderUsersTable;
if (typeof __origRender === 'function') {
  window.renderUsersTable = function () {
    const res = __origRender.apply(this, arguments);
    // Give the DOM a tick to settle
    setTimeout(rehydrateKebabs, 50);
    return res;
  };
}

console.log('💫 Kebab Portal System Loaded (No Hover)');