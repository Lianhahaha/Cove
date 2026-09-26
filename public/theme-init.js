// Applies the saved theme before first paint so there's no flash of the wrong one.
// Kept as a file (not inline) so the Content-Security-Policy can forbid inline scripts.
try {
  var t = localStorage.getItem('cove-theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (e) {}
