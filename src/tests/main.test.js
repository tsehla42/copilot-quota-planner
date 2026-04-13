import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { syncDayoffsFromCalendar, calCustomDayoffs } = vi.hoisted(() => ({
  syncDayoffsFromCalendar: vi.fn(),
  calCustomDayoffs: new Set(),
}));

vi.mock('../js/accounts.js', () => ({
  getSelectedToken: vi.fn(() => null),
  ghHeaders: vi.fn(() => ({})),
  renderAccountsHeader: vi.fn(),
  openAccountsModal: vi.fn(),
  closeAccountsModal: vi.fn(),
  signOutAllAndRender: vi.fn(),
  _addTokenField: vi.fn(),
  _submitTokens: vi.fn(),
  navigateAccount: vi.fn(),
  removeAccountAndRender: vi.fn(),
  updateAccountQuota: vi.fn(),
  getSelectedAccount: vi.fn(() => null),
  showToast: vi.fn(),
  getAccounts: vi.fn(() => []),
  saveSelectedId: vi.fn(),
  toggleHeader: vi.fn(),
  initHeaderCollapsed: vi.fn(),
}));

vi.mock('../js/auth.js', () => ({
  escHtml: vi.fn((value) => value),
  GH_API: 'https://api.github.com',
  _setFetchStatus: vi.fn(),
}));

vi.mock('../js/icons.js', () => ({
  CALENDAR_ICON: '<svg></svg>',
  TRASHCAN_ICON: '<svg></svg>',
  QUESTION_MARK_ICON: '<svg></svg>',
}));

vi.mock('../js/calendar.js', () => ({
  openCalendar: vi.fn(),
  closeCalendar: vi.fn(),
  calNavMonth: vi.fn(),
  calToggleDay: vi.fn(),
  clearCustomDayoffs: vi.fn(),
  onWeekendsToggle: vi.fn(),
  onCalWeekendsToggle: vi.fn(),
  setCalView: vi.fn(),
  calCustomDayoffs,
  syncDayoffsFromCalendar,
}));

vi.mock('../js/uiHelpers.js', () => ({
  syncUsage: vi.fn(),
  syncUsageFromInput: vi.fn(),
  updateStatus: vi.fn(),
  renderAllMonths: vi.fn(),
  stepNum: vi.fn(),
  fmt1: vi.fn((value) => Number(value).toFixed(1)),
}));

vi.mock('../js/state.js', () => ({
  state: { quotaEntitlement: 300, quotaRemaining: null },
}));

import { S } from '../js/strings.js';
import { initTooltipText, openMonthPicker, restoreCustomDayoffs } from '../js/main.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('openMonthPicker', () => {
  beforeEach(() => {
    document.body.innerHTML = '<select id="monthLen"></select>';
  });

  it('uses showPicker when available', () => {
    const select = document.getElementById('monthLen');
    select.showPicker = vi.fn();
    select.focus = vi.fn();

    openMonthPicker();

    expect(select.showPicker).toHaveBeenCalledTimes(1);
    expect(select.focus).not.toHaveBeenCalled();
  });

  it('falls back to focus when showPicker throws', () => {
    const select = document.getElementById('monthLen');
    select.showPicker = vi.fn(() => {
      throw new DOMException('Not allowed');
    });
    select.focus = vi.fn();

    openMonthPicker();

    expect(select.focus).toHaveBeenCalledTimes(1);
  });
});

describe('initTooltipText', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="stat">
        <span class="stat-info"><span class="stat-tooltip"></span></span>
        <div id="statDaysLeft"></div>
      </div>
      <div class="stat">
        <span class="stat-info"><span class="stat-tooltip"></span></span>
        <div id="statVsTarget"></div>
      </div>
    `;
  });

  it('injects centralized tooltip text into stat cards', () => {
    initTooltipText();

    const tooltips = Array.from(document.querySelectorAll('.stat-tooltip')).map((node) => node.textContent);
    expect(tooltips).toEqual([S.TIP_DAYS_LEFT, S.TIP_VS_TARGET]);
  });
});

describe('restoreCustomDayoffs', () => {
  beforeEach(() => {
    document.body.innerHTML = '<span id="calDayoffCount">0</span>';
    localStorage.clear();
    calCustomDayoffs.clear();
    syncDayoffsFromCalendar.mockReset();
  });

  it('restores saved day-offs for the current month and syncs the label', () => {
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

    localStorage.setItem('cal_dayoffs_month', todayKey);
    localStorage.setItem('cal_dayoffs', JSON.stringify(['2026-04-03', '2026-04-08']));

    restoreCustomDayoffs();

    expect([...calCustomDayoffs]).toEqual(['2026-04-03', '2026-04-08']);
    expect(syncDayoffsFromCalendar).toHaveBeenCalledTimes(1);
  });
});

describe('month length button accessibility', () => {
  it('gives the custom arrow button a readable accessible name', () => {
    const htmlPath = path.resolve(__dirname, '../index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(html).toContain('aria-label="Open month length options"');
  });
});