import { describe, it, expect, beforeEach } from 'vitest';
import {
  calCustomDayoffs, calToggleDay, clearCustomDayoffs,
  countWeekendsInMonth, countEffectiveDayoffs,
  setCalView, calNavMonth, closeCalendar, openCalendar,
} from '../js/calendar.js';

// DOM setup for functions that read checkboxes
function setupDom(excludeWeekends = false) {
  document.body.innerHTML = `
    <input type="checkbox" id="excludeWeekendsChk" ${excludeWeekends ? 'checked' : ''} />
    <input type="checkbox" id="calExcludeWeekendsChk" ${excludeWeekends ? 'checked' : ''} />
    <span id="calDayoffCount">0</span>
    <div id="calGrid"></div>
    <span id="calTitle"></span>
    <div id="calOverlay" class="cal-overlay"></div>
    <select id="monthLen">
      <option value="28">28 days</option>
      <option value="29">29 days</option>
      <option value="30">30 days</option>
      <option value="31" selected>31 days</option>
    </select>
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

describe('closeCalendar syncs monthLen', () => {
  beforeEach(() => {
    setupDom(false);
    setCalView(2026, 3); // April = 30 days
    clearCustomDayoffs();
  });

  it('updates monthLen to 30 when calendar closes on April', () => {
    closeCalendar();
    expect(document.getElementById('monthLen').value).toBe('30');
  });

  it('updates monthLen to 31 when calendar closes on May', () => {
    calNavMonth(1); // navigate to May
    closeCalendar();
    expect(document.getElementById('monthLen').value).toBe('31');
  });
});

describe('per-month day-off tracking', () => {
  beforeEach(() => {
    setupDom(false);
    setCalView(2026, 3); // April
    clearCustomDayoffs();
  });

  it('navigating to next month shows empty day-offs', () => {
    calToggleDay('2026-04-10');
    openCalendar();
    calNavMonth(1); // go to May
    expect(calCustomDayoffs.has('2026-04-10')).toBe(false);
    expect(calCustomDayoffs.size).toBe(0);
  });

  it('navigating back to original month restores day-offs', () => {
    calToggleDay('2026-04-10');
    openCalendar();
    calNavMonth(1);  // April → May
    calNavMonth(-1); // May → April
    expect(calCustomDayoffs.has('2026-04-10')).toBe(true);
  });

  it('closing on different month leaves day-offs cleared for original month next open', () => {
    calToggleDay('2026-04-10');
    openCalendar();
    calNavMonth(1); // navigate to May
    closeCalendar(); // close on May — April's days are gone
    // Re-open on May (calViewMonth is now May=4)
    openCalendar();
    calNavMonth(-1); // navigate back to April
    // April's dayoffs from before are gone (map was cleared on closeCalendar)
    expect(calCustomDayoffs.has('2026-04-10')).toBe(false);
  });
});
