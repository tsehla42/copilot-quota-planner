export const S = {
  // Stat labels — % mode
  QUOTA_REMAINING:     'quota remaining',
  PCT_PER_DAY_IDEAL:   '% / day (ideal)',
  PCT_PER_DAY_BURN:    '% / day (current burn)',

  // Stat labels — request mode
  REQS_REMAINING:      'requests remaining',
  REQ_PER_DAY_IDEAL:   'req / day (ideal)',
  REQ_PER_DAY_BURN:    'req / day (current burn)',

  // Status pills
  PILL_MONTH_COMPLETE: 'Month Complete',
  PILL_NO_USAGE:       'No usage',
  PILL_UNDER_BUDGET:   'Under Budget',
  PILL_ON_TRACK:       'On Track',
  PILL_SLIGHTLY_OVER:  'Slightly Over',
  PILL_OVER_BUDGET:    'Over Budget',

  // Tooltips — stat cards (injected at page load by main.js)
  TIP_DAYS_LEFT:       'How many usable days remain in this billing month based on the current calendar settings.\n\nCalculated as the remaining calendar days, or the remaining working days after weekend and custom-day exclusions are applied.',
  TIP_BUDGET_LEFT:     'How much quota is still available right now from your current usage input or the last GitHub fetch.\n\nCalculated as the remaining percentage of the monthly quota, and converted to request counts when request mode is enabled.',
  TIP_DAILY_ALLOWANCE: 'How much quota you can still spend per remaining working day and finish the month on budget.\n\nCalculated as remaining quota / remaining usable days after weekend and custom-day exclusions.',
  TIP_CURRENT_PACE:    'Your actual day-by-day burn rate so far in the current month.\n\nCalculated as quota used so far divided by the working days already elapsed.',
  TIP_PERFECT_TARGET:  'The even-pace usage target for today if quota were consumed uniformly across the full month.\n\nCalculated as 100 × current day / total days in the month.',
  TIP_VS_TARGET:       'How far ahead of or behind the even-pace target you are right now.\n\nCalculated as current usage minus the perfect pace target; negative means you are under target.',

  // Tooltips — dynamic cards (used inline in HTML generation)
  TIP_REQS_TODAY:      'Estimated number of requests you can still make today for this model tier while staying on pace.\n\nCalculated as the ideal daily allowance / this model tier\'s per-request cost percentage.',
  TIP_REQS_REMAINING:  'Estimated number of requests still available this month for this model tier.\n\nCalculated as the remaining quota percentage / per-request cost percentage.',
};
