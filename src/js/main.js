import {
  getSelectedToken, ghHeaders, renderAccountsHeader,
  openAccountsModal, closeAccountsModal, signOutAllAndRender,
  _addTokenField, _submitTokens, navigateAccount, removeAccountAndRender,
  updateAccountQuota, getSelectedAccount, showToast,
  getAccounts, saveSelectedId, toggleHeader, initHeaderCollapsed,
} from './accounts.js';
import { escHtml, GH_API, _setFetchStatus } from './auth.js';
import { CALENDAR_ICON, TRASHCAN_ICON, QUESTION_MARK_ICON } from './icons.js';
import {
  openCalendar, closeCalendar, calNavMonth, calToggleDay, clearCustomDayoffs,
  onWeekendsToggle, onCalWeekendsToggle, setCalView, calCustomDayoffs,
  syncDayoffsFromCalendar,
} from './calendar.js';
import { syncUsage, syncUsageFromInput, updateStatus, renderAllMonths, stepNum, fmt1 } from './uiHelpers.js';
import { state } from './state.js';
import { S } from './strings.js';

// ─── Expose functions to inline HTML event handlers ───────
Object.assign(window, {
  syncUsage, syncUsageFromInput, updateStatus, stepNum,
  openCalendar, closeCalendar, calNavMonth, calToggleDay, clearCustomDayoffs,
  onWeekendsToggle, onCalWeekendsToggle,
  openAccountsModal, closeAccountsModal, signOutAllAndRender,
  _addTokenField, _submitTokens, navigateAccount, removeAccountAndRender,
  fetchRealUsage, onMonthLenChange, toggleHeader, openMonthPicker,
});

// ─── API fetch ─────────────────────────────────────────────
const LONG_MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

export async function fetchRealUsage() {
  const token = getSelectedToken();
  if (!token) {
    _setFetchStatus('No token — click "Connect token" above', 'var(--muted)');
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
        `✓ Token valid for @${escHtml(fallbackUser.login)} · Real quota % needs a gho_ OAuth token`,
        'var(--blue)',
      );
      return;
    }

    if (!res.ok) {
      if (res.status === 401) {
        if (account) updateAccountQuota(account.id, null);
        throw new Error('Token invalid or expired (401). Remove this account and reconnect.');
      }
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

export function onMonthLenChange() {
  updateStatus();
}

export function openMonthPicker() {
  const s = document.getElementById('monthLen');
  if (s.showPicker) {
    try { s.showPicker(); } catch { s.focus(); }
  } else {
    s.focus();
  }
}

// ─── Initialization helpers ────────────────────────────────────────────────

function injectSvgIcons() {
  document.querySelector('.btn-calendar').innerHTML = `${CALENDAR_ICON} Calendar`;
  document.querySelectorAll('.btn-clear').forEach(btn => {
    const label = btn.textContent.trim();
    btn.innerHTML = `${TRASHCAN_ICON} ${label}`;
  });
  document.querySelectorAll('.stat-info').forEach(el => {
    el.insertAdjacentHTML('afterbegin', QUESTION_MARK_ICON);
  });
}

export function initTooltipText() {
  const tooltipMap = {
    statDaysLeft:       S.TIP_DAYS_LEFT,
    statBudgetLeft:     S.TIP_BUDGET_LEFT,
    statDailyAllowance: S.TIP_DAILY_ALLOWANCE,
    statCurrentPace:    S.TIP_CURRENT_PACE,
    statPerfectTarget:  S.TIP_PERFECT_TARGET,
    statVsTarget:       S.TIP_VS_TARGET,
  };
  for (const [id, tip] of Object.entries(tooltipMap)) {
    const el = document.getElementById(id);
    if (!el) continue;
    const tipEl = el.closest('.stat')?.querySelector('.stat-tooltip');
    if (tipEl) tipEl.textContent = tip;
  }
}

function initDateControls() {
  const now = new Date();
  document.getElementById('dayInput').value = now.getDate();
  setCalView(now.getFullYear(), now.getMonth());

  const daysInCurMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const sel = document.getElementById('monthLen');
  for (let i = 0; i < sel.options.length; i++) {
    if (parseInt(sel.options[i].value) === daysInCurMonth) { sel.options[i].selected = true; break; }
  }
}

function bindEscapeKey() {
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('calOverlay').classList.contains('open')) closeCalendar();
    if (document.getElementById('authModal').classList.contains('open')) closeAccountsModal();
  });
}

function bindReqModeToggle() {
  document.getElementById('reqModeChk').addEventListener('change', e => {
    localStorage.setItem('pref_req_mode', e.target.checked ? '1' : '0');
  });
}

function bindCalendarEvents() {
  window.addEventListener('calendar:closed', updateStatus);
  window.addEventListener('calendar:dayoff-changed', updateStatus);
  window.addEventListener('calendar:weekends-changed', updateStatus);
}

function bindAccountEvents() {
  window.addEventListener('account:switch-requested', async (e) => {
    const { id } = e.detail;
    const accounts = getAccounts();
    const target = accounts.find(a => a.id === id);
    if (!target) return;

    saveSelectedId(id);
    renderAccountsHeader();

    if (target.lastQuota) {
      const q = target.lastQuota;
      state.quotaEntitlement = q.entitlement ?? state.quotaEntitlement;
      state.quotaRemaining   = q.remaining ?? null;
      document.getElementById('usageInput').value  = q.pctUsed.toFixed(1);
      document.getElementById('usageSlider').value = q.pctUsed;
      syncUsage(q.pctUsed);
    }

    await fetchRealUsage().catch(() => {});
  });

  window.addEventListener('account:switched', fetchRealUsage);

  window.addEventListener('account:signed-out', () => {
    state.quotaEntitlement = 300;
    state.quotaRemaining   = null;
    document.getElementById('usageInput').value  = '0';
    document.getElementById('usageSlider').value = '0';
    syncUsage(0);
    _setFetchStatus('', '');
  });
}

function restorePreferences() {
  if (localStorage.getItem('pref_exclude_weekends') === '1') {
    document.getElementById('excludeWeekendsChk').checked = true;
    onWeekendsToggle();
  }
  if (localStorage.getItem('pref_req_mode') === '1') {
    document.getElementById('reqModeChk').checked = true;
  }
}

export function restoreCustomDayoffs() {
  const d = new Date();
  const todayKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
  if (localStorage.getItem('cal_dayoffs_month') === todayKey) {
    const saved = localStorage.getItem('cal_dayoffs');
    if (saved) {
      try { JSON.parse(saved).forEach(iso => calCustomDayoffs.add(iso)); } catch { /* ignore */ }
    }
  }
  syncDayoffsFromCalendar();
}

// ─── App entry point ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  injectSvgIcons();
  initTooltipText();
  initDateControls();
  bindEscapeKey();
  bindReqModeToggle();
  bindCalendarEvents();
  bindAccountEvents();
  restorePreferences();
  restoreCustomDayoffs();

  renderAllMonths();
  updateStatus();
  renderAccountsHeader();
  initHeaderCollapsed(); // must run after renderAccountsHeader creates #headerToggleBtn
  fetchRealUsage().catch(() => {});
});
