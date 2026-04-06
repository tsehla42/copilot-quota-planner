import {
  getSelectedToken, ghHeaders, renderAccountsHeader,
  openAccountsModal, closeAccountsModal, signOutAllAndRender,
  _addTokenField, _submitTokens, navigateAccount, removeAccountAndRender,
  migrateFromLegacy, updateAccountQuota, getSelectedAccount, showToast,
  getAccounts, saveSelectedId,
} from './accounts.js';
import { escHtml, GH_API, _setFetchStatus } from './auth.js';
import {
  openCalendar, closeCalendar, calNavMonth, calToggleDay, clearCustomDayoffs,
  onWeekendsToggle, onCalWeekendsToggle, setCalView,
} from './calendar.js';
import { syncUsage, syncUsageFromInput, updateStatus, renderAllMonths, stepNum, fmt1 } from './uiHelpers.js';
import { state } from './state.js';

// ─── Expose functions to inline HTML event handlers ───────
Object.assign(window, {
  syncUsage, syncUsageFromInput, updateStatus, stepNum,
  openCalendar, closeCalendar, calNavMonth, calToggleDay, clearCustomDayoffs,
  onWeekendsToggle, onCalWeekendsToggle,
  openAccountsModal, closeAccountsModal, signOutAllAndRender,
  _addTokenField, _submitTokens, navigateAccount, removeAccountAndRender,
  fetchRealUsage, onMonthLenChange,
});

// ─── API fetch ─────────────────────────────────────────────
const LONG_MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

export async function fetchRealUsage() {
  const token = getSelectedToken();
  if (!token) {
    _setFetchStatus('No token — click "Connect token" above', 'var(--muted)');
    openAccountsModal();
    return;
  }

  const btn = document.getElementById('fetchBtn');
  btn.disabled = true;
  btn.textContent = 'Fetching…';
  _setFetchStatus('⏳ Fetching quota from GitHub…', 'var(--blue)');

  const account = getSelectedAccount();

  try {
    const res = await fetch(`${GH_API}/copilot_internal/user`, {
      headers: { ...ghHeaders(), 'X-GitHub-Api-Version': '2025-04-01' },
    });

    if (res.status === 404 || res.status === 403) {
      const userRes = await fetch(`${GH_API}/user`, { headers: ghHeaders() });
      if (!userRes.ok) throw new Error(`Token invalid (${userRes.status}). Remove this account and reconnect.`);
      const fallbackUser = await userRes.json();
      _setFetchStatus(
        `✓ Token valid for @${escHtml(fallbackUser.login)} · Real quota % needs a ghu_ OAuth token`,
        'var(--blue)',
      );
      return;
    }

    if (!res.ok) {
      if (res.status === 401) throw new Error('Token invalid or expired (401). Remove this account and reconnect.');
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
      if (account) {
        updateAccountQuota(account.id, {
          pctUsed,
          entitlement: pi.entitlement,
          remaining: pi.remaining,
          resetDate: data.quota_reset_date,
          unlimited: !!pi.unlimited,
          timestamp: Math.floor(Date.now() / 1000),
        }, plan || null);
        renderAccountsHeader();
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
      if (account) {
        updateAccountQuota(account.id, {
          pctUsed, entitlement: chat.entitlement, remaining: chat.remaining,
          resetDate: data.quota_reset_date, unlimited: false,
          timestamp: Math.floor(Date.now() / 1000),
        }, plan || null);
        renderAccountsHeader();
      }
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

  // Migrate legacy gh_token / gh_user keys if present
  migrateFromLegacy();

  // Close popups on Escape
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('calOverlay').classList.contains('open')) closeCalendar();
    if (document.getElementById('authModal').classList.contains('open')) closeAccountsModal();
  });

  // React to calendar changes
  window.addEventListener('calendar:closed', updateStatus);
  window.addEventListener('calendar:dayoff-changed', updateStatus);
  window.addEventListener('calendar:weekends-changed', updateStatus);

  // Switch account: load cached quota into calculator, then refresh in background
  window.addEventListener('account:switch-requested', async (e) => {
    const { id } = e.detail;
    const accounts = getAccounts();
    const target = accounts.find(a => a.id === id);
    if (!target) return;

    // Update selection
    saveSelectedId(id);
    renderAccountsHeader();

    // Load cached quota immediately
    if (target.lastQuota) {
      const q = target.lastQuota;
      state.quotaEntitlement = q.entitlement ?? state.quotaEntitlement;
      state.quotaRemaining   = q.remaining ?? null;
      document.getElementById('usageInput').value  = q.pctUsed.toFixed(1);
      document.getElementById('usageSlider').value = q.pctUsed;
      syncUsage(q.pctUsed);
    }

    // Fetch fresh in background (errors are displayed via _setFetchStatus in fetchRealUsage)
    await fetchRealUsage().catch(() => {});
  });

  // After adding new accounts, fetch for the newly selected one
  window.addEventListener('account:switched', fetchRealUsage);

  // After sign out, reset calculator to defaults
  window.addEventListener('account:signed-out', () => {
    state.quotaEntitlement = 300;
    state.quotaRemaining   = null;
    _setFetchStatus('', '');
    updateStatus();
  });

  renderAllMonths();
  updateStatus();
  renderAccountsHeader();
  // Auto-fetch on load (silent) if token saved
  fetchRealUsage().catch(() => {});
});
