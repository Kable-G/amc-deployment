// v6.5 shell loader - injects header/sidebar/footer then initializes AMCShell
async function _amcFetchText(url){
  const res = await fetch(url, { cache: 'no-store' });
  if(!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return await res.text();
}

async function loadV65Shell(options = {}){
  const base = options.basePath || './components/shell';
  const cacheBuster = `?v=${Date.now()}`; // Cache busting parameter
  const headerMount = document.getElementById('amcShellHeader');
  const sidebarMount = document.getElementById('amcShellSidebar');
  const footerMount = document.getElementById('amcShellFooter');

  if(!headerMount || !sidebarMount || !footerMount){
    console.warn('Shell mount points missing: #amcShellHeader/#amcShellSidebar/#amcShellFooter');
    return;
  }

  const [headerHtml, sidebarHtml, footerHtml] = await Promise.all([
    _amcFetchText(`${base}/header.html${cacheBuster}`),
    _amcFetchText(`${base}/sidebar.html${cacheBuster}`),
    _amcFetchText(`${base}/footer.html${cacheBuster}`)
  ]);

  headerMount.innerHTML = headerHtml;
  sidebarMount.innerHTML = sidebarHtml;
  footerMount.innerHTML = footerHtml;

  if(window.AMCShell && typeof window.AMCShell.init === 'function'){
    window.AMCShell.init(options);
  }else{
    console.error('AMCShell.init not found. Make sure v6.5-shell.js is loaded before v6.5-shell-loader.js');
  }
}