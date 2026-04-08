import { calculateBudget } from './budgetCalculator.js';
import {
  calCustomDayoffs, calViewYear, calViewMonth, getExcludeWeekends,
} from './calendar.js';
import { state } from './state.js';

export const MODELS = [
  {
    mult: 0.25, costPct: 0.08, label: '0.25×', color: '#1a7f37',
    examples: ['Grok Code Fast 1'], showInToday: false,
  },
  {
    mult: 0.3, costPct: 0.1, label: '0.3×', color: 'var(--accent-hover)',
    examples: ['Claude Haiku 4.5', 'Gemini Flash 3.1', 'GPT-5.2 Mini'], showInToday: true,
  },
  {
    mult: 1, costPct: 0.3, label: '1×', color: 'var(--blue)',
    examples: ['Claude Sonnet 4.5 / 4.6', 'GPT-5.2', 'Gemini 2.5 Pro'], showInToday: true,
  },
  {
    mult: 3, costPct: 1.0, label: '3×', color: 'var(--yellow)',
    examples: ['Claude Opus 4.6', 'GPT-5.1 (older)'], showInToday: true,
  },
];

const MONTH_DAYS = [28, 29, 30, 31];

export function fmt1(n) { return n.toFixed(1); }
export function fmt2(n) { return n.toFixed(2); }
export function fmtInt(n) { return Math.floor(n).toLocaleString(); }

export function barColor(percentage) {
  if (percentage < 60) return 'var(--accent-hover)';
  if (percentage < 80) return 'var(--yellow)';
  return 'var(--red)';
}

export function stepNum(id, delta, min, max) {
  const inputEl = document.getElementById(id);
  const currentDecimals = (String(inputEl.value).split('.')[1] || '').length;
  const rawValue = (parseFloat(inputEl.value) || 0) + delta;
  const decimals = (String(delta).split('.')[1] || '').length;
  const resultDecimals = Math.max(decimals, currentDecimals);
  const clampedValue = Math.min(max, Math.max(min, resultDecimals > 0
    ? parseFloat(rawValue.toFixed(resultDecimals))
    : Math.round(rawValue)));
  inputEl.value = resultDecimals > 0 ? clampedValue.toFixed(resultDecimals) : clampedValue;
  inputEl.dispatchEvent(new Event('input'));
}

export function syncUsage(val) {
  val = parseFloat(parseFloat(val).toFixed(1));
  state.quotaRemaining = null;
  document.getElementById('usageInput').value = fmt1(val);
  document.getElementById('usageDisplay').textContent = fmt1(val) + '%';
  updateStatus();
}

export function syncUsageFromInput(val) {
  val = parseFloat(parseFloat(val || 0).toFixed(1));
  val = Math.min(100, Math.max(0, val));
  state.quotaRemaining = null;
  document.getElementById('usageSlider').value = val;
  document.getElementById('usageDisplay').textContent = fmt1(val) + '%';
  updateStatus();
}

export function updateStatus() {
  const usage         = parseFloat(document.getElementById('usageInput').value) || 0;
  const currentDay    = parseInt(document.getElementById('dayInput').value) || 1;
  const totalDays     = parseInt(document.getElementById('monthLen').value) || 31;
  const excludeWknds  = getExcludeWeekends();
  const requestMode   = document.getElementById('reqModeChk')?.checked || false;

  const r = calculateBudget({
    usage, currentDay, totalDays,
    calViewYear, calViewMonth,
    excludeWeekends: excludeWknds,
    customDayoffs: calCustomDayoffs,
    quotaEntitlement: state.quotaEntitlement,
    quotaRemaining: state.quotaRemaining,
  });

  const entitlement = state.quotaEntitlement || 300;

  // Progress bar
  const bar = document.getElementById('progressBar');
  bar.style.width      = Math.min(100, usage) + '%';
  bar.style.background = barColor(usage);

  if (requestMode) {
    document.getElementById('progressUsed').textContent   = r.usedRequests + ' used';
    document.getElementById('progressRemain').textContent = r.remainingRequests + ' remaining';
  } else {
    document.getElementById('progressUsed').textContent   = fmt2(usage) + '% used';
    document.getElementById('progressRemain').textContent = fmt2(r.remainingPct) + '% remaining';
  }

  document.getElementById('statDaysLeft').textContent = r.displayDaysLeft;

  if (requestMode) {
    document.getElementById('statBudgetLeft').textContent          = r.remainingRequests;
    document.getElementById('statBudgetLeftLabel').textContent     = 'requests remaining';
    document.getElementById('statDailyAllowance').textContent      = r.idealDailyRequests + ' req';
    document.getElementById('statDailyAllowanceLabel').textContent = 'req / day (ideal)';
    document.getElementById('statCurrentPace').textContent         = r.burnRateRequests + ' req';
    document.getElementById('statCurrentPaceLabel').textContent    = 'req / day (current burn)';
  } else {
    document.getElementById('statBudgetLeft').textContent          = fmt2(r.remainingPct) + '%';
    document.getElementById('statBudgetLeftLabel').textContent     = 'quota remaining';
    document.getElementById('statDailyAllowance').textContent      = fmt2(r.idealDailyBudget) + '%';
    document.getElementById('statDailyAllowanceLabel').textContent = '% / day (ideal)';
    document.getElementById('statCurrentPace').textContent         = fmt2(r.burnRate) + '%';
    document.getElementById('statCurrentPaceLabel').textContent    = '% / day (current burn)';
  }

  const perfectTargetEl = document.getElementById('statPerfectTarget');
  perfectTargetEl.textContent = requestMode
    ? (r.perfectTargetRequests + ' req')
    : (fmt2(r.perfectTarget) + '%');
  perfectTargetEl.style.color = 'var(--blue)';

  const vsTargetEl = document.getElementById('statVsTarget');
  vsTargetEl.textContent = requestMode
    ? ((r.vsTargetRequests >= 0 ? '+' : '') + r.vsTargetRequests + ' req')
    : ((r.vsTarget >= 0 ? '+' : '') + fmt2(r.vsTarget) + '%');
  vsTargetEl.style.color = r.vsTarget > 2
    ? 'var(--red)'
    : r.vsTarget > 0 ? 'var(--yellow)' : 'var(--accent-hover)';

  // Pace indicator
  const burnRateDisp = requestMode
    ? `${r.burnRateRequests} req/day`
    : `${fmt2(r.burnRate)}%/day`;
  const idealDisp = requestMode
    ? `${r.idealDailyRequests} req/day`
    : `${fmt2(r.idealDailyBudget)}%/day`;

  const pill = document.getElementById('statusPill');
  const dot  = document.getElementById('paceDot');
  const paceTextEl = document.getElementById('paceText');

  const paceMessages = {
    monthComplete: () => {
      pill.textContent = 'Month Complete';
      pill.className = 'pill';
      dot.style.background = r.remainingPct === 0 ? 'var(--red)' : 'var(--accent-hover)';
      const leftover = requestMode
        ? `${r.remainingRequests} req leftover`
        : `${fmt2(r.remainingPct)}% leftover`;
      paceTextEl.textContent = r.remainingPct === 0
        ? `✕ Quota exhausted — ${fmt2(usage)}% used by end of month.`
        : `✓ Month complete — ${fmt2(usage)}% used, ${leftover}.`;
    },
    noUsage: () => {
      pill.textContent = 'No usage';
      pill.className = 'pill';
      dot.style.background = 'var(--muted)';
      paceTextEl.textContent = 'No usage recorded yet.';
    },
    under: () => {
      pill.textContent = 'Under Budget';
      pill.className = 'pill pill-under';
      dot.style.background = 'var(--accent-hover)';
      paceTextEl.textContent = `✓ Burn rate (${burnRateDisp}) is well below ideal (${idealDisp}). You have headroom.`;
    },
    onTrack: () => {
      pill.textContent = 'On Track';
      pill.className = 'pill pill-on-track';
      dot.style.background = 'var(--blue)';
      paceTextEl.textContent = `✓ Burn rate (${burnRateDisp}) is close to ideal (${idealDisp}). Keep this pace.`;
    },
    slightlyOver: () => {
      pill.textContent = 'Slightly Over';
      pill.className = 'pill pill-slightly-over';
      dot.style.background = 'var(--yellow)';
      paceTextEl.textContent = `⚠ Burn rate (${burnRateDisp}) exceeds ideal (${idealDisp}). Consider shifting to cheaper models.`;
    },
    over: () => {
      pill.textContent = 'Over Budget';
      pill.className = 'pill pill-over';
      dot.style.background = 'var(--red)';
      paceTextEl.textContent = `✕ Burn rate (${burnRateDisp}) significantly exceeds ideal (${idealDisp}). Switch to 0.3× models now.`;
    },
  };
  paceMessages[r.paceStatus]();

  // Projection
  const projEl    = document.getElementById('projectionLine');
  const projColor = r.projected > 100 ? 'var(--red)' : r.projected > 90 ? 'var(--yellow)' : 'var(--accent-hover)';

  // Pre-compute exhaustion label: "~day N (M days remaining)"
  const exhaustionLabel = (() => {
    if (r.burnRate <= 0) return '?';
    const exhaustDay = Math.round(currentDay + (100 - usage) / r.burnRate);
    const daysAfter = Math.max(0, totalDays - exhaustDay);
    const afterText = daysAfter > 0 ? ` (${daysAfter} days remaining)` : '';
    return `~day ${exhaustDay}${afterText}`;
  })();

  if (requestMode) {
    const projUsedReqs = Math.min(entitlement, Math.round(r.projected / 100 * entitlement));
    if (r.projected > 100) {
      projEl.innerHTML = `<span class="proj-value" style="color:${projColor}">${projUsedReqs} req</span> <span class="fs-12 muted">— ⚠ quota exhausted ${exhaustionLabel}</span>`;
    } else {
      projEl.innerHTML = `<span class="proj-value" style="color:${projColor}">${projUsedReqs} req</span> <span class="fs-12 muted">— ${entitlement - projUsedReqs} req leftover</span>`;
    }
  } else {
    const projPct = fmt1(Math.min(r.projected, 100));
    if (r.projected > 100) {
      projEl.innerHTML = `<span class="proj-value" style="color:${projColor}">${projPct}%</span> <span class="fs-12 muted">— ⚠ quota exhausted ${exhaustionLabel}</span>`;
    } else {
      projEl.innerHTML = `<span class="proj-value" style="color:${projColor}">${projPct}%</span> <span class="fs-12 muted">— ${fmt1(100 - r.projected)}% leftover</span>`;
    }
  }

  updateRequestsToday(r.idealDailyBudget);
  updateRemainingRequests(r.remainingPct);
}

export function updateRequestsToday(idealDay) {
  const container = document.getElementById('requestsToday');
  container.innerHTML = MODELS.filter(m => m.showInToday).map(m => {
    const reqs = idealDay / m.costPct;
    return `
      <div class="stat">
        <div class="value" style="color:${m.color}">${fmtInt(reqs)}</div>
        <div class="label">${m.label} models / day<br>
          <span class="muted fs-12">(${m.costPct}% each)</span>
        </div>
      </div>`;
  }).join('');
}

export function updateRemainingRequests(remainingPct) {
  const container = document.getElementById('requestsRemaining');
  if (!container) return;
  container.innerHTML = MODELS.filter(m => m.showInToday).map(m => {
    const reqs = remainingPct / m.costPct;
    return `
      <div class="stat">
        <div class="value" style="color:${m.color}">${fmtInt(reqs)}</div>
        <div class="label">${m.label} models / month<br>
          <span class="muted fs-12">(${m.costPct}% each)</span>
        </div>
      </div>`;
  }).join('');
}

export function renderAllMonths() {
  const tbody = document.getElementById('allMonthsBody');
  tbody.innerHTML = MODELS.map(m => {
    const cells = MONTH_DAYS.map(d => {
      const reqs = (100 / d) / m.costPct;
      return `<td class="fw-600">${fmtInt(reqs)}</td>`;
    }).join('');
    const examples = m.examples.join(', ');
    return `
      <tr>
        <td><strong style="color:${m.color}">${m.label}</strong><br><span class="fs-11 muted">${examples}</span></td>
        <td>${m.costPct}%</td>
        ${cells}
      </tr>`;
  }).join('');
}
