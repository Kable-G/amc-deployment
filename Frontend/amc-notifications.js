/**
 * amc-notifications.js — AutoMediaCenter Notification Bell Panel
 *
 * Creates its OWN badge element on top of #notificationBtn
 * so the shell's updateCartBadge() cannot interfere with it.
 */

(function () {
  'use strict';

  var API_BASE   = '';
  var POLL_MS    = 60000;
  var VAULT_PAGE = '/automediavault.html';

  function authHeaders() {
    var token = localStorage.getItem('authToken') || localStorage.getItem('token');
    return token
      ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
      : { 'Content-Type': 'application/json' };
  }

  function timeAgo(dateStr) {
    var diff = Date.now() - new Date(dateStr).getTime();
    var m = Math.floor(diff / 60000);
    var h = Math.floor(diff / 3600000);
    var d = Math.floor(diff / 86400000);
    if (m < 1)  return 'Just now';
    if (m < 60) return m + 'm ago';
    if (h < 24) return h + 'h ago';
    return d + 'd ago';
  }

  function fmtEmbargo(dateStr, tz) {
    if (!dateStr) return '';
    var dt = new Date(dateStr);
    if (isNaN(dt) || dt.getFullYear() < 2000) return '';
    var safeTz  = tz || 'Europe/Berlin';
    var tzLabel = dt.toLocaleTimeString('en-GB', { timeZone: safeTz, timeZoneName: 'short' }).split(' ').pop();
    return dt.toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: safeTz, hour12: false
    }).replace(',', '') + ' ' + tzLabel;
  }

  // ── CSS ───────────────────────────────────────────────────
  var css = document.createElement('style');
  css.textContent = [
    /* Our own badge — sits on top of the bell, shell cannot touch it */
    '#amcNBadge{position:absolute;top:6px;right:6px;min-width:14px;height:auto;border-radius:8px;background:#ef4444;color:#fff;font-size:9px;font-weight:700;line-height:1;text-align:center;padding:2px 4px;pointer-events:none;z-index:10001;display:none;box-shadow:0 0 0 2px var(--bg-primary,#fff)}',
    '#amcNBadge.vis{display:block}',
    /* Make sure the bell button is relatively positioned for our badge */
    '#notificationBtn{position:relative!important}',
    /* Panel */
    '.amc-notif-panel{position:fixed;top:56px;right:12px;width:380px;max-width:calc(100vw - 24px);max-height:540px;background:var(--bg-primary,#fff);border:1px solid var(--border-color,#e2e8f0);border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,0.14);z-index:9990;display:none;flex-direction:column;overflow:hidden;animation:amcNIn .16s ease}',
    '.amc-notif-panel.open{display:flex}',
    '@keyframes amcNIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}',
    '.amc-np-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 12px;border-bottom:1px solid var(--border-color,#e2e8f0);flex-shrink:0}',
    '.amc-np-hdr-left{display:flex;align-items:center;gap:8px}',
    '.amc-np-title{font-size:13px;font-weight:700;color:var(--text-primary,#0f172a)}',
    '.amc-np-ulbl{font-size:10px;font-weight:700;color:#fff;background:#ef4444;padding:1px 6px;border-radius:10px;display:none}',
    '.amc-np-ulbl.vis{display:inline-block}',
    '.amc-np-hdr-right{display:flex;align-items:center;gap:8px}',
    '.amc-np-mka{font-size:11px;font-weight:600;color:#2563eb;background:none;border:none;cursor:pointer;padding:0}',
    '.amc-np-mka:hover{text-decoration:underline}',
    '.amc-np-cls{width:26px;height:26px;border-radius:6px;background:none;border:none;cursor:pointer;color:var(--text-secondary,#64748b);font-size:12px;display:flex;align-items:center;justify-content:center}',
    '.amc-np-cls:hover{background:var(--bg-hover,#f1f5f9)}',
    '.amc-np-list{overflow-y:auto;flex:1;scrollbar-width:thin;scrollbar-color:rgba(100,116,139,.2) transparent}',
    '.amc-np-item{display:flex;gap:11px;align-items:flex-start;padding:12px 16px;border-bottom:1px solid var(--border-color,#f1f5f9);cursor:pointer;transition:background .1s}',
    '.amc-np-item:last-child{border-bottom:none}',
    '.amc-np-item:hover{background:var(--bg-hover,#f8fafc)}',
    '.amc-np-item.unread{background:rgba(37,99,235,.04)}',
    '.amc-np-item.unread:hover{background:rgba(37,99,235,.08)}',
    '.amc-np-ico{width:36px;height:36px;border-radius:8px;background:#1e293b;flex-shrink:0;display:flex;align-items:center;justify-content:center;margin-top:1px}',
    '.amc-np-ico i{font-size:14px;color:#94a3b8}',
    '.amc-np-body{flex:1;min-width:0}',
    '.amc-np-sender{font-size:12px;font-weight:700;color:var(--text-primary,#0f172a);margin-bottom:2px}',
    '.amc-np-vault{font-size:12px;color:var(--text-secondary,#475569);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px}',
    '.amc-np-embargo{font-size:11px;font-weight:600;color:#dc2626;margin-bottom:3px}',
    '.amc-np-time{font-size:11px;color:var(--text-tertiary,#94a3b8)}',
    '.amc-np-dot{width:7px;height:7px;border-radius:50%;background:#2563eb;flex-shrink:0;margin-top:4px}',
    '.amc-np-empty{padding:44px 20px;text-align:center;color:var(--text-tertiary,#94a3b8);font-size:13px}',
    '.amc-np-empty i{font-size:30px;display:block;margin-bottom:10px;opacity:.25}',
    '.amc-np-footer{padding:10px 16px;border-top:1px solid var(--border-color,#e2e8f0);flex-shrink:0}',
    '.amc-np-footer a{display:block;text-align:center;font-size:12px;font-weight:600;color:#2563eb;text-decoration:none}',
    '.amc-np-footer a:hover{text-decoration:underline}'
  ].join('');
  document.head.appendChild(css);

  // ── State ─────────────────────────────────────────────────
  var _notifications = [];
  var _unreadCount   = 0;
  var _panelOpen     = false;
  var _panel         = null;
  var _bellBtn       = null;
  var _ownBadge      = null;  // OUR badge — shell cannot touch this
  var _ulbl          = null;
  var _wired         = false;

  // ── Panel ─────────────────────────────────────────────────
  function createPanel() {
    var p = document.createElement('div');
    p.className = 'amc-notif-panel';
    p.id        = 'amcNotifPanel';
    p.innerHTML =
      '<div class="amc-np-hdr">' +
        '<div class="amc-np-hdr-left">' +
          '<span class="amc-np-title">Notifications</span>' +
          '<span class="amc-np-ulbl" id="amcNpUlbl"></span>' +
        '</div>' +
        '<div class="amc-np-hdr-right">' +
          '<button class="amc-np-mka" id="amcNpMka">Mark all as read</button>' +
          '<button class="amc-np-cls" id="amcNpCls"><i class="fas fa-times"></i></button>' +
        '</div>' +
      '</div>' +
      '<div class="amc-np-list" id="amcNpList"></div>' +
      '<div class="amc-np-footer"><a href="' + VAULT_PAGE + '">Go to Media Vault \u2192</a></div>';
    document.body.appendChild(p);

    _ulbl = document.getElementById('amcNpUlbl');
    document.getElementById('amcNpCls').onclick = closePanel;
    document.getElementById('amcNpMka').onclick = markAllRead;

    document.addEventListener('click', function(e) {
      if (_panelOpen && !p.contains(e.target) && !(_bellBtn && _bellBtn.contains(e.target))) {
        closePanel();
      }
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && _panelOpen) closePanel();
    });
    return p;
  }

  function renderList() {
    var list = document.getElementById('amcNpList');
    if (!list) return;
    if (!_notifications.length) {
      list.innerHTML = '<div class="amc-np-empty"><i class="fas fa-bell"></i>No notifications yet</div>';
      return;
    }
    list.innerHTML = _notifications.map(function(n) {
      var sender  = n.brand || n.companyName || 'A media client';
      var embargo = fmtEmbargo(n.embargoUntil, n.availabilityTimezone);
      var unread  = !n.read;
      return '<div class="amc-np-item ' + (unread ? 'unread' : '') + '" onclick="window.__amcNC(\'' + n._id + '\')">' +
        '<div class="amc-np-ico"><i class="fas fa-lock"></i></div>' +
        '<div class="amc-np-body">' +
          '<div class="amc-np-sender">' + sender + ' sent you a Media Vault</div>' +
          '<div class="amc-np-vault">' + n.vaultTitle + '</div>' +
          (embargo ? '<div class="amc-np-embargo">\u26a0 Do not publish before: ' + embargo + '</div>' : '') +
          '<div class="amc-np-time">' + timeAgo(n.createdAt) + '</div>' +
        '</div>' +
        (unread ? '<div class="amc-np-dot"></div>' : '') +
      '</div>';
    }).join('');
  }

  window.__amcNC = function(id) {
    fetch(API_BASE + '/api/v1/notifications/' + id + '/read', { method: 'PATCH', headers: authHeaders() }).catch(function(){});
    closePanel();
    window.location.href = VAULT_PAGE;
  };

  function markAllRead() {
    fetch(API_BASE + '/api/v1/notifications/read-all', { method: 'PATCH', headers: authHeaders() })
      .then(function() {
        _notifications = _notifications.map(function(n) { return Object.assign({}, n, { read: true }); });
        _unreadCount = 0;
        updateBadge(0);
        renderList();
      }).catch(function(e) { console.error('[NOTIFICATIONS] markAllRead:', e); });
  }

  // ── Our own badge — completely independent of shell ───────
  function ensureOwnBadge() {
    // If bell button has been re-injected, re-attach our badge
    if (_bellBtn && !_bellBtn.contains(_ownBadge)) {
      _ownBadge = null;
    }
    if (!_ownBadge && _bellBtn) {
      _ownBadge = document.createElement('span');
      _ownBadge.id = 'amcNBadge';
      _bellBtn.appendChild(_ownBadge);
    }
  }

  function updateBadge(count) {
    _unreadCount = count;
    ensureOwnBadge();
    if (_ownBadge) {
      _ownBadge.textContent = count > 99 ? '99+' : String(count);
      _ownBadge.classList.toggle('vis', count > 0);
    }
    if (_ulbl) {
      _ulbl.textContent = count > 99 ? '99+' : String(count);
      _ulbl.classList.toggle('vis', count > 0);
    }
  }

  function openPanel()   { _panel && _panel.classList.add('open');    _panelOpen = true;  renderList(); }
  function closePanel()  { _panel && _panel.classList.remove('open'); _panelOpen = false; }
  function togglePanel() { _panelOpen ? closePanel() : openPanel(); }

  // ── Notification sound ────────────────────────────────────
  // Soft two-tone chime using Web Audio API — no file needed
  var _audioCtx = null;
  var _isFirstFetch = true; // silent on page load

  function playNotifSound() {
    // Respect mute preference
    if (localStorage.getItem('amcNotifMuted') === 'true') return;
    // Don't play if panel is open (user is already looking)
    if (_panelOpen) return;
    try {
      if (!_audioCtx) {
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      // Two-tone soft chime: high note then slightly lower
      var tones = [
        { freq: 880, start: 0,    duration: 0.12, gain: 0.18 },
        { freq: 659, start: 0.13, duration: 0.18, gain: 0.12 }
      ];
      tones.forEach(function(t) {
        var osc  = _audioCtx.createOscillator();
        var gain = _audioCtx.createGain();
        osc.connect(gain);
        gain.connect(_audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.value = t.freq;
        gain.gain.setValueAtTime(0, _audioCtx.currentTime + t.start);
        gain.gain.linearRampToValueAtTime(t.gain, _audioCtx.currentTime + t.start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + t.start + t.duration);
        osc.start(_audioCtx.currentTime + t.start);
        osc.stop(_audioCtx.currentTime + t.start + t.duration);
      });
    } catch(e) { /* audio not available — silent fallback */ }
  }

  function fetchNotifications() {
    var token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) return;
    fetch(API_BASE + '/api/v1/notifications', { headers: authHeaders() })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(json) {
        if (!json || !json.success) return;
        var newCount = json.unreadCount || 0;
        // Play sound only if new notifications arrived since last poll
        if (!_isFirstFetch && newCount > _unreadCount) {
          playNotifSound();
        }
        _isFirstFetch = false;
        _notifications = json.data || [];
        updateBadge(newCount);
        if (_panelOpen) renderList();
      })
      .catch(function(e) { console.warn('[NOTIFICATIONS] fetch:', e.message); });
  }

  // ── Wire bell ─────────────────────────────────────────────
  function wireBell() {
    if (_wired) return;

    _bellBtn = document.getElementById('notificationBtn');

    // Fallback for newradarfe
    if (!_bellBtn) {
      _bellBtn = document.getElementById('notification-indicator');
    }

    if (!_bellBtn) return;

    _wired = true;

    // Create our own badge on the bell
    ensureOwnBadge();

    _bellBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      togglePanel();
    });

    console.log('[NOTIFICATIONS] \u2705 Bell wired to', _bellBtn.id);
    fetchNotifications();
    setInterval(fetchNotifications, POLL_MS);

    // Watch for shell re-injecting the header (theme toggle etc.)
    // and restore our badge count immediately
    var headerMount = document.getElementById('amcShellHeader');
    if (headerMount) {
      var headerObserver = new MutationObserver(function() {
        // Shell re-injected header — re-wire and restore badge
        var newBtn = document.getElementById('notificationBtn');
        if (newBtn && newBtn !== _bellBtn) {
          _bellBtn = newBtn;
          _ownBadge = null;
          ensureOwnBadge();
          updateBadge(_unreadCount);
          // Re-wire click
          _bellBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            togglePanel();
          });
          console.log('[NOTIFICATIONS] \u21bb Bell re-wired after shell re-injection');
        }
      });
      headerObserver.observe(headerMount, { childList: true, subtree: true });
    }
  }

  // ── MutationObserver to wait for shell to inject header ───
  function observeForBell() {
    wireBell();
    if (_wired) return;

    var observer = new MutationObserver(function() {
      if (!_wired) wireBell();
      if (_wired) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    setTimeout(function() {
      if (!_wired) {
        observer.disconnect();
        console.warn('[NOTIFICATIONS] #notificationBtn not found after 10s');
      }
    }, 10000);
  }

  // ── Boot ──────────────────────────────────────────────────
  _panel = createPanel();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeForBell);
  } else {
    observeForBell();
  }

})();

