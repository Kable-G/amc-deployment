/* =====================================================================
   DUAL MODE SIDEBAR CONTROLLER (AUTHORITATIVE)
   - Detects overlay mode at <=1599px
   - Forces collapsed rail on entry to overlay mode
   - Mirrors legacy class amc-collapsed <-> sidebar-collapsed
   - Derives sidebar-open in overlay mode from collapsed state (if needed)
   - Locks scroll when overlay open, unlocks when closed
   - Click outside + ESC closes overlay
   ===================================================================== */
(function(){
  console.log('✅ AMC Dual-mode controller initializing...');
  
  const mqOverlay = window.matchMedia("(max-width: 1599px)");
  
  // CRITICAL: Guard flag to prevent infinite MutationObserver loop
  let isUpdating = false;

  // Utility: sync legacy collapsed state naming
  function syncCollapsedAlias(){
    const hasAmc = document.body.classList.contains("amc-collapsed");
    const hasSidebar = document.body.classList.contains("sidebar-collapsed");

    if (hasAmc && !hasSidebar) document.body.classList.add("sidebar-collapsed");
    if (hasSidebar && !hasAmc) document.body.classList.add("amc-collapsed");
  }

  // Utility: in overlay mode, treat "not collapsed" as open unless sidebar-open explicitly exists
  function syncOverlayOpenState(){
    if (!document.body.classList.contains("overlay-mode")) {
      document.body.classList.remove("sidebar-open");
      document.body.style.overflow = "";
      return;
    }

    const isCollapsed = document.body.classList.contains("sidebar-collapsed") || document.body.classList.contains("amc-collapsed");
    const shouldBeOpen = !isCollapsed;

    // Prefer explicit sidebar-open in overlay mode (used by our CSS and observers)
    document.body.classList.toggle("sidebar-open", shouldBeOpen);

    // Scroll lock
    document.body.style.overflow = shouldBeOpen ? "hidden" : "";
  }

  function applyMode(){
    isUpdating = true;  // Set guard before making changes
    
    const isOverlay = mqOverlay.matches;
    const viewportWidth = window.innerWidth;
    
    console.log(`🎯 Dual-mode: Applying ${isOverlay ? 'OVERLAY' : 'DESKTOP'} mode (viewport: ${viewportWidth}px)`);
    
    document.body.classList.toggle("overlay-mode", isOverlay);

    if (isOverlay){
      // Force rail collapsed on entry
      document.body.classList.add("sidebar-collapsed");
      document.body.classList.add("amc-collapsed");
      document.body.classList.remove("sidebar-open");
      document.body.style.overflow = "";
      console.log('📱 Overlay mode: Sidebar set to collapsed rail (72px)');
    }else{
      // Desktop: restore persisted collapsed state (if any)
      const saved = localStorage.getItem("sidebar-collapsed") === "true";
      document.body.classList.toggle("sidebar-collapsed", saved);
      // Keep legacy alias aligned
      document.body.classList.toggle("amc-collapsed", saved);
      document.body.classList.remove("sidebar-open");
      document.body.style.overflow = "";
      console.log(`🖥️ Desktop mode: Sidebar ${saved ? 'collapsed (72px)' : 'expanded (272px)'}`);
    }

    syncCollapsedAlias();
    syncOverlayOpenState();
    
    setTimeout(() => { isUpdating = false; }, 0);  // Release guard after event loop
  }

  // Close overlay (only in overlay mode)
  function closeOverlay(){
    if (!document.body.classList.contains("overlay-mode")) return;
    
    isUpdating = true;  // Set guard
    document.body.classList.add("sidebar-collapsed");
    document.body.classList.add("amc-collapsed");
    document.body.classList.remove("sidebar-open");
    document.body.style.overflow = "";
    syncCollapsedAlias();
    setTimeout(() => { isUpdating = false; }, 0);  // Release guard
  }

  // Click outside closes overlay
  document.addEventListener("click", (e)=>{
    if (!document.body.classList.contains("overlay-mode")) return;
    if (!document.body.classList.contains("sidebar-open")) return;

    if (e.target.closest("#sidebar")) return;

    // Support several possible toggle selectors (sidebar is injected by components/sidebar.js)
    if (e.target.closest("#sidebarToggle, .sidebar-toggle, .hamburger-menu, [data-amc-sidebar-toggle]")) return;

    closeOverlay();
  }, true);

  // ESC closes overlay
  document.addEventListener("keydown", (e)=>{
    if (e.key !== "Escape") return;
    if (!document.body.classList.contains("overlay-mode")) return;
    if (!document.body.classList.contains("sidebar-open")) return;
    closeOverlay();
  });

  // Observe class changes from existing sidebar.js and translate to overlay-open + scroll lock
  // GUARD: Skip if we're already updating to prevent infinite loop
  const obs = new MutationObserver(()=>{
    if (isUpdating) return;  // CRITICAL: Prevent infinite loop
    
    isUpdating = true;  // Set guard
    syncCollapsedAlias();
    syncOverlayOpenState();
    setTimeout(() => { isUpdating = false; }, 0);  // Release guard
  });
  obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });

  mqOverlay.addEventListener("change", applyMode);

  // Initial
  applyMode();
})();