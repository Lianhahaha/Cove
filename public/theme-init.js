// Runs before first paint. Kept as a file (not inline) so the Content-Security-Policy can forbid inline scripts.

// Applies the saved theme so there's no flash of the wrong one.
try {
  var t = localStorage.getItem('cove-theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (e) {}

// iOS zooms the page into any text box smaller than 16px. maximum-scale stops that
// auto-zoom while pinch-zoom keeps working, since iOS ignores it for pinches.
// Other platforms don't auto-zoom and would lose pinch-zoom, so only iOS gets it.
try {
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var vp = document.querySelector('meta[name="viewport"]');
  if (ios && vp) vp.setAttribute('content', vp.getAttribute('content') + ', maximum-scale=1');
} catch (e) {}
