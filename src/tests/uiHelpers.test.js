import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock state.js before importing uiHelpers
vi.mock('../js/state.js', () => ({
  state: { quotaEntitlement: 300, quotaRemaining: null },
}));

// Mock calendar.js state
vi.mock('../js/calendar.js', () => ({
  calCustomDayoffs: new Set(),
  calViewYear: 2026,
  calViewMonth: 3,
  getExcludeWeekends: () => false,
}));

import { fmt1, fmt2, fmtInt, barColor, stepNum, syncUsage, syncUsageFromInput } from '../js/uiHelpers.js';

describe('fmt1', () => {
  it('formats to 1 decimal place', () => expect(fmt1(3.14159)).toBe('3.1'));
  it('rounds correctly', () => expect(fmt1(3.16)).toBe('3.2'));
  it('handles 0', () => expect(fmt1(0)).toBe('0.0'));
  it('handles integers', () => expect(fmt1(50)).toBe('50.0'));
});

describe('fmt2', () => {
  it('formats to 2 decimal places', () => expect(fmt2(3.14159)).toBe('3.14'));
  it('handles 0', () => expect(fmt2(0)).toBe('0.00'));
});

describe('fmtInt', () => {
  it('floors and formats with locale separators', () => {
    expect(fmtInt(1234.9)).toBe('1,234');
  });
  it('handles 0', () => expect(fmtInt(0)).toBe('0'));
  it('handles large numbers', () => {
    const result = fmtInt(1000);
    expect(result).toBe('1,000');
  });
});

describe('barColor', () => {
  it('green for < 60%', () => expect(barColor(59)).toBe('var(--accent-hover)'));
  it('yellow for 60–79%', () => expect(barColor(70)).toBe('var(--yellow)'));
  it('red for >= 80%', () => expect(barColor(80)).toBe('var(--red)'));
  it('red for 100%', () => expect(barColor(100)).toBe('var(--red)'));
});

describe('stepNum', () => {
  beforeEach(() => {
    document.body.innerHTML = '<input type="number" id="testInput" value="5" />';
  });

  it('increments by delta', () => {
    stepNum('testInput', 1, 0, 10);
    expect(document.getElementById('testInput').value).toBe('6');
  });

  it('decrements by delta', () => {
    stepNum('testInput', -1, 0, 10);
    expect(document.getElementById('testInput').value).toBe('4');
  });

  it('clamps to max', () => {
    stepNum('testInput', 100, 0, 10);
    expect(document.getElementById('testInput').value).toBe('10');
  });

  it('clamps to min', () => {
    stepNum('testInput', -100, 0, 10);
    expect(document.getElementById('testInput').value).toBe('0');
  });

  it('preserves decimal precision for fractional delta', () => {
    document.getElementById('testInput').value = '5.0';
    stepNum('testInput', 0.1, 0, 100);
    expect(document.getElementById('testInput').value).toBe('5.1');
  });
});

// Minimal DOM fixture for syncUsage/syncUsageFromInput
function buildStatusDom() {
  document.body.innerHTML = `
    <input type="range" id="usageSlider" value="50" />
    <input type="number" id="usageInput" value="50" />
    <span id="usageDisplay">50.0%</span>
    <input type="number" id="dayInput" value="15" />
    <select id="monthLen"><option value="30" selected>30</option></select>
    <input type="checkbox" id="excludeWeekendsChk" />
    <input type="checkbox" id="reqModeChk" />
    <div id="progressBar" style="width:50%"></div>
    <span id="progressUsed"></span>
    <span id="progressRemain"></span>
    <span id="statDaysLeft"></span>
    <span id="statBudgetLeft"></span>
    <span id="statBudgetLeftLabel"></span>
    <span id="statDailyAllowance"></span>
    <span id="statDailyAllowanceLabel"></span>
    <span id="statCurrentPace"></span>
    <span id="statCurrentPaceLabel"></span>
    <span id="statPerfectTarget"></span>
    <span id="statVsTarget"></span>
    <span id="statusPill"></span>
    <span id="paceDot" style="background:green"></span>
    <span id="paceText"></span>
    <div id="projectionLine"></div>
    <div id="requestsToday"></div>
  `;
}

describe('syncUsage', () => {
  beforeEach(buildStatusDom);

  it('updates usageDisplay with 1 decimal', () => {
    syncUsage(33.378);
    expect(document.getElementById('usageDisplay').textContent).toBe('33.4%');
  });

  it('updates usageInput value', () => {
    syncUsage(75);
    expect(document.getElementById('usageInput').value).toBe('75.0');
  });
});

describe('syncUsageFromInput', () => {
  beforeEach(buildStatusDom);

  it('clamps input above 100 to 100', () => {
    syncUsageFromInput(150);
    expect(document.getElementById('usageSlider').value).toBe('100');
  });

  it('clamps input below 0 to 0', () => {
    syncUsageFromInput(-10);
    expect(document.getElementById('usageSlider').value).toBe('0');
  });

  it('updates usageDisplay', () => {
    syncUsageFromInput(42.567);
    expect(document.getElementById('usageDisplay').textContent).toBe('42.6%');
  });
});
