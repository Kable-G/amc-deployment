// Journalist Tools Drawer Loader
(function() {
  if (document.getElementById('amc-tools-drawer')) return;
  var st = document.createElement('style');
  st.textContent = 'block and <body> content into any AMC page.\n  Call AMCTools.open(\'unit\') / AMCTools.close() from anywhere.\n  \n  INTEGRATION STEPS:\n  1. Add the <style> block to the page <head>\n  2. Add the drawer HTML (everything inside <body>) before </body>\n  3. Add the <script> block\n  4. In the avatar modal "Tools" click handler, call: AMCTools.open(\'unit\')\n  5. In the shell JS, add \'unit-converter.html\' link to sidebar Tools section\n-->\n<style>\n\n\n\n#amc-tools-overlay {\n  position:fixed; inset:0; background:rgba(0,0,0,0.4);\n  z-index:2000; opacity:0; visibility:hidden;\n  transition:opacity 280ms cubic-bezier(0.16,1,0.3,1), visibility 280ms;\n  backdrop-filter:blur(2px);\n}\n#amc-tools-overlay.open { opacity:1; visibility:visible; }\n\n\n#amc-tools-drawer {\n  position:fixed; top:0; right:0; bottom:0;\n  width:520px; max-width:100vw;\n  background:var(--bg-secondary,#1a1f2e);\n  border-left:1px solid var(--border-primary,#2d3748);\n  z-index:2001;\n  display:flex; flex-direction:column;\n  transform:translateX(100%);\n  transition:transform 300ms cubic-bezier(0.16,1,0.3,1);\n  box-shadow:-8px 0 40px rgba(0,0,0,0.3);\n}\n#amc-tools-drawer.open { transform:translateX(0); }\n\n\n.atd-header {\n  display:flex; align-items:center; justify-content:space-between;\n  padding:16px 20px 0;\n  border-bottom:1px solid var(--border-primary,#2d3748);\n  flex-shrink:0;\n  gap:12px;\n}\n.atd-title {\n  font-family:\'Inter\',sans-serif; font-size:15px; font-weight:700;\n  color:var(--text-headings,#f1f5f9); display:flex; align-items:center; gap:8px;\n  flex-shrink:0;\n}\n.atd-title i { color:var(--accent-primary,#3b82f6); font-size:14px; }\n\n\n.atd-tabs {\n  display:none;\n}\n.atd-tab {\n  padding:12px 16px 10px;\n  font-family:\'Inter\',sans-serif; font-size:12px; font-weight:600;\n  letter-spacing:0.04em; text-transform:uppercase;\n  color:var(--text-secondary,#94a3b8);\n  background:transparent; border:none; cursor:pointer;\n  border-bottom:2px solid transparent;\n  transition:color 150ms, border-color 150ms;\n  white-space:nowrap;\n  display:flex; align-items:center; gap:6px;\n}\n.atd-tab:hover { color:var(--text-primary,#e2e8f0); }\n.atd-tab.active {\n  color:var(--accent-primary,#3b82f6);\n  border-bottom-color:var(--accent-primary,#3b82f6);\n}\n.atd-tab .atd-soon {\n  font-size:9px; padding:1px 5px; border-radius:3px;\n  background:rgba(148,163,184,0.1); color:var(--text-secondary,#94a3b8);\n  font-weight:600; letter-spacing:0.05em;\n}\n.atd-close {\n  width:32px; height:32px; border-radius:8px;\n  background:transparent; border:1px solid var(--border-primary,#2d3748);\n  color:var(--text-secondary,#94a3b8); cursor:pointer;\n  display:flex; align-items:center; justify-content:center;\n  font-size:13px; flex-shrink:0; margin-bottom:2px;\n  transition:all 150ms;\n}\n.atd-close:hover { background:rgba(239,68,68,0.1); border-color:rgba(239,68,68,0.3); color:#ef4444; }\n\n\n.atd-content {\n  flex:1; overflow-y:auto; overflow-x:hidden;\n  padding:0;\n  scroll-behavior:smooth;\n}\n.atd-panel { display:none; height:100%; }\n.atd-panel.active { display:flex; flex-direction:column; }\n\n\n.atd-coming-soon {\n  flex:1; display:flex; flex-direction:column;\n  align-items:center; justify-content:center; gap:12px;\n  padding:40px; text-align:center;\n}\n.atd-coming-soon i { font-size:36px; color:var(--border-primary,#2d3748); }\n.atd-coming-soon h3 { font-family:\'Inter\',sans-serif; font-size:16px; font-weight:700; color:var(--text-headings,#f1f5f9); margin:0; }\n.atd-coming-soon p { font-family:\'Inter\',sans-serif; font-size:13px; color:var(--text-secondary,#94a3b8); margin:0; line-height:1.6; }\n\n\n.uc-hub {\n  padding:16px 20px 20px;\n  display:flex; flex-direction:column; gap:12px;\n}\n.uc-hub-hint {\n  font-family:\'Inter\',sans-serif; font-size:11px; font-weight:500;\n  color:var(--text-secondary,#94a3b8); letter-spacing:0.03em;\n  display:flex; align-items:center; gap:6px; padding:0 2px;\n}\n.uc-hub-hint i { font-size:11px; opacity:0.6; }\n\n\n.uc-grid {\n  display:grid;\n  grid-template-columns:repeat(3,1fr);\n  gap:8px;\n}\n@media(max-width:480px){ .uc-grid { grid-template-columns:repeat(2,1fr); } }\n\n.uc-card {\n  background:var(--bg-tertiary,#161b26);\n  border:1px solid var(--border-primary,#2d3748);\n  border-radius:10px; padding:14px 12px 12px;\n  cursor:grab; text-decoration:none;\n  display:flex; flex-direction:column; align-items:center;\n  gap:8px; text-align:center;\n  transition:border-color 150ms, transform 150ms, box-shadow 150ms;\n  user-select:none; position:relative; overflow:hidden;\n}\n.uc-card:hover {\n  border-color:var(--accent-primary,#3b82f6);\n  transform:translateY(-1px);\n  box-shadow:0 4px 12px rgba(59,130,246,0.12);\n}\n.uc-card:active { cursor:grabbing; }\n.uc-card.dragging { opacity:0.5; transform:rotate(2deg) scale(1.02); border-color:var(--accent-primary,#3b82f6); }\n.uc-card.drag-over { border-color:var(--accent-primary,#3b82f6); background:rgba(59,130,246,0.05); }\n\n.uc-card-icon {\n  width:36px; height:36px; border-radius:9px;\n  display:flex; align-items:center; justify-content:center;\n  font-size:15px;\n  background:rgba(59,130,246,0.08); color:var(--accent-primary,#3b82f6);\n}\n\n.uc-card[data-cat="Power"] .uc-card-icon,\n.uc-card[data-cat="ChargingSpeed"] .uc-card-icon,\n.uc-card[data-cat="EnergyStorage"] .uc-card-icon { background:rgba(245,158,11,0.08); color:#f59e0b; }\n.uc-card[data-cat="Speed"] .uc-card-icon,\n.uc-card[data-cat="Distance"] .uc-card-icon { background:rgba(59,130,246,0.08); color:#3b82f6; }\n.uc-card[data-cat="Torque"] .uc-card-icon,\n.uc-card[data-cat="Force"] .uc-card-icon { background:rgba(239,68,68,0.08); color:#ef4444; }\n.uc-card[data-cat="FuelConsumption"] .uc-card-icon,\n.uc-card[data-cat="EnergyConsumption"] .uc-card-icon,\n.uc-card[data-cat="Emissions"] .uc-card-icon { background:rgba(16,185,129,0.08); color:#10b981; }\n.uc-card[data-cat="Weight"] .uc-card-icon,\n.uc-card[data-cat="Dimensions"] .uc-card-icon,\n.uc-card[data-cat="Area"] .uc-card-icon { background:rgba(168,85,247,0.08); color:#a855f7; }\n\n.uc-card-name {\n  font-family:\'Inter\',sans-serif; font-size:11px; font-weight:600;\n  color:var(--text-primary,#e2e8f0); line-height:1.3;\n}\n.uc-drag-hint {\n  position:absolute; top:6px; right:6px;\n  font-size:9px; color:var(--text-secondary,#94a3b8); opacity:0.4;\n}\n\n\n.uc-detail { display:flex; flex-direction:column; height:100%; }\n\n.uc-detail-header {\n  display:flex; align-items:center; gap:10px;\n  padding:14px 20px 12px;\n  border-bottom:1px solid var(--border-primary,#2d3748);\n  flex-shrink:0;\n}\n.uc-back-btn {\n  width:30px; height:30px; border-radius:7px;\n  background:transparent; border:1px solid var(--border-primary,#2d3748);\n  color:var(--text-secondary,#94a3b8); cursor:pointer;\n  display:flex; align-items:center; justify-content:center;\n  font-size:12px; transition:all 150ms; flex-shrink:0;\n}\n.uc-back-btn:hover { background:var(--bg-tertiary,#161b26); color:var(--text-primary,#e2e8f0); border-color:var(--accent-primary,#3b82f6); }\n.uc-detail-title {\n  font-family:\'Inter\',sans-serif; font-size:14px; font-weight:700;\n  color:var(--text-headings,#f1f5f9); flex:1;\n  display:flex; align-items:center; gap:8px;\n}\n.uc-detail-title i { color:var(--accent-primary,#3b82f6); font-size:13px; }\n.uc-detail-actions { display:flex; gap:6px; }\n.uc-action-btn {\n  height:28px; padding:0 10px; border-radius:6px;\n  background:transparent; border:1px solid var(--border-primary,#2d3748);\n  color:var(--text-secondary,#94a3b8); cursor:pointer;\n  font-family:\'Inter\',sans-serif; font-size:11px; font-weight:500;\n  display:flex; align-items:center; gap:5px;\n  transition:all 150ms; white-space:nowrap;\n}\n.uc-action-btn:hover { border-color:var(--accent-primary,#3b82f6); color:var(--accent-primary,#3b82f6); }\n\n.uc-units { flex:1; overflow-y:auto; padding:12px 20px 16px; display:flex; flex-direction:column; gap:8px; }\n\n.uc-unit-row {\n  display:grid; grid-template-columns:72px 1fr;\n  align-items:center; gap:10px;\n  padding:8px 12px; border-radius:8px;\n  background:var(--bg-tertiary,#161b26);\n  border:1px solid var(--border-primary,#2d3748);\n  transition:border-color 150ms;\n}\n.uc-unit-row:focus-within { border-color:var(--accent-primary,#3b82f6); background:rgba(59,130,246,0.03); }\n\n.uc-symbol {\n  font-family:\'Inter\',sans-serif; font-size:13px; font-weight:700;\n  color:var(--accent-primary,#3b82f6); text-align:center;\n  cursor:help; position:relative;\n}\n.uc-symbol:hover .uc-tooltip { opacity:1; pointer-events:auto; }\n.uc-tooltip {\n  position:absolute; left:0; top:calc(100% + 6px);\n  width:200px; background:var(--bg-primary,#0f1523);\n  border:1px solid var(--border-primary,#2d3748);\n  border-radius:8px; padding:10px 12px;\n  font-size:11px; color:var(--text-secondary,#94a3b8); line-height:1.5;\n  font-weight:400; z-index:100; opacity:0; pointer-events:none;\n  transition:opacity 150ms; box-shadow:0 8px 24px rgba(0,0,0,0.3);\n}\n.uc-unit-right { display:flex; flex-direction:column; gap:2px; }\n.uc-input-wrap { position:relative; display:flex; align-items:center; }\n.uc-input {\n  width:100%; padding:7px 28px 7px 10px;\n  background:var(--bg-secondary,#1a1f2e);\n  border:1px solid transparent; border-radius:6px;\n  color:var(--text-headings,#f1f5f9);\n  font-family:\'Inter\',sans-serif; font-size:14px; font-weight:600;\n  font-variant-numeric:tabular-nums;\n  transition:border-color 150ms; outline:none;\n}\n.uc-input::placeholder { color:var(--text-secondary,#94a3b8); font-weight:400; font-size:13px; }\n.uc-input:focus { border-color:var(--accent-primary,#3b82f6); }\n.uc-clear-btn {\n  position:absolute; right:6px;\n  width:18px; height:18px; border-radius:50%;\n  background:var(--border-primary,#2d3748); border:none;\n  color:var(--text-secondary,#94a3b8); cursor:pointer;\n  font-size:11px; display:none; align-items:center; justify-content:center;\n  transition:all 120ms;\n}\n.uc-clear-btn:hover { background:rgba(239,68,68,0.2); color:#ef4444; }\n.uc-unit-label {\n  font-family:\'Inter\',sans-serif; font-size:10px;\n  color:var(--text-secondary,#94a3b8); padding-left:2px;\n  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;\n}\n\n\n.uc-next-bar {\n  padding:10px 20px 14px;\n  border-top:1px solid var(--border-primary,#2d3748);\n  flex-shrink:0; display:flex; justify-content:flex-end;\n}\n.uc-next-btn {\n  padding:8px 16px; border-radius:8px;\n  background:var(--accent-primary,#3b82f6);\n  border:1px solid var(--accent-primary,#3b82f6);\n  color:#fff;\n  font-family:\'Inter\',sans-serif; font-size:12px; font-weight:500;\n  cursor:pointer; display:flex; align-items:center; gap:6px;\n  transition:all 150ms;\n}\n.uc-next-btn:hover { border-color:var(--accent-primary,#3b82f6); color:var(--accent-primary,#3b82f6); }\n\n\n.uc-toast-wrap {\n  position:fixed; bottom:24px; left:50%; transform:translateX(-50%);\n  z-index:3000; display:flex; flex-direction:column; gap:8px; align-items:center;\n  pointer-events:none;\n}\n.uc-toast {\n  padding:9px 16px; border-radius:8px; font-family:\'Inter\',sans-serif;\n  font-size:12px; font-weight:500; color:#fff;\n  display:flex; align-items:center; gap:7px;\n  animation:uc-toast-in 250ms cubic-bezier(0.16,1,0.3,1) both;\n  box-shadow:0 4px 16px rgba(0,0,0,0.3);\n}\n.uc-toast.success { background:#10b981; }\n.uc-toast.info { background:#3b82f6; }\n.uc-toast.warning { background:#f59e0b; }\n.uc-toast.error { background:#ef4444; }\n.uc-toast.fade-out { animation:uc-toast-out 200ms ease forwards; }\n@keyframes uc-toast-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }\n@keyframes uc-toast-out { to{opacity:0;transform:translateY(4px)} }\n\n\n.atd-content::-webkit-scrollbar,\n.uc-units::-webkit-scrollbar { width:4px; }\n.atd-content::-webkit-scrollbar-thumb,\n.uc-units::-webkit-scrollbar-thumb { background:var(--border-primary,#2d3748); border-radius:2px; }\n\n\n@media(max-width:600px) {\n  #amc-tools-drawer { width:100vw; max-width:100vw; right:0; border-left:none; border-top:1px solid var(--border-primary,#2d3748); top:56px; border-radius:16px 16px 0 0; box-sizing:border-box; overflow:hidden; }\n  .atd-header { padding:12px 14px 0 !important; gap:6px !important; }\n  .atd-title { font-size:12px !important; }\n  .atd-tab { padding:10px 8px 8px !important; font-size:10px !important; }\n  .atd-close { width:28px !important; height:28px !important; font-size:12px !important; }\n  .uc-grid { grid-template-columns:repeat(2,1fr); }\n  .uc-unit-row { grid-template-columns:56px 1fr; }\n  .atd-tab { font-size:11px; padding:10px 12px 8px; }\n}\n\n\nbody:not(.dark-mode) #amc-tools-drawer { background:#ffffff; border-color:#e2e8f0; }\nbody:not(.dark-mode) .uc-card { background:#f8fafc; border-color:#e2e8f0; }\nbody:not(.dark-mode) .uc-unit-row { background:#f8fafc; border-color:#e2e8f0; }\nbody:not(.dark-mode) .uc-input { background:#ffffff; color:#1e293b; }\nbody:not(.dark-mode) .atd-header { border-color:#e2e8f0; }\nbody:not(.dark-mode) .atd-title,\nbody:not(.dark-mode) .uc-detail-title,\nbody:not(.dark-mode) .uc-card-name { color:#1e293b; }\nbody:not(.dark-mode) .atd-tab { color:#64748b; }\nbody:not(.dark-mode) .atd-tab.active { color:#3b82f6; }\nbody:not(.dark-mode) .uc-symbol { color:#3b82f6; }\nbody:not(.dark-mode) .uc-tooltip { background:#1e293b; border-color:#334155; }';
  document.head.appendChild(st);
  var wrap = document.createElement('div');
  wrap.innerHTML = '<!-- Overlay -->\n<div id="amc-tools-overlay" onclick="AMCTools.close()"></div>\n\n<!-- Drawer -->\n<div id="amc-tools-drawer" role="dialog" aria-label="Tools">\n\n  <!-- Header with tabs and close -->\n  <div class="atd-header">\n    <div class="atd-title"><i class="fas fa-wrench"></i> Tools</div>\n    <div class="atd-tabs">\n      <button class="atd-tab active" data-tab="unit" onclick="AMCTools.switchTab(\'unit\')">\n        <i class="fas fa-ruler-combined"></i> Units\n      </button>\n      <button class="atd-tab" data-tab="currency" onclick="AMCTools.switchTab(\'currency\')">\n        <i class="fas fa-dollar-sign"></i> FX\n        \n      </button>\n      <button class="atd-tab" data-tab="timezone" onclick="AMCTools.switchTab(\'timezone\')">\n        <i class="fas fa-clock"></i> TZ\n        \n      </button>\n    </div>\n    <button class="atd-close" onclick="AMCTools.close()" title="Close (Esc)"><i class="fas fa-times"></i></button>\n  </div>\n\n  <!-- Content panels -->\n  <div class="atd-content">\n\n    <!-- ── Unit Converter Panel ── -->\n    <div class="atd-panel active" id="atd-unit">\n\n      <!-- Hub view: category grid -->\n      <div class="uc-hub" id="uc-hub">\n        <div class="uc-hub-hint"><i class="fas fa-grip-vertical"></i> Hold and drag to reorder</div>\n        <div class="uc-grid" id="uc-grid"></div>\n      </div>\n\n      <!-- Detail view: unit inputs -->\n      <div class="uc-detail" id="uc-detail" style="display:none">\n        <div class="uc-detail-header">\n          <button class="uc-back-btn" onclick="UCEngine.showHub()" title="Back"><i class="fas fa-arrow-left"></i></button>\n          <div class="uc-detail-title">\n            <i id="uc-detail-icon" class="fas fa-bolt"></i>\n            <span id="uc-detail-name">Power</span>\n          </div>\n          <div class="uc-detail-actions">\n            <button class="uc-action-btn" onclick="UCEngine.reset()"><i class="fas fa-rotate-left"></i> Reset</button>\n            <button class="uc-action-btn" onclick="UCEngine.copy()"><i class="fas fa-copy"></i> Copy</button>\n          </div>\n        </div>\n        <div class="uc-units" id="uc-units"></div>\n        <div class="uc-next-bar">\n          <button class="uc-next-btn" id="uc-next-btn" onclick="UCEngine.loadNext()">\n            Next: <span id="uc-next-name"></span> <i class="fas fa-arrow-right"></i>\n          </button>\n        </div>\n      </div>\n\n    </div><!-- /unit panel -->\n\n    <!-- ── Currency Panel (coming soon) ── -->\n    <div class="atd-panel" id="atd-currency">\n      <div class="atd-coming-soon">\n        <i class="fas fa-dollar-sign"></i>\n        <h3>Currency Converter</h3>\n        <p>Convert between global currencies with live exchange rates. Coming in the next sprint.</p>\n      </div>\n    </div>\n\n    <!-- ── Timezone Panel (coming soon) ── -->\n    <div class="atd-panel" id="atd-timezone">\n      <div class="atd-coming-soon">\n        <i class="fas fa-clock"></i>\n        <h3>Timezone Converter</h3>\n        <p>Convert embargo times and event schedules across global timezones. Coming in the next sprint.</p>\n      </div>\n    </div>\n\n  </div><!-- /content -->\n</div><!-- /drawer -->\n<div class="uc-toast-wrap" id="uc-toasts"></div>';
  document.body.appendChild(wrap);
  // ═══════════════════════════════════════════════════════════
// AMC TOOLS DRAWER — Global API
// ═══════════════════════════════════════════════════════════

window.AMCTools = {
  open(tab) {
    document.getElementById('amc-tools-overlay').classList.add('open');
    document.getElementById('amc-tools-drawer').classList.add('open');
    document.body.style.overflow = 'hidden';
    const titles = { unit: ['fa-ruler-combined','Unit Converter'], currency: ['fa-dollar-sign','Currency Converter'], timezone: ['fa-clock','Timezone Converter'] };
    const t = titles[tab||'unit'];
    const titleEl = document.querySelector('.atd-title');
    if (titleEl && t) titleEl.innerHTML = '<i class="fas '+t[0]+'"></i> '+t[1];
    if (tab) this.switchTab(tab);
    if (tab === 'unit' || !tab) UCEngine.initHub();
  },
  close() {
    document.getElementById('amc-tools-overlay').classList.remove('open');
    document.getElementById('amc-tools-drawer').classList.remove('open');
    document.body.style.overflow = '';
  },
  switchTab(name) {
    document.querySelectorAll('.atd-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.atd-panel').forEach(p => p.classList.toggle('active', p.id === 'atd-' + name));
    if (name === 'unit') UCEngine.initHub();
  }
};

// Close on Escape
document.addEventListener('keydown', e => { if (e.key === 'Escape') AMCTools.close(); });

// ═══════════════════════════════════════════════════════════
// UNIT CONVERTER ENGINE
// ═══════════════════════════════════════════════════════════

(() => {

// ── Conversion data (all validated factors from original) ──
const converters = {
  Power: {
    units:['kW','PS','bhp','hp','W','MW'],
    symbols:{kW:'kW',PS:'PS',bhp:'bhp',hp:'hp',W:'W',MW:'MW'},
    labels:{kW:'kilowatts',PS:'metric horsepower (PS)',bhp:'brake horsepower',hp:'mechanical horsepower',W:'watts',MW:'megawatts'},
    tooltips:{kW:'Standard SI unit of power. Most modern vehicles specify power in kW.',PS:'Pferdestärke — European/German standard. 1 PS = 735.5W.',bhp:'Brake horsepower — power at the flywheel before drivetrain losses.',hp:'Mechanical horsepower. 1 hp = 745.7W, slightly different from PS.',W:'Base SI unit of power.',MW:'1 MW = 1000 kW. Used for large industrial applications.'},
    baseUnit:'kW',
    factors:{kW:1,PS:0.73549875,bhp:0.745699872,hp:0.745699872,W:0.001,MW:1000}
  },
  Torque: {
    units:['Nm','lbFt','kgM','ozIn','kgCm'],
    symbols:{Nm:'Nm',lbFt:'lb·ft',kgM:'kg·m',ozIn:'oz·in',kgCm:'kg·cm'},
    labels:{Nm:'newton-meters',lbFt:'pound-feet',kgM:'kilogram-meters',ozIn:'ounce-inches',kgCm:'kilogram-centimeters'},
    tooltips:{Nm:'SI unit of torque, standard worldwide.',lbFt:'Imperial unit, standard in the United States.',kgM:'Older metric unit in vintage car specifications.',ozIn:'For very small torque values.',kgCm:'Smaller torque applications and some motorcycles.'},
    baseUnit:'Nm',
    factors:{Nm:1,lbFt:1.35581795,kgM:9.80665,ozIn:0.00706155,kgCm:0.0980665}
  },
  Speed: {
    units:['kmh','mph','ms','fts','knots','mach'],
    symbols:{kmh:'km/h',mph:'mph',ms:'m/s',fts:'ft/s',knots:'kn',mach:'Mach'},
    labels:{kmh:'kilometers per hour',mph:'miles per hour',ms:'meters per second',fts:'feet per second',knots:'knots',mach:'speed of sound'},
    tooltips:{kmh:'Standard speed unit in most countries.',mph:'Standard in the United States and United Kingdom.',ms:'SI unit of speed.',fts:'Imperial unit in some engineering applications.',knots:'Nautical miles per hour. 1 kn = 1.852 km/h.',mach:'Relative to speed of sound (~343 m/s at sea level).'},
    baseUnit:'ms',
    factors:{ms:1,kmh:1/3.6,mph:0.44704,fts:0.3048,knots:0.514444,mach:343}
  },
  Distance: {
    units:['km','mi','m','ft','nm','yd'],
    symbols:{km:'km',mi:'mi',m:'m',ft:'ft',nm:'NM',yd:'yd'},
    labels:{km:'kilometers',mi:'statute miles',m:'meters',ft:'feet',nm:'nautical miles',yd:'yards'},
    tooltips:{km:'Standard metric distance unit.',mi:'Imperial distance unit. 1 mi = 1.609 km.',m:'SI base unit of length.',ft:'Imperial unit for smaller distances.',nm:'Nautical mile = 1.852 km.',yd:'Imperial unit. 3 ft = 1 yd.'},
    baseUnit:'km',
    factors:{km:1,mi:1.609344,m:0.001,ft:0.0003048,nm:1.852,yd:0.0009144}
  },
  Weight: {
    units:['kg','lb','tonnes','tons','g','oz','stone'],
    symbols:{kg:'kg',lb:'lb',tonnes:'t',tons:'ton',g:'g',oz:'oz',stone:'st'},
    labels:{kg:'kilograms',lb:'pounds',tonnes:'metric tonnes',tons:'imperial tons',g:'grams',oz:'ounces',stone:'stones'},
    tooltips:{kg:'SI base unit of mass.',lb:'Imperial unit, standard in the US.',tonnes:'1 tonne = 1000 kg.',tons:'Imperial ton = 2240 lb = 1016 kg.',g:'1 kg = 1000 g.',oz:'16 oz = 1 lb.',stone:'1 stone = 14 lb.'},
    baseUnit:'kg',
    factors:{kg:1,lb:0.453592,tonnes:1000,tons:1016.047,g:0.001,oz:0.0283495,stone:6.35029}
  },
  Dimensions: {
    units:['mm','cm','m','in','ft','mil'],
    symbols:{mm:'mm',cm:'cm',m:'m',in:'in',ft:'ft',mil:'mil'},
    labels:{mm:'millimeters',cm:'centimeters',m:'meters',in:'inches',ft:'feet',mil:'thousandths of an inch'},
    tooltips:{mm:'Standard unit for automotive dimensions.',cm:'Commonly used for interior dimensions.',m:'SI base unit.',in:'Imperial standard in US automotive. 1 in = 25.4 mm.',ft:'1 ft = 12 in = 304.8 mm.',mil:'For very precise measurements like paint thickness.'},
    baseUnit:'m',
    factors:{m:1,mm:0.001,cm:0.01,in:0.0254,ft:0.3048,mil:0.0000254}
  },
  Volume: {
    units:['liters','usGallons','ukGallons','cuFt','cuIn','ml','cc'],
    symbols:{liters:'L',usGallons:'US gal',ukGallons:'UK gal',cuFt:'ft³',cuIn:'in³',ml:'mL',cc:'cc'},
    labels:{liters:'liters',usGallons:'US gallons',ukGallons:'UK gallons',cuFt:'cubic feet',cuIn:'cubic inches',ml:'milliliters',cc:'cubic centimeters'},
    tooltips:{liters:'Standard metric unit for fuel and displacement.',usGallons:'1 US gal = 3.785 L.',ukGallons:'1 UK gal = 4.546 L.',cuFt:'Common for cargo and boot volume in US markets. 1 ft³ = 28.317 L.',cuIn:'Common for engine displacement in US markets.',ml:'1 mL = 1 cc.',cc:'1 cc = 1 mL, used for motorcycle displacement.'},
    baseUnit:'liters',
    factors:{liters:1,usGallons:3.78541,ukGallons:4.54609,cuFt:28.3168,cuIn:0.0163871,ml:0.001,cc:0.001}
  },
  Pressure: {
    units:['bar','psi','kPa','MPa','atm'],
    symbols:{bar:'bar',psi:'psi',kPa:'kPa',MPa:'MPa',atm:'atm'},
    labels:{bar:'bar',psi:'pounds per square inch',kPa:'kilopascals',MPa:'megapascals',atm:'atmospheres'},
    tooltips:{bar:'Common for tire pressure and turbo boost.',psi:'Standard US pressure unit for tires.',kPa:'SI unit, used in many countries for tires.',MPa:'For high-pressure applications like fuel injection.',atm:'Standard atmospheric pressure at sea level.'},
    baseUnit:'bar',
    factors:{bar:1,psi:0.0689476,kPa:0.01,MPa:10,atm:1.01325}
  },
  Temperature: {
    units:['C','F','K'],
    symbols:{C:'°C',F:'°F',K:'K'},
    labels:{C:'Celsius',F:'Fahrenheit',K:'Kelvin'},
    tooltips:{C:'Standard worldwide. Water freezes 0°C, boils 100°C.',F:'Used in the United States. Freeze 32°F, boil 212°F.',K:'SI base unit from absolute zero. 0K = -273.15°C.'},
    baseUnit:'C', isSpecial:true
  },
  FuelConsumption: {
    units:['l100km','mpgUS','mpgUK','kml'],
    symbols:{l100km:'L/100km',mpgUS:'MPG (US)',mpgUK:'MPG (UK)',kml:'km/L'},
    labels:{l100km:'liters per 100km',mpgUS:'miles per US gallon',mpgUK:'miles per UK gallon',kml:'kilometers per liter'},
    tooltips:{l100km:'European standard. Lower = better.',mpgUS:'American standard. Higher = better.',mpgUK:'British standard. Higher = better.',kml:'Asian standard. Higher = better.'},
    baseUnit:'l100km', isInverse:true,
    factors:{l100km:1,mpgUS:235.214,mpgUK:282.481,kml:100}
  },
  EnergyConsumption: {
    units:['kWhper100km','Whperkm','kWhpermi','MPGe'],
    symbols:{kWhper100km:'kWh/100km',Whperkm:'Wh/km',kWhpermi:'kWh/mi',MPGe:'MPGe'},
    labels:{kWhper100km:'kWh per 100km',Whperkm:'Wh per km',kWhpermi:'kWh per mile',MPGe:'MPG equivalent'},
    tooltips:{kWhper100km:'European EV standard.',Whperkm:'Precise metric for EV efficiency.',kWhpermi:'Energy per mile for EVs.',MPGe:'EPA standard comparing EV to gasoline efficiency.'},
    baseUnit:'kWhper100km', isSpecialEnergyConsumption:true
  },
  ChargingSpeed: {
    units:['kW_cs','AC7kW','AC11kW','AC22kW','DC50kW','DC150kW','DC350kW'],
    symbols:{kW_cs:'kW',AC7kW:'AC 7kW',AC11kW:'AC 11kW',AC22kW:'AC 22kW',DC50kW:'DC 50kW',DC150kW:'DC 150kW',DC350kW:'DC 350kW'},
    labels:{kW_cs:'kilowatts',AC7kW:'AC Level 2 (7kW)',AC11kW:'AC Level 2 (11kW)',AC22kW:'AC Level 2 (22kW)',DC50kW:'DC Fast (50kW)',DC150kW:'DC Fast (150kW)',DC350kW:'DC Ultra Fast (350kW)'},
    tooltips:{kW_cs:'Standard unit for EV charging power.',AC7kW:'Typical home wallbox. Good for overnight.',AC11kW:'Three-phase AC, common in Europe.',AC22kW:'Maximum three-phase AC.',DC50kW:'Original rapid charging standard.',DC150kW:'Modern high-speed charging.',DC350kW:'Latest generation ultra-fast charging.'},
    baseUnit:'kW_cs',
    factors:{kW_cs:1,AC7kW:1,AC11kW:1,AC22kW:1,DC50kW:1,DC150kW:1,DC350kW:1}
  },
  EnergyStorage: {
    units:['kWh','Wh','MWh','MJ'],
    symbols:{kWh:'kWh',Wh:'Wh',MWh:'MWh',MJ:'MJ'},
    labels:{kWh:'kilowatt-hours',Wh:'watt-hours',MWh:'megawatt-hours',MJ:'megajoules'},
    tooltips:{kWh:'Standard EV battery capacity. Most EVs: 40–100 kWh.',Wh:'1 kWh = 1000 Wh.',MWh:'1 MWh = 1000 kWh.',MJ:'SI energy unit. 1 kWh = 3.6 MJ.'},
    baseUnit:'kWh',
    factors:{kWh:1,Wh:0.001,MWh:1000,MJ:1/3.6}
  },
  Emissions: {
    units:['gCO2perkm','gCO2permile','kgCO2per100km'],
    symbols:{gCO2perkm:'g CO₂/km',gCO2permile:'g CO₂/mi',kgCO2per100km:'kg CO₂/100km'},
    labels:{gCO2perkm:'grams CO₂ per km',gCO2permile:'grams CO₂ per mile',kgCO2per100km:'kg CO₂ per 100km'},
    tooltips:{gCO2perkm:'Standard European emission measurement.',gCO2permile:'Imperial emission measurement.',kgCO2per100km:'For higher-emission vehicles.'},
    baseUnit:'gCO2perkm', isSpecialEmissions:true
  },
  EngineDisplacement: {
    units:['liters_ed','cc','cuIn_ed'],
    symbols:{liters_ed:'L',cc:'cc',cuIn_ed:'in³'},
    labels:{liters_ed:'liters',cc:'cubic centimeters',cuIn_ed:'cubic inches'},
    tooltips:{liters_ed:'Common unit. 2.0L, 3.5L engines.',cc:'1000cc = 1L. Motorcycles and small engines.',cuIn_ed:'American unit. 350 in³, 427 in³.'},
    baseUnit:'liters_ed',
    factors:{liters_ed:1,cc:0.001,cuIn_ed:0.0163871}
  },
  Area: {
    units:['sqm','sqft','sqin','hectare'],
    symbols:{sqm:'m²',sqft:'ft²',sqin:'in²',hectare:'ha'},
    labels:{sqm:'square meters',sqft:'square feet',sqin:'square inches',hectare:'hectares'},
    tooltips:{sqm:'SI unit of area.',sqft:'Imperial unit, common in US.',sqin:'For smaller areas like cross-sections.',hectare:'1 ha = 10,000 m².'},
    baseUnit:'sqm',
    factors:{sqm:1,sqft:0.092903,sqin:0.00064516,hectare:10000}
  }
};

const ICONS = {
  Power:'fa-bolt',Torque:'fa-wrench',Speed:'fa-tachometer-alt',Distance:'fa-road',
  Weight:'fa-weight-hanging',Dimensions:'fa-ruler',Volume:'fa-fill-drip',
  Pressure:'fa-gauge-high',Temperature:'fa-thermometer-half',
  FuelConsumption:'fa-gas-pump',EnergyConsumption:'fa-leaf',ChargingSpeed:'fa-charging-station',
  EnergyStorage:'fa-battery-full',Emissions:'fa-smog',EngineDisplacement:'fa-cogs',Area:'fa-vector-square'
};
const NAMES = {
  Power:'Power',Torque:'Torque',Speed:'Speed',Distance:'Distance',
  Weight:'Weight',Dimensions:'Dimensions',Volume:'Volume',
  Pressure:'Pressure',Temperature:'Temperature',
  FuelConsumption:'Fuel Consumption',EnergyConsumption:'Energy Consumption',
  ChargingSpeed:'Charging Speed',EnergyStorage:'Energy Storage',
  Emissions:'Emissions',EngineDisplacement:'Engine Displacement',Area:'Area'
};

const DEFAULT_ORDER = Object.keys(converters);
let order = [], current = null, cfg = {}, lastInput = null, isCalc = false;
let dragEl = null, dragIdx = -1;
let touchStart = null, touchCurrent = null, isTouchDrag = false;

// ── Persistence ──
function loadOrder() {
  try {
    const s = localStorage.getItem('amc_uc_order_v2');
    if (s) {
      const parsed = JSON.parse(s);
      order = DEFAULT_ORDER.slice();
      parsed.forEach((k,i) => {
        const cur = order.indexOf(k);
        if (cur > -1) { order.splice(cur,1); order.splice(i,0,k); }
      });
    } else order = DEFAULT_ORDER.slice();
  } catch { order = DEFAULT_ORDER.slice(); }
}
function saveOrder() { localStorage.setItem('amc_uc_order_v2', JSON.stringify(order)); }

// ── Hub ──
function initHub() {
  loadOrder();
  renderHub();
}

function renderHub() {
  const grid = document.getElementById('uc-grid');
  if (!grid) return;
  grid.innerHTML = '';
  order.forEach((key, idx) => {
    const card = document.createElement('div');
    card.className = 'uc-card'; card.draggable = true;
    card.dataset.cat = key; card.dataset.idx = idx;
    card.innerHTML = `<div class="uc-drag-hint"><i class="fas fa-grip-dots-vertical"></i></div><div class="uc-card-icon"><i class="fas ${ICONS[key]||'fa-question'}"></i></div><div class="uc-card-name">${NAMES[key]||key}</div>`;
    card.onclick = (e) => { if (!card.classList.contains('dragging')) loadConverter(key); };
    card.addEventListener('dragstart', onDragStart);
    card.addEventListener('dragend', onDragEnd);
    card.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect='move'; });
    card.addEventListener('dragenter', function() { if(this!==dragEl) this.classList.add('drag-over'); });
    card.addEventListener('dragleave', function() { this.classList.remove('drag-over'); });
    card.addEventListener('drop', onDrop);
    card.addEventListener('touchstart', onTouchStart, {passive:false});
    card.addEventListener('touchmove', onTouchMove, {passive:false});
    card.addEventListener('touchend', onTouchEnd);
    grid.appendChild(card);
  });
}

function showHub() {
  document.getElementById('uc-hub').style.display = '';
  document.getElementById('uc-detail').style.display = 'none';
  current = null; cfg = {};
}

// ── Drag & Drop ──
function onDragStart(e) {
  dragEl = this; dragIdx = parseInt(this.dataset.idx);
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => this.style.opacity='0.5', 0);
}
function onDragEnd(e) {
  this.classList.remove('dragging'); this.style.opacity='';
  document.querySelectorAll('.uc-card').forEach(c => c.classList.remove('drag-over'));
  dragEl=null; dragIdx=-1;
}
function onDrop(e) {
  e.stopPropagation(); this.classList.remove('drag-over');
  if (this !== dragEl) {
    const di = dragIdx, ti = parseInt(this.dataset.idx);
    const moved = order.splice(di,1)[0];
    order.splice(ti,0,moved);
    saveOrder(); renderHub();
    toast('Layout saved','success',2500);
  }
  return false;
}

// ── Touch drag ──
function onTouchStart(e) { touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY,t:Date.now()}; isTouchDrag=false; }
function onTouchMove(e) {
  if (!touchStart) return;
  touchCurrent={x:e.touches[0].clientX,y:e.touches[0].clientY};
  const dx=Math.abs(touchCurrent.x-touchStart.x), dy=Math.abs(touchCurrent.y-touchStart.y);
  if (!isTouchDrag && (dx>15||dy>15) && Date.now()-touchStart.t>150) { isTouchDrag=true; this.classList.add('dragging'); }
  if (isTouchDrag) { e.preventDefault(); this.style.transform=`translate(${touchCurrent.x-touchStart.x}px,${touchCurrent.y-touchStart.y}px) rotate(3deg) scale(1.05)`; }
}
function onTouchEnd(e) {
  if (isTouchDrag && touchCurrent) {
    this.classList.remove('dragging'); this.style.transform='';
    const el = document.elementFromPoint(touchCurrent.x,touchCurrent.y);
    const target = el?.closest('.uc-card');
    if (target && target!==this) {
      const di=parseInt(this.dataset.idx), ti=parseInt(target.dataset.idx);
      const moved=order.splice(di,1)[0]; order.splice(ti,0,moved);
      saveOrder(); renderHub(); toast('Layout saved','success',2500);
    }
  } else if (!isTouchDrag && this.dataset.cat) {
    loadConverter(this.dataset.cat);
  }
  touchStart=null; touchCurrent=null; isTouchDrag=false;
}

// ── Converter detail ──
function loadConverter(key) {
  if (!converters[key]) return;
  current = key; cfg = converters[key]; lastInput = null;
  document.getElementById('uc-hub').style.display = 'none';
  document.getElementById('uc-detail').style.display = 'flex';
  document.getElementById('uc-detail-icon').className = `fas ${ICONS[key]||'fa-question'}`;
  document.getElementById('uc-detail-name').textContent = NAMES[key]||key;
  const units = document.getElementById('uc-units');
  units.innerHTML = '';
  cfg.units.forEach((u,i) => units.appendChild(makeRow(u)));
  // Next button
  const ci = order.indexOf(key);
  const nextBtn = document.getElementById('uc-next-btn');
  const nextName = document.getElementById('uc-next-name');
  if (ci < order.length-1) {
    nextName.textContent = NAMES[order[ci+1]]||order[ci+1];
    nextBtn.style.display = 'flex';
  } else nextBtn.style.display = 'none';
  // Auto-set first field to 1
  const firstInput = document.getElementById('uc-input-'+cfg.units[0]);
  if (firstInput) { setTimeout(()=>{ firstInput.value='1'; firstInput.focus(); firstInput.select(); doConvert(cfg.units[0],1); },80); }
}

function makeRow(unit) {
  const sym = cfg.symbols[unit]||unit;
  const lbl = cfg.labels[unit]||unit;
  const tip = cfg.tooltips?.[unit]||lbl;
  const row = document.createElement('div');
  row.className = 'uc-unit-row';
  row.innerHTML = `
    <div class="uc-symbol">${sym}<div class="uc-tooltip">${tip}</div></div>
    <div class="uc-unit-right">
      <div class="uc-input-wrap">
        <input class="uc-input" type="text" inputmode="decimal" id="uc-input-${unit}" placeholder="0" aria-label="${lbl}">
        <button class="uc-clear-btn" onclick="UCEngine._clearOne('${unit}')" tabindex="-1">×</button>
      </div>
      <div class="uc-unit-label">${lbl}</div>
    </div>`;
  const inp = row.querySelector('.uc-input');
  const clr = row.querySelector('.uc-clear-btn');
  inp.addEventListener('focus', function() { lastInput=this; this.select(); }); inp.addEventListener('keydown', function(e) { if(e.key==='Enter') { e.preventDefault(); this.blur(); } });
  let debTimer;
  inp.addEventListener('input', function() {
    clr.style.display = this.value.trim() ? 'flex' : 'none';
    clearTimeout(debTimer);
    debTimer = setTimeout(()=>{
      const v = parseFloat(this.value);
      if (!isNaN(v)) { doConvert(unit,v); }
      else if (!this.value.trim()) clearAll(unit);
    },250);
  });
  return row;
}

// ── Conversion logic ──
function doConvert(src, val) {
  if (!current||!cfg?.units||isCalc) return;
  isCalc=true;
  try {
    if (cfg.isSpecial && current==='Temperature') convTemp(src,val);
    else if (cfg.isSpecialEnergyConsumption) convEnergy(src,val);
    else if (cfg.isSpecialEmissions) convEmissions(src,val);
    else convLinear(src,val);
  } catch(e) { console.error(e); }
  isCalc=false;
}

function convLinear(src, val) {
  const f=cfg.factors, b=cfg.baseUnit;
  let base;
  if (cfg.isInverse) {
    if (src==='l100km') base=val;
    else if (['mpgUS','mpgUK','kml'].includes(src)) base=f[src]/val;
    else base=val*f[src];
  } else base=val*f[src];
  cfg.units.forEach(t => {
    if (t===src) return;
    const el=document.getElementById('uc-input-'+t); if(!el) return;
    let r;
    if (cfg.isInverse) {
      if (t==='l100km') r=base;
      else if (['mpgUS','mpgUK','kml'].includes(t)) r=f[t]/base;
      else r=base/f[t];
    } else r=base/f[t];
    setVal(t,r);
  });
}

function convTemp(src,v) {
  let C,F,K;
  if (src==='C') { C=v; F=v*1.8+32; K=v+273.15; }
  else if (src==='F') { F=v; C=(v-32)/1.8; K=C+273.15; }
  else { K=v; if(K<0) return; C=K-273.15; F=C*1.8+32; }
  const m={C,F,K};
  cfg.units.forEach(t=>{ if(t!==src) setVal(t,m[t]); });
}

function convEnergy(src,v) {
  let c={};
  const km2mi=1.60934;
  if (src==='kWhper100km') {
    c.kWhper100km=v; c.Whperkm=v*10;
    c.kWhpermi=(v/100)*km2mi; c.MPGe=33.705/c.kWhpermi;
  } else if (src==='Whperkm') {
    c.Whperkm=v; c.kWhper100km=v/10;
    c.kWhpermi=(v/1000)*km2mi; c.MPGe=33.705/c.kWhpermi;
  } else if (src==='kWhpermi') {
    c.kWhpermi=v; c.kWhper100km=(v/km2mi)*100;
    c.Whperkm=(v*1000)/km2mi; c.MPGe=33.705/v;
  } else if (src==='MPGe') {
    c.MPGe=v; c.kWhpermi=33.705/v;
    c.kWhper100km=(c.kWhpermi/km2mi)*100; c.Whperkm=(c.kWhpermi*1000)/km2mi;
  }
  cfg.units.forEach(t=>{ if(t!==src&&c[t]!==undefined) setVal(t,c[t]); });
}

function convEmissions(src,v) {
  const gLb=0.00220462, km2mi=1.609344;
  let c={};
  if (src==='gCO2perkm') { c.gCO2perkm=v; c.gCO2permile=v*km2mi; c.kgCO2per100km=(v/1000)*100; }
  else if (src==='gCO2permile') { c.gCO2perkm=v/km2mi; c.gCO2permile=v; c.kgCO2per100km=(c.gCO2perkm/1000)*100; }
  else if (src==='kgCO2per100km') { c.gCO2perkm=(v*1000)/100; c.gCO2permile=c.gCO2perkm*km2mi; c.kgCO2per100km=v; }
  cfg.units.forEach(t=>{ if(t!==src&&c[t]!==undefined) setVal(t,c[t]); });
}

function setVal(unit,val) {
  const el=document.getElementById('uc-input-'+unit); if(!el) return;
  el.value = (val===0)?'0':fmt(val);
  el.nextElementSibling.style.display='flex';
}

function clearAll(exclude) {
  if (!cfg?.units) return;
  cfg.units.forEach(u=>{
    if (u===exclude) return;
    const el=document.getElementById('uc-input-'+u); if(!el) return;
    el.value=''; el.nextElementSibling.style.display='none';
  });
}

function fmt(v) {
  if (!isFinite(v)||isNaN(v)) return '';
  if (v===0) return '0';
  const a=Math.abs(v);
  let s;
  if (a<0.01) s=v.toPrecision(3);
  else if (a<1) s=v.toFixed(4);
  else if (a<1000) s=v.toFixed(2);
  else if (a<100000) s=v.toFixed(1);
  else s=Math.round(v).toString();
  return s.includes('.')?s.replace(/\.?0+$/,''):s;
}

// ── Actions ──
function reset() {
  if (!current||!cfg?.units) return;
  clearAll(); lastInput=null;
  const first=cfg.units[0], el=document.getElementById('uc-input-'+first);
  if (el) { el.value='1'; doConvert(first,1); el.focus(); }
  toast('Reset to defaults','info',2000);
}

function copy() {
  if (!current||!cfg?.units) { toast('No converter active','warning',2500); return; }
  let text='';
  if (lastInput?.value?.trim()) {
    const uid=lastInput.id.replace('uc-input-','');
    if (cfg.units.includes(uid)) text=`${lastInput.value} ${cfg.symbols[uid]||uid} (${cfg.labels[uid]||uid})`;
  }
  if (!text) {
    const lines=cfg.units.map(u=>{
      const el=document.getElementById('uc-input-'+u);
      if (el?.value?.trim()) return `${el.value} ${cfg.symbols[u]||u} (${cfg.labels[u]||u})`;
      return null;
    }).filter(Boolean);
    text=lines.join('\n');
  }
  if (text) {
    navigator.clipboard.writeText(text).then(()=>toast('Copied to clipboard','success',2500),()=>toast('Copy failed','error',3000));
  } else toast('Enter a value first','warning',2500);
}

function loadNext() {
  const ci=order.indexOf(current);
  if (ci<order.length-1) loadConverter(order[ci+1]);
}

// ── Toast ──
function toast(msg, type='info', dur=3000) {
  const wrap=document.getElementById('uc-toasts');
  if (!wrap) return;
  const t=document.createElement('div');
  t.className=`uc-toast ${type}`;
  const icons={success:'fa-check',info:'fa-info-circle',warning:'fa-exclamation-triangle',error:'fa-times-circle'};
  t.innerHTML=`<i class="fas ${icons[type]||'fa-info-circle'}"></i>${msg}`;
  wrap.appendChild(t);
  setTimeout(()=>{
    t.classList.add('fade-out');
    setTimeout(()=>t.remove(),250);
  },dur);
}

// Public API
window.UCEngine = {
  initHub, showHub, loadConverter, reset, copy, loadNext,
  _clearOne(unit) {
    const el=document.getElementById('uc-input-'+unit); if(!el) return;
    el.value=''; clearAll(unit); el.focus();
    el.nextElementSibling.style.display='none';
  },
  toast
};

})(); // end UCEngine

// Init on drawer open is handled by AMCTools.open()
})();
