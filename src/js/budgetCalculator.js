/**
 * calculateBudget — pure quota math, no DOM dependencies.
 *
 * @param {object} p
 * @param {number}  p.usage              - % of quota used (0–100)
 * @param {number}  p.currentDay         - current day of month (1–31)
 * @param {number}  p.totalDays          - total days in current month (28–31)
 * @param {number}  p.calViewYear        - year (e.g. 2026) for day-of-week lookup
 * @param {number}  p.calViewMonth       - 0-based month (0=Jan … 11=Dec)
 * @param {boolean} p.excludeWeekends    - exclude Sat/Sun from working day counts
 * @param {Set}     p.customDayoffs      - Set of ISO strings "YYYY-MM-DD" for custom day-offs
 * @param {number}  p.quotaEntitlement   - total requests in plan (e.g. 300)
 * @param {number|null} p.quotaRemaining - remaining requests from API, or null if not fetched
 * @returns {object} budget metrics
 */
export function calculateBudget(p) {
  const {
    usage, currentDay, totalDays,
    calViewYear, calViewMonth,
    excludeWeekends, customDayoffs,
    quotaEntitlement, quotaRemaining,
  } = p;

  const remainingPct     = Math.max(0, 100 - usage);
  const calendarDaysLeft = Math.max(0, totalDays - currentDay);

  // Working days remaining (days after today)
  let workingDaysLeft = 0;
  for (let d = currentDay + 1; d <= totalDays; d++) {
    const dow = new Date(calViewYear, calViewMonth, d).getDay();
    const iso = isoDate(calViewYear, calViewMonth, d);
    if (excludeWeekends && (dow === 0 || dow === 6)) continue;
    if (customDayoffs.has(iso)) continue;
    workingDaysLeft++;
  }

  // Working days elapsed (days 1 through today inclusive)
  let workingDaysElapsed = 0;
  for (let d = 1; d <= currentDay; d++) {
    const dow = new Date(calViewYear, calViewMonth, d).getDay();
    const iso = isoDate(calViewYear, calViewMonth, d);
    if (excludeWeekends && (dow === 0 || dow === 6)) continue;
    if (customDayoffs.has(iso)) continue;
    workingDaysElapsed++;
  }

  // Guard: if no working days remain but calendar days remain, keep 1 to avoid /0
  const effectiveWorkingDaysLeft = (workingDaysLeft === 0 && calendarDaysLeft > 0) ? 1 : workingDaysLeft;

  const idealDailyBudget = effectiveWorkingDaysLeft > 0
    ? remainingPct / effectiveWorkingDaysLeft
    : 0;
  const burnRate   = currentDay > 0 ? usage / currentDay : 0;
  const projected  = usage + burnRate * calendarDaysLeft;
  const perfectTarget = 100 * currentDay / totalDays;
  const vsTarget   = usage - perfectTarget;

  const entitlement = quotaEntitlement || 300;
  const usedRequests = quotaRemaining !== null
    ? (entitlement - quotaRemaining)
    : Math.round(usage / 100 * entitlement);
  const remainingRequests      = entitlement - usedRequests;
  const idealDailyRequests     = Math.round(idealDailyBudget / 100 * entitlement);
  const burnRateRequests       = +(burnRate / 100 * entitlement).toFixed(1);
  const perfectTargetRequests  = Math.round(perfectTarget / 100 * entitlement);
  const vsTargetRequests       = usedRequests - perfectTargetRequests;

  const paceRatio = idealDailyBudget > 0 ? burnRate / idealDailyBudget : 0;

  let paceStatus; // 'noUsage' | 'monthComplete' | 'under' | 'onTrack' | 'slightlyOver' | 'over'
  if (calendarDaysLeft === 0) {
    paceStatus = 'monthComplete';
  } else if (burnRate === 0) {
    paceStatus = 'noUsage';
  } else if (paceRatio < 0.85) {
    paceStatus = 'under';
  } else if (paceRatio < 1.10) {
    paceStatus = 'onTrack';
  } else if (paceRatio < 1.35) {
    paceStatus = 'slightlyOver';
  } else {
    paceStatus = 'over';
  }

  const displayDaysLeft = (excludeWeekends || customDayoffs.size > 0)
    ? workingDaysLeft
    : calendarDaysLeft;

  return {
    remainingPct,
    calendarDaysLeft,
    workingDaysLeft,
    workingDaysElapsed,
    displayDaysLeft,
    idealDailyBudget,
    burnRate,
    projected,
    perfectTarget,
    vsTarget,
    usedRequests,
    remainingRequests,
    idealDailyRequests,
    burnRateRequests,
    perfectTargetRequests,
    vsTargetRequests,
    paceRatio,
    paceStatus,
  };
}

/** @param {number} y @param {number} m0 @param {number} d */
function isoDate(y, m0, d) {
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
