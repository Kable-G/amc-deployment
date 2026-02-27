function openSidebar() {
  document.getElementById("mobileSidebar").classList.add("active");
  document.getElementById("mobileSidebarOverlay").classList.add("active");
}

function closeSidebar() {
  document.getElementById("mobileSidebar").classList.remove("active");
  document.getElementById("mobileSidebarOverlay").classList.remove("active");
}

// Close sidebar when overlay is clicked
document.getElementById("mobileSidebarOverlay").addEventListener("click", closeSidebar);