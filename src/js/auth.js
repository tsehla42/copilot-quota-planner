export const GH_API = 'https://api.github.com';

export function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function _setFetchStatus(msg, color) {
  const el = document.getElementById('fetchStatus');
  if (el) { el.textContent = msg; el.style.color = color; }
}
