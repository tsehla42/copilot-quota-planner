import { describe, it, expect, beforeEach } from 'vitest';
import {
  calCustomDayoffs, calToggleDay, clearCustomDayoffs,
  countWeekendsInMonth, countEffectiveDayoffs,
  setCalView,
} from '../js/calendar.js';

// DOM setup for functions that read checkboxes
function setupDom(excludeWeekends = false) {
  document.body.innerHTML = `
    <input type="checkbox" id="excludeWeekendsChk" ${excludeWeekends ? 'checked' : ''} />
    <input type="checkbox" id="calExcludeWeekendsChk" ${excludeWeekends ? 'checked' : ''} />
    <span id="calDayoffCount">0</span>
    <div id="calGrid"></div>
    <span id="calTitle"></span>
  `;
}

beforeEach(() => {
  // April 2026 — starts Wednesday
  setupDom(false);
  setCalView(2026, 3);
  clearCustomDayoffs();
});

describe('countWeekendsInMonth', () => {
  it('April 2026 (30 days) has correct weekend count', () => {
    // April 1 = Wed; weekends fall on 4,5,11,12,18,19,25,26 → 8 weekend days
    setCalView(2026, 3);
    expect(countWeekendsInMonth(30)).toBe(8);
  });

  it('February 2026 (28 days starting Sunday) has correct weekend count', () => {
    // Feb 1 2026 = Sunday → 1,7,8,14,15,21,22,28 → 8 weekend days
    setCalView(2026, 1);
    expect(countWeekendsInMonth(28)).toBe(8);
  });
});

describe('calToggleDay', () => {
  it('adds ISO string to calCustomDayoffs', () => {
    calToggleDay('2026-04-16');
    expect(calCustomDayoffs.has('2026-04-16')).toBe(true);
  });

  it('removes ISO string on second toggle', () => {
    calToggleDay('2026-04-16');
    calToggleDay('2026-04-16');
    expect(calCustomDayoffs.has('2026-04-16')).toBe(false);
  });

  it('updates calDayoffCount DOM element', () => {
    calToggleDay('2026-04-20');
    expect(document.getElementById('calDayoffCount').textContent).toBe('1');
  });
});

describe('clearCustomDayoffs', () => {
  it('empties calCustomDayoffs', () => {
    calToggleDay('2026-04-10');
    calToggleDay('2026-04-11');
    clearCustomDayoffs();
    expect(calCustomDayoffs.size).toBe(0);
  });

  it('resets DOM calDayoffCount to 0', () => {
    calToggleDay('2026-04-10');
    clearCustomDayoffs();
    expect(document.getElementById('calDayoffCount').textContent).toBe('0');
  });
});

describe('countEffectiveDayoffs', () => {
  it('counts all dayoffs when weekends not excluded', () => {
    setupDom(false);
    calToggleDay('2026-04-06'); // Monday
    calToggleDay('2026-04-07'); // Tuesday
    expect(countEffectiveDayoffs()).toBe(2);
  });

  it('does not double-count weekend dayoffs when weekends excluded', () => {
    setupDom(true); // excludeWeekends = true
    calToggleDay('2026-04-05'); // Sunday — should not count
    calToggleDay('2026-04-06'); // Monday — should count
    expect(countEffectiveDayoffs()).toBe(1);
  });

  it('returns 0 when no dayoffs set', () => {
    expect(countEffectiveDayoffs()).toBe(0);
  });
});
