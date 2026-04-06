import {
  getToken, renderAuthCard, openAuthModal, closeAuthModal,
  signOut, _savePAT, _setFetchStatus, ghHeaders, escHtml, GH_API,
} from './auth.js';
import {
  openCalendar, closeCalendar, calNavMonth, calToggleDay, clearCustomDayoffs,
  onWeekendsToggle, onCalWeekendsToggle, setCalView,
} from './calendar.js';
import { syncUsage, syncUsageFromInput, updateStatus, renderAllMonths, stepNum, fmt1 } from './uiHelpers.js';
import { state } from './state.js';

// ─── Expose functions to inline HTML event handlers ───────
// Vite bundles ES modules, so onclick="fn()" attrs need functions on window.
Object.assign(window, {
  syncUsage, syncUsageFromInput, updateStatus, stepNum,
  openCalendar, closeCalendar, calNavMonth, calToggleDay, clearCustomDayoffs,
  onWeekendsToggle, onCalWeekendsToggle,
  openAuthModal, closeAuthModal, signOut, _savePAT,
  fetchRealUsage, onMonthLenChange,
});

// ─── API fetch ─────────────────────────────────────────────
const LONG_MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

export async function fetchRealUsage() {
  const token = getToken();
  if (!token) {
    _setFetchStatus('No token — click "Connect token" above', 'var(--muted)');
    openAuthModal();
    return;
  }

  const btn = document.getElementById('fetchBtn');
  btn.disabled = true;
  btn.textContent = 'Fetching…';
  _setFetchStatus('⏳ Fetching quota from GitHub…', 'var(--blue)');

  try {
    const res = await fetch(`${GH_API}/copilot_internal/user`, {
      headers: { ...ghHeaders(), 'X-GitHub-Api-Version': '2025-04-01' },
    });

    if (res.status === 404 || res.status === 403) {
      const userRes = await fetch(`${GH_API}/user`, { headers: ghHeaders() });
      if (!userRes.ok) throw new Error(`Token invalid (${userRes.status}). Sign out and reconnect.`);
      const fallbackUser = await userRes.json();
      _setFetchStatus(
        `✓ Token valid for @${escHtml(fallbackUser.login)} · Real quota % needs a ghu_ OAuth token — see "Connect token" ↑ for step-by-step instructions`,
        'var(--blue)',
      );
      return;
    }

    if (!res.ok) {
      if (res.status === 401) throw new Error('Token invalid or expired (401). Sign out and reconnect.');
      throw new Error(`copilot_internal/user returned ${res.status}`);
    }

    const data      = await res.json();
    const snapshots = data.quota_snapshots;
    const d         = new Date(data.quota_reset_date);
    const resetDate = data.quota_reset_date
      ? `${String(d.getDate()).padStart(2,'0')} ${LONG_MONTHS[d.getMonth()]} ${d.getFullYear()}`
      : '';
    const plan = data.copilot_plan || '';

    if (snapshots?.premium_interactions) {
      const pi      = snapshots.premium_interactions;
      const pctUsed = 100 - pi.percent_remaining;
      if (!pi.unlimited && pi.entitlement) {
        state.quotaEntitlement = pi.entitlement;
        state.quotaRemaining   = pi.remaining ?? null;
      }
      document.getElementById('usageInput').value  = pctUsed.toFixed(1);
      document.getElementById('usageSlider').value = pctUsed;
      syncUsage(pctUsed);
      const extra = [
        plan ? `${plan} plan` : '',
        pi.unlimited ? 'unlimited' : `${pi.remaining}/${pi.entitlement} req remaining`,
        resetDate ? `resets ${resetDate}` : '',
      ].filter(Boolean).join(' · ');
      _setFetchStatus(`✓ ${fmt1(pctUsed)}% used · ${extra}`, 'var(--accent-hover)');
    } else if (snapshots?.chat) {
      const chat    = snapshots.chat;
      const pctUsed = 100 - chat.percent_remaining;
      document.getElementById('usageInput').value  = pctUsed.toFixed(1);
      document.getElementById('usageSlider').value = pctUsed;
      syncUsage(pctUsed);
      _setFetchStatus(
        `✓ ${fmt1(pctUsed)}% chat quota used · ${chat.remaining}/${chat.entitlement} remaining · free plan`,
        'var(--accent-hover)',
      );
    } else {
      const orgLogin = data.organization_login_list?.[0] || '';
      _setFetchStatus(
        `✓ Connected${orgLogin ? ` via ${escHtml(orgLogin)}` : ''} · ${plan} plan · quota_snapshots not present — enter usage % manually`,
        'var(--blue)',
      );
    }
  } catch (e) {
    console.error('fetchRealUsage:', e);
    _setFetchStatus(`✗ ${e.message}`, 'var(--red)');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Fetch';
  }
}

async function autoFetchOnLoad() {
  if (!getToken()) return;
  try { await fetchRealUsage(); } catch (_) { /* silent */ }
}

function onMonthLenChange() {
  updateStatus();
}

// ─── Initialization ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Set today's date
  const now = new Date();
  document.getElementById('dayInput').value = now.getDate();
  setCalView(now.getFullYear(), now.getMonth());

  // Select correct month length
  const daysInCurMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const sel = document.getElementById('monthLen');
  for (let i = 0; i < sel.options.length; i++) {
    if (parseInt(sel.options[i].value) === daysInCurMonth) { sel.options[i].selected = true; break; }
  }

  // Close popups on Escape
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('calOverlay').classList.contains('open')) closeCalendar();
    if (document.getElementById('authModal').classList.contains('open')) closeAuthModal();
  });

  // React to calendar changes
  window.addEventListener('calendar:closed', updateStatus);
  window.addEventListener('calendar:dayoff-changed', updateStatus);
  window.addEventListener('calendar:weekends-changed', updateStatus);

  // After auth connects, fetch quota
  window.addEventListener('auth:connected', fetchRealUsage);

  renderAllMonths();
  updateStatus();
  renderAuthCard();
  autoFetchOnLoad();
});
