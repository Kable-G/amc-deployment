/* ============================================================
   AutoMediaCenter - sidebar-builder.js
   Dynamic Role-Based Sidebar Builder
   ============================================================ */

import { getUserRole, hasRole, protectPage } from "./auth.js";

/**
 * Define the sidebar structure for each role tier.
 * Pages below a user's access level won't be shown.
 */
const sidebarConfig = [
  {
    section: "Core",
    required: "media_user",
    items: [
      { label: "AutoMediaCenter", href: "automediacenter.html", icon: "fas fa-newspaper" },
      { label: "AutoMediaRadar", href: "newradarfe.html", icon: "fas fa-satellite-dish" },
      { label: "AutoMediaLive", href: "automedialive.html", icon: "fas fa-video" },
      { label: "AutoMediaVault", href: "automediavault.html", icon: "fas fa-lock" },
    ],
  },
  {
    section: "Management",
    required: "client_user",
    items: [
      { label: "Upload Dashboard", href: "AssetDBmenu1.6.html", icon: "fas fa-upload" },
      { label: "Manage Releases", href: "manage_releases.html", icon: "fas fa-folder-open" },
      { label: "Radar History", href: "radar_history.html", icon: "fas fa-history" },
      { label: "Manage Live Events", href: "manage_live.html", icon: "fas fa-flag-checkered" },
      { label: "Manage Vault Assets", href: "manage_vault.html", icon: "fas fa-lock" },
    ],
  },
  {
    section: "Analytics",
    required: "client_admin",
    items: [
      { label: "AMC Analytics", href: "amc-analytics.html", icon: "fas fa-chart-bar" },
      { label: "Radar Analytics", href: "radar_analytics.html", icon: "fas fa-chart-line" },
      { label: "Live Analytics", href: "live_analytics.html", icon: "fas fa-chart-area" },
      { label: "Vault Analytics", href: "vault_analytics.html", icon: "fas fa-chart-bar" },
    ],
  },
  {
    section: "Admin",
    required: "platform_admin",
    items: [
      { label: "User Management", href: "user_management.html", icon: "fas fa-users" },
      { label: "Client Management", href: "client_management.html", icon: "fas fa-building" },
      { label: "Access Control", href: "access_control.html", icon: "fas fa-shield-alt" },
      { label: "System Settings", href: "system_settings.html", icon: "fas fa-cogs" },
    ],
  },
];

/**
 * Build sidebar DOM dynamically based on user role.
 */
export function buildSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) {
    console.error("[sidebar-builder.js] Sidebar container #sidebar not found.");
    return;
  }

  const role = getUserRole();
  console.log(`[sidebar-builder.js] Building sidebar for role: ${role}`);

  // Clear any existing content
  sidebar.innerHTML = "";
  
  // Add hamburger header first
  const sidebarHeader = document.createElement("div");
  sidebarHeader.className = "sidebar-header";
  sidebarHeader.innerHTML = `
    <button id="sidebarToggle" type="button" aria-label="Toggle sidebar" data-tooltip="Toggle Sidebar" title="Toggle Sidebar">
      <span class="hamburger"></span>
    </button>
  `;
  sidebar.appendChild(sidebarHeader);

  sidebarConfig.forEach(section => {
    if (hasRole(section.required)) {
      const sectionDiv = document.createElement("div");
      sectionDiv.className = "sidebar-section";

      const header = document.createElement("h4");
      header.textContent = section.section;
      header.className = "sidebar-section-header";
      sectionDiv.appendChild(header);

      const list = document.createElement("ul");
      list.className = "sidebar-list";

      section.items.forEach(item => {
        const li = document.createElement("li");
        li.className = "sidebar-item";

        const link = document.createElement("a");
        link.href = item.href;
        link.className = "sidebar-link";
        
        // Create the content as a simple string that will be processed by the wrapper script
        // The wrapper script expects "icon label" format and will split it properly
        if (item.icon.startsWith("fas ")) {
          // For FontAwesome icons, we need to create the HTML structure directly
          link.innerHTML = `<i class="${item.icon}"></i> ${item.label}`;
        } else {
          // For emoji icons, use text content
          link.textContent = `${item.icon} ${item.label}`;
        }

        // Highlight active page
        if (window.location.pathname.endsWith(item.href)) {
          link.classList.add("active");
        }

        li.appendChild(link);
        list.appendChild(li);
      });

      sectionDiv.appendChild(list);
      sidebar.appendChild(sectionDiv);
    }
  });

  console.log("[sidebar-builder.js] Sidebar build complete.");
}

/**
 * Initialise sidebar builder
 * Call this at DOMContentLoaded or after login validation
 */
document.addEventListener("DOMContentLoaded", () => {
  protectPage(); // ensures user is logged in
  buildSidebar();
});