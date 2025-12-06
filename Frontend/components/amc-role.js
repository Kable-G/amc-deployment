// Frontend/components/amc-role.js
(() => {
  const QS = new URLSearchParams(location.search);

  const ROLE_KEYS = ["role", "userRole"];          // common property names
  const USER_KEYS = ["user", "currentUser"];       // common storage keys

  function readStoredRole() {
    for (const key of USER_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const u = JSON.parse(raw);
        for (const rk of ROLE_KEYS) {
          if (u && u[rk]) return u[rk];
        }
        if (Array.isArray(u?.roles) && u.roles[0]) return u.roles[0];
      } catch { /* ignore */ }
    }
    return null;
  }

  // 1) Resolve role: ?role=...  -> session override -> localStorage.user -> default
  const qsRole = QS.get("role");
  if (qsRole) sessionStorage.setItem("amcRoleOverride", qsRole);

  const sessionRole = sessionStorage.getItem("amcRoleOverride");
  const storedRole  = readStoredRole();
  const finalRole   = (sessionRole || storedRole || "media_user").trim();

  // 2) Optional compat seeding: ?amcSeed=1 (write a minimal user object that your
  //    existing pages already read to decide the sidebar/header content).
  const shouldSeed = QS.get("amcSeed") === "1";
  if (shouldSeed) {
    const seed = { role: finalRole, email: "diag@example.com", name: "Diagnostics User" };
    // write to both common keys so older/newer pages see it
    try { localStorage.setItem("user", JSON.stringify(seed)); } catch {}
    try { localStorage.setItem("currentUser", JSON.stringify(seed)); } catch {}
  }

  // 3) Public surface
  const AMC = (window.AMC ||= {});
  AMC.role = finalRole;

  AMC.setRole = (nextRole, { seed = true, reload = true } = {}) => {
    if (!nextRole) return;
    sessionStorage.setItem("amcRoleOverride", nextRole);
    if (seed) {
      // reseed localStorage so legacy builders pick it up
      const seedUser = { role: nextRole, email: "diag@example.com", name: "Diagnostics User" };
      try { localStorage.setItem("user", JSON.stringify(seedUser)); } catch {}
      try { localStorage.setItem("currentUser", JSON.stringify(seedUser)); } catch {}
    }
    document.body.dataset.amcRole = nextRole;
    if (reload) location.reload();
  };

  document.body.dataset.amcRole = finalRole;

  // 4) Optional dev UI (only if ?amcRoleDev=1) — tiny floating switcher for diagnostics
  if (QS.get("amcRoleDev") === "1") {
    const roles = ["media_user","client_user","client_admin","platform_admin"];
    const wrap = Object.assign(document.createElement("div"), {
      id: "amc-role-dev",
      title: "AMC Role Devtools",
    });
    Object.assign(wrap.style, {
      position:"fixed", bottom:"12px", right:"12px",
      background:"rgba(10,15,25,.9)", color:"#cbd5e1",
      padding:"8px", borderRadius:"10px", font:"12px/1.3 Inter,sans-serif",
      boxShadow:"0 8px 28px rgba(0,0,0,.35)", zIndex: 2147483647
    });
    const label = document.createElement("div");
    label.textContent = "Role: " + finalRole;
    label.style.marginBottom = "6px";
    label.style.opacity = ".85";
    wrap.appendChild(label);

    const row = document.createElement("div");
    row.style.display = "flex"; row.style.gap = "6px"; row.style.flexWrap = "wrap";
    for (const r of roles) {
      const b = document.createElement("button");
      b.textContent = r.replace("_"," ");
      Object.assign(b.style, {
        padding:"6px 8px", borderRadius:"8px", border:"1px solid rgba(148,163,184,.22)",
        background: r === finalRole ? "rgba(37,99,235,.25)" : "transparent",
        color:"#e2e8f0", cursor:"pointer"
      });
      b.onclick = () => AMC.setRole(r, { seed:true, reload:true });
      row.appendChild(b);
    }
    wrap.appendChild(row);
    document.body.appendChild(wrap);
  }
})();