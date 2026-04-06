import { describe, it, expect } from 'vitest';
import { calculateBudget } from '../js/budgetCalculator.js';

// Helpers
const noWeekends = false;
const withWeekends = true;
const noDayoffs = new Set();
// April 2026: starts Wednesday (0-indexed month = 3)
const APR = { calViewYear: 2026, calViewMonth: 3, totalDays: 30 };

function budget(overrides) {
  return calculateBudget({
    usage: 50,
    currentDay: 15,
    totalDays: 30,
    calViewYear: 2026,
    calViewMonth: 3,
    excludeWeekends: noWeekends,
    customDayoffs: noDayoffs,
    quotaEntitlement: 300,
    quotaRemaining: null,
    ...overrides,
  });
}

describe('calculateBudget', () => {
  describe('basic outputs', () => {
    it('remainingPct = 100 - usage', () => {
      expect(budget({ usage: 60 }).remainingPct).toBe(40);
    });

    it('remainingPct clamps to 0 when usage > 100', () => {
      expect(budget({ usage: 110 }).remainingPct).toBe(0);
    });

    it('calendarDaysLeft = totalDays - currentDay', () => {
      expect(budget({ currentDay: 10, totalDays: 30 }).calendarDaysLeft).toBe(20);
    });

    it('calendarDaysLeft = 0 on last day', () => {
      expect(budget({ currentDay: 30, totalDays: 30 }).calendarDaysLeft).toBe(0);
    });
  });

  describe('perfectTarget', () => {
    it('is 0% on day 0 / day 1 edge', () => {
      // day 1 of 30 = 100 * 1/30 ≈ 3.33
      const r = budget({ currentDay: 1, usage: 0 });
      expect(r.perfectTarget).toBeCloseTo(100 / 30, 5);
    });

    it('is 50% at midpoint', () => {
      const r = budget({ currentDay: 15, totalDays: 30, usage: 0 });
      expect(r.perfectTarget).toBeCloseTo(50, 5);
    });

    it('is 100% on last day', () => {
      const r = budget({ currentDay: 30, totalDays: 30 });
      expect(r.perfectTarget).toBeCloseTo(100, 5);
    });
  });

  describe('vsTarget', () => {
    it('is positive when over pace (used more than target)', () => {
      // usage 60 at day 15 of 30: target = 50, vsTarget = +10
      const r = budget({ usage: 60, currentDay: 15, totalDays: 30 });
      expect(r.vsTarget).toBeCloseTo(10, 5);
    });

    it('is negative when under pace', () => {
      const r = budget({ usage: 30, currentDay: 15, totalDays: 30 });
      expect(r.vsTarget).toBeCloseTo(-20, 5);
    });
  });

  describe('burnRate', () => {
    it('is usage / currentDay', () => {
      const r = budget({ usage: 30, currentDay: 10 });
      expect(r.burnRate).toBeCloseTo(3, 5);
    });

    it('is 0 when currentDay is 0', () => {
      const r = budget({ usage: 0, currentDay: 0 });
      expect(r.burnRate).toBe(0);
    });
  });

  describe('idealDailyBudget', () => {
    it('equals remainingPct / workingDaysLeft (no weekends)', () => {
      // April 15 (Mon) to April 30: 15 calendar days remaining
      const r = budget({ usage: 50, currentDay: 15, totalDays: 30, excludeWeekends: false });
      expect(r.idealDailyBudget).toBeCloseTo(50 / r.workingDaysLeft, 5);
    });

    it('is 0 when no working days remain', () => {
      // Day = totalDays, no days left
      const r = budget({ currentDay: 30, totalDays: 30 });
      expect(r.idealDailyBudget).toBe(0);
    });
  });

  describe('request counts', () => {
    it('usedRequests derived from usage% * entitlement when quotaRemaining is null', () => {
      const r = budget({ usage: 50, quotaEntitlement: 300, quotaRemaining: null });
      expect(r.usedRequests).toBe(150);
    });

    it('usedRequests = entitlement - quotaRemaining when quotaRemaining is provided', () => {
      const r = budget({ quotaEntitlement: 300, quotaRemaining: 100 });
      expect(r.usedRequests).toBe(200);
      expect(r.remainingRequests).toBe(100);
    });

    it('idealDailyRequests rounds to integer', () => {
      const r = budget({ usage: 50, currentDay: 15, totalDays: 30, quotaEntitlement: 300 });
      expect(Number.isInteger(r.idealDailyRequests)).toBe(true);
    });
  });

  describe('paceStatus', () => {
    it('monthComplete when calendarDaysLeft === 0', () => {
      expect(budget({ currentDay: 30, totalDays: 30 }).paceStatus).toBe('monthComplete');
    });

    it('noUsage when burnRate === 0', () => {
      expect(budget({ usage: 0, currentDay: 5 }).paceStatus).toBe('noUsage');
    });

    it('under when paceRatio < 0.85', () => {
      // burn = 1%/day, ideal much higher → paceRatio << 1
      const r = budget({ usage: 5, currentDay: 5, totalDays: 30 });
      expect(r.paceStatus).toBe('under');
    });

    it('over when paceRatio >= 1.35', () => {
      // 90% used at day 15 of 30
      const r = budget({ usage: 90, currentDay: 15, totalDays: 30 });
      expect(r.paceStatus).toBe('over');
    });
  });

  describe('weekend exclusion', () => {
    it('workingDaysLeft is less than calendarDaysLeft with weekends excluded', () => {
      const withW = budget({ excludeWeekends: true, currentDay: 1, totalDays: 30, ...APR });
      const withoutW = budget({ excludeWeekends: false, currentDay: 1, totalDays: 30, ...APR });
      expect(withW.workingDaysLeft).toBeLessThan(withoutW.workingDaysLeft);
    });

    it('displayDaysLeft equals workingDaysLeft when weekends excluded', () => {
      const r = budget({ excludeWeekends: true });
      expect(r.displayDaysLeft).toBe(r.workingDaysLeft);
    });

    it('displayDaysLeft equals calendarDaysLeft when no exclusions', () => {
      const r = budget({ excludeWeekends: false, customDayoffs: noDayoffs });
      expect(r.displayDaysLeft).toBe(r.calendarDaysLeft);
    });
  });

  describe('custom dayoffs', () => {
    it('reduces workingDaysLeft by 1', () => {
      // Pick a day after currentDay (15) that is not a weekend in April 2026
      // April 16 is Thursday
      const dayoffs = new Set(['2026-04-16']);
      const withDayoff = budget({ customDayoffs: dayoffs, excludeWeekends: false, ...APR, currentDay: 15 });
      const without    = budget({ customDayoffs: noDayoffs, excludeWeekends: false, ...APR, currentDay: 15 });
      expect(withDayoff.workingDaysLeft).toBe(without.workingDaysLeft - 1);
    });

    it('dayoff on a past day does not affect workingDaysLeft', () => {
      const dayoffs = new Set(['2026-04-10']); // day 10 < currentDay 15
      const r = budget({ customDayoffs: dayoffs, ...APR, currentDay: 15 });
      const base = budget({ customDayoffs: noDayoffs, ...APR, currentDay: 15 });
      expect(r.workingDaysLeft).toBe(base.workingDaysLeft);
    });
  });

  describe('edge cases', () => {
    it('does not divide by zero when currentDay equals totalDays', () => {
      const r = budget({ currentDay: 28, totalDays: 28 });
      expect(() => r).not.toThrow();
      expect(r.idealDailyBudget).toBe(0);
    });

    it('displayDaysLeft is 0 when guard fires (all remaining days excluded)', () => {
      // All remaining days after day 28 are excluded via custom dayoffs
      // Day 29 and 30 of April 2026 are Wednesday and Thursday — mark them as dayoffs
      const dayoffs = new Set(['2026-04-29', '2026-04-30']);
      const r = budget({ ...APR, currentDay: 28, totalDays: 30, customDayoffs: dayoffs, excludeWeekends: false });
      expect(r.workingDaysLeft).toBe(0);
      expect(r.displayDaysLeft).toBe(0);
      // idealDailyBudget uses effectiveWorkingDaysLeft=1 guard internally, so it should be > 0
      // (there are still 2 calendar days left, it uses the guard of 1)
      expect(r.idealDailyBudget).toBeGreaterThan(0);
    });

    it('handles 0% usage', () => {
      const r = budget({ usage: 0, currentDay: 1 });
      expect(r.remainingPct).toBe(100);
      expect(r.paceStatus).toBe('noUsage');
    });

    it('handles 100% usage', () => {
      const r = budget({ usage: 100, currentDay: 15 });
      expect(r.remainingPct).toBe(0);
      expect(r.idealDailyBudget).toBe(0);
    });
  });
});
