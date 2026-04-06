# Refactor to Modular Source with Vite Build — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `index.html` into modular source files under `src/`, add Vite + vite-plugin-singlefile build, add Vitest unit tests, and produce a `dist/index.html` that is functionally identical to the original.

**Architecture:** Source files in `src/` are organized by domain (auth, calendar, budgetCalculator, uiHelpers, main). Vite's singlefile plugin inlines all CSS and JS into `dist/index.html`. The output file is non-minified, fully self-contained, and requires no server to open.

**Tech Stack:** Vite 5, vite-plugin-singlefile, Vitest, vanilla JavaScript (ES2020+), no framework.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/index.html` | HTML skeleton only — no `<style>` or `<script>` blocks; links to `src/js/main.js` |
| Create | `src/style.css` | All CSS extracted from current `index.html` `<style>` block (lines 7–461) |
| Create | `src/js/main.js` | Init, event wiring, `fetchRealUsage()`, `autoFetchOnLoad()`, global state |
| Create | `src/js/auth.js` | `getToken`, `getUser`, `ghHeaders`, `renderAuthCard`, `openAuthModal`, `closeAuthModal`, `signOut`, `_savePAT`, `_verifyAndSave`, `showModalError`, `_patForm`, `_setFetchStatus` |
| Create | `src/js/calendar.js` | `openCalendar`, `closeCalendar`, `renderCalendar`, `renderCalGrid`, `calNavMonth`, `calToggleDay`, `clearCustomDayoffs`, `countEffectiveDayoffs`, `countWeekendsInMonth`, `getExcludeWeekends`, `onWeekendsToggle`, `onCalWeekendsToggle`, `syncDayoffsFromCalendar`; exports `calCustomDayoffs` Set and view state |
| Create | `src/js/budgetCalculator.js` | `calculateBudget(params)` — pure function, no DOM |
| Create | `src/js/uiHelpers.js` | `syncUsage`, `syncUsageFromInput`, `updateStatus`, `updateRequestsToday`, `renderAllMonths`, `stepNum`, `escHtml`, `fmt1`, `fmt2`, `fmtInt`, `barColor` |
| Create | `src/tests/budgetCalculator.test.js` | Unit tests for pure budget math |
| Create | `src/tests/auth.test.js` | Tests for token validation, header construction |
| Create | `src/tests/calendar.test.js` | Tests for weekend counting, dayoff toggle, effective dayoff count |
| Create | `src/tests/uiHelpers.test.js` | Tests for formatters, escHtml, stepNum, syncUsage (DOM mock) |
| Create | `vite.config.js` | Vite config with singlefile plugin, minify disabled |
| Create | `vitest.config.js` | Vitest config with jsdom environment |
| Create | `package.json` | Scripts + devDependencies |
| Create | `.gitignore` | Ignore `dist/`, `node_modules/` |
| Keep   | `index.html` | Original — kept until `dist/index.html` is validated, then removed |

---

## Task 1: Project scaffolding and package setup

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `vitest.config.js`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "copilot-quota-planner",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "vite-plugin-singlefile": "^2.0.1",
    "vitest": "^1.6.0",
    "@vitest/ui": "^1.6.0",
    "jsdom": "^24.1.0"
  }
}
```

- [ ] **Step 2: Create `vite.config.js`**

```js
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    minify: false,
  },
  plugins: [viteSingleFile()],
});
```

- [ ] **Step 3: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/tests/**/*.test.js'],
  },
});
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 5: Install dependencies**

```bash
npm install
```

Expected output: `node_modules/` created, no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json vite.config.js vitest.config.js .gitignore
git commit -m "chore: scaffold Vite + Vitest project"
```

---

## Task 2: Extract CSS to `src/style.css`

**Files:**
- Create: `src/style.css`

All CSS lives inside the `<style>` tag in the current `index.html` between line 7 (`<style>`) and line 461 (`</style>`). This task extracts it verbatim.

- [ ] **Step 1: Create `src/style.css`**

Copy the entire contents of the `<style>` block from `index.html` (everything between `<style>` and `</style>`, not including the tags themselves) into `src/style.css`.

The file begins with:
```css
:root {
  --bg: #0d1117;
  --surface: #161b22;
  --border: #30363d;
  --accent: #238636;
  --accent-hover: #2ea043;
  --blue: #388bfd;
  --yellow: #d29922;
  --red: #da3633;
  --text: #e6edf3;
  --muted: #8b949e;
  --tag-bg: #21262d;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
/* ... (full content) ... */
```

And ends with:
```css
.proj-value { font-size: 22px; font-weight: 700; line-height: 1.5; }
```

- [ ] **Step 2: Commit**

```bash
git add src/style.css
git commit -m "chore: extract CSS to src/style.css"
```

---

## Task 3: Create `src/js/budgetCalculator.js` (pure, no DOM)

**Files:**
- Create: `src/js/budgetCalculator.js`

This module contains **only pure functions** — no `document`, no `localStorage`, no MODELS reference. All DOM-reading is done in `uiHelpers.js` before calling these functions.

- [ ] **Step 1: Create `src/js/budgetCalculator.js`**

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add src/js/budgetCalculator.js
git commit -m "feat: add pure calculateBudget function"
```

---

## Task 4: Write and pass `budgetCalculator.test.js`

**Files:**
- Create: `src/tests/budgetCalculator.test.js`

- [ ] **Step 1: Create `src/tests/budgetCalculator.test.js`**

```js
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
    it('does not divide by zero when 0 working days left but calendar days remain', () => {
      // All remaining days are weekends — fill last 2 days of a 31-day month
      // Feb 2026 has 28 days; last day = 28
      const r = budget({ currentDay: 28, totalDays: 28 });
      expect(() => r).not.toThrow();
      expect(r.idealDailyBudget).toBe(0);
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
```

- [ ] **Step 2: Run tests — expect failure (module not resolvable yet)**

```bash
npm test -- src/tests/budgetCalculator.test.js
```

Expected: tests fail with import error because `src/js/budgetCalculator.js` is not created yet. If the file was created in Task 3, expect test failures due to business logic (not import errors).

- [ ] **Step 3: Run tests after Task 3 is complete — verify they pass**

```bash
npm test -- src/tests/budgetCalculator.test.js
```

Expected output: all tests pass, 0 failures.

- [ ] **Step 4: Commit**

```bash
git add src/tests/budgetCalculator.test.js
git commit -m "test: add budgetCalculator unit tests"
```

---

## Task 5: Create `src/js/auth.js`

**Files:**
- Create: `src/js/auth.js`

- [ ] **Step 1: Create `src/js/auth.js`**

```js
export const GH_API = 'https://api.github.com';
export const GITHUB_ICON = `<svg height="15" viewBox="0 0 16 16" fill="currentColor" style="vertical-align:-2px"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;

export function getToken() { return localStorage.getItem('gh_token'); }
export function getUser()  { return JSON.parse(localStorage.getItem('gh_user') || 'null'); }

export function ghHeaders() {
  return {
    'Authorization': `Bearer ${getToken()}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderAuthCard() {
  const token = getToken();
  const user  = getUser();
  const card  = document.getElementById('authCard');
  if (token && user) {
    card.innerHTML = `
      <div class="d-flex jc-between ai-center flex-wrap gap-10">
        <div class="d-flex ai-center gap-10">
          <img src="${escHtml(user.avatar_url)}" alt="" class="avatar" loading="lazy" />
          <div>
            <div class="fw-600">@${escHtml(user.login)}</div>
            <div class="fs-11 muted">${escHtml(user.name || '')}${user.name ? ' · ' : ''}GitHub token connected</div>
          </div>
        </div>
        <div class="d-flex gap-8 ai-center flex-wrap">
          <button class="auth-btn auth-btn-danger" onclick="signOut()">Sign out</button>
        </div>
      </div>`;
  } else {
    card.innerHTML = `
      <div class="d-flex jc-between ai-center flex-wrap gap-12">
        <div>
          <div class="fw-600 mb-3">Connect GitHub token (optional)</div>
          <div class="fs-12 muted">Add a PAT to verify your plan. Usage % must still be entered manually from <a href="https://github.com/settings/copilot" target="_blank">github.com/settings/copilot</a>.</div>
        </div>
        <div class="d-flex gap-8 flex-wrap">
          <button class="auth-btn auth-btn-primary" onclick="openAuthModal()">${GITHUB_ICON} Connect token</button>
        </div>
      </div>`;
  }
}

export function openAuthModal() {
  document.getElementById('modalContent').innerHTML = _patForm();
  document.getElementById('authModal').classList.add('open');
}

export function closeAuthModal() {
  document.getElementById('authModal').classList.remove('open');
}

export function showModalError(msg) {
  const el = document.getElementById('authModalErr');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

export function _setFetchStatus(msg, color) {
  const el = document.getElementById('fetchStatus');
  if (el) { el.textContent = msg; el.style.color = color; }
}

export function _patForm() {
  return `
    <h3>Connect a GitHub Token</h3>
    <p class="modal-sub">Your token is stored only in this browser's localStorage and sent directly to <code>api.github.com</code> — never to any third party.</p>
    <div id="authModalErr" class="auth-error"></div>
    <div class="info-box">
      <strong>How to get a <code>ghu_</code> token from VS Code</strong><br><br>
      <div class="step-row"><span class="step-num">1</span>
        <div>Press <code>F1</code> → type <strong>Toggle Developer Tools</strong> → Enter → open the <strong>Network</strong> tab</div>
      </div>
      <div class="step-row"><span class="step-num">2</span>
        <div>Type <code>copilot_internal</code> in the filter box, tick <strong>Preserve log</strong></div>
      </div>
      <div class="step-row"><span class="step-num">3</span>
        <div>Open Copilot Chat (<code>Ctrl+Alt+I</code>) and send any message — a <code>user</code> row will appear in the network list</div>
      </div>
      <div class="step-row"><span class="step-num">4</span>
        <div>Click that <code>user</code> row → <strong>Request Headers</strong> → copy the value after <code>Authorization: token </code></div>
      </div>
      <div class="step-row"><span class="step-num">5</span>
        <div>The token starts with <code>ghu_</code> — paste it below</div>
      </div>
    </div>
    <label>Token</label>
    <input type="password" id="inPAT" placeholder="ghx_…" autocomplete="new-password" />
    <div class="modal-row">
      <button class="auth-btn" onclick="closeAuthModal()">Cancel</button>
      <button class="auth-btn auth-btn-primary" onclick="_savePAT()">Connect</button>
    </div>`;
}

export async function _savePAT() {
  const token = document.getElementById('inPAT')?.value.trim();
  if (!token) { showModalError('Please paste a token'); return; }
  if (!/^(ghp_|github_pat_|gho_|ghu_)[A-Za-z0-9_]+$/.test(token)) {
    showModalError('Token format looks invalid — GitHub tokens start with ghp_, github_pat_, gho_, or ghu_'); return;
  }
  try {
    await _verifyAndSave(token);
    closeAuthModal();
    // Caller (main.js) will call fetchRealUsage after this resolves
    window.dispatchEvent(new CustomEvent('auth:connected'));
  } catch (e) {
    showModalError(e.message);
  }
}

export async function _verifyAndSave(token) {
  const res = await fetch(`${GH_API}/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Token is invalid or expired (401)');
    if (res.status === 403) throw new Error('Token is forbidden (403) — check scopes');
    throw new Error(`GitHub API returned ${res.status}`);
  }
  const userData = await res.json();
  localStorage.setItem('gh_token', token);
  localStorage.setItem('gh_user', JSON.stringify({
    login: userData.login,
    name: userData.name || '',
    avatar_url: userData.avatar_url,
  }));
  renderAuthCard();
}

export function signOut() {
  ['gh_token', 'gh_user'].forEach(key => localStorage.removeItem(key));
  renderAuthCard();
  _setFetchStatus('', '');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/js/auth.js
git commit -m "feat: add auth module"
```

---

## Task 6: Write and pass `auth.test.js`

**Files:**
- Create: `src/tests/auth.test.js`

- [ ] **Step 1: Create `src/tests/auth.test.js`**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getToken, getUser, ghHeaders, escHtml, _verifyAndSave, signOut } from '../js/auth.js';

// jsdom provides localStorage
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('getToken', () => {
  it('returns null when not set', () => {
    expect(getToken()).toBeNull();
  });

  it('returns stored token', () => {
    localStorage.setItem('gh_token', 'ghu_testtoken123');
    expect(getToken()).toBe('ghu_testtoken123');
  });
});

describe('getUser', () => {
  it('returns null when not set', () => {
    expect(getUser()).toBeNull();
  });

  it('returns parsed user object', () => {
    const user = { login: 'alice', name: 'Alice', avatar_url: 'https://example.com/avatar.png' };
    localStorage.setItem('gh_user', JSON.stringify(user));
    expect(getUser()).toEqual(user);
  });
});

describe('ghHeaders', () => {
  it('includes Bearer token from localStorage', () => {
    localStorage.setItem('gh_token', 'ghu_abc123');
    const h = ghHeaders();
    expect(h['Authorization']).toBe('Bearer ghu_abc123');
  });

  it('includes Accept header', () => {
    const h = ghHeaders();
    expect(h['Accept']).toBe('application/vnd.github+json');
  });

  it('includes X-GitHub-Api-Version header', () => {
    const h = ghHeaders();
    expect(h['X-GitHub-Api-Version']).toBe('2022-11-28');
  });
});

describe('escHtml', () => {
  it('escapes &', () => expect(escHtml('a&b')).toBe('a&amp;b'));
  it('escapes <', () => expect(escHtml('<tag>')).toBe('&lt;tag&gt;'));
  it('escapes >', () => expect(escHtml('a>b')).toBe('a&gt;b'));
  it('escapes "', () => expect(escHtml('"quote"')).toBe('&quot;quote&quot;'));
  it('passes through plain strings', () => expect(escHtml('hello world')).toBe('hello world'));
  it('converts non-strings to string', () => expect(escHtml(42)).toBe('42'));
});

describe('signOut', () => {
  it('removes gh_token and gh_user from localStorage', () => {
    localStorage.setItem('gh_token', 'ghu_test');
    localStorage.setItem('gh_user', JSON.stringify({ login: 'alice' }));
    // signOut touches DOM — mock getElementById
    document.body.innerHTML = '<div id="authCard"></div><div id="fetchStatus"></div>';
    signOut();
    expect(localStorage.getItem('gh_token')).toBeNull();
    expect(localStorage.getItem('gh_user')).toBeNull();
  });
});

describe('_verifyAndSave', () => {
  it('stores token and user on 200 response', async () => {
    document.body.innerHTML = '<div id="authCard"></div>';
    const mockUser = { login: 'bob', name: 'Bob', avatar_url: 'https://example.com/bob.png' };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockUser),
    })));
    await _verifyAndSave('ghu_faketoken');
    expect(localStorage.getItem('gh_token')).toBe('ghu_faketoken');
    expect(JSON.parse(localStorage.getItem('gh_user')).login).toBe('bob');
  });

  it('throws on 401', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 401 })));
    await expect(_verifyAndSave('ghu_bad')).rejects.toThrow('invalid or expired');
  });

  it('throws on 403', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 403 })));
    await expect(_verifyAndSave('ghu_bad')).rejects.toThrow('forbidden');
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- src/tests/auth.test.js
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/tests/auth.test.js
git commit -m "test: add auth module unit tests"
```

---

## Task 7: Create `src/js/calendar.js`

**Files:**
- Create: `src/js/calendar.js`

- [ ] **Step 1: Create `src/js/calendar.js`**

```js
// ─── Calendar state ───────────────────────────────────────
export let calCustomDayoffs = new Set();
export let calViewYear  = new Date().getFullYear();
export let calViewMonth = new Date().getMonth(); // 0-based

export function setCalView(year, month) {
  calViewYear  = year;
  calViewMonth = month;
}

const CAL_MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const CAL_DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export function getExcludeWeekends() {
  return document.getElementById('excludeWeekendsChk').checked;
}

export function countWeekendsInMonth(totalDays) {
  let count = 0;
  for (let d = 1; d <= totalDays; d++) {
    const dow = new Date(calViewYear, calViewMonth, d).getDay();
    if (dow === 0 || dow === 6) count++;
  }
  return count;
}

export function countEffectiveDayoffs() {
  const excludeWeekends = getExcludeWeekends();
  let count = 0;
  for (const iso of calCustomDayoffs) {
    const d = new Date(iso + 'T00:00:00');
    const dow = d.getDay();
    if (excludeWeekends && (dow === 0 || dow === 6)) continue;
    count++;
  }
  return count;
}

export function openCalendar() {
  document.getElementById('calExcludeWeekendsChk').checked = getExcludeWeekends();
  renderCalendar();
  document.getElementById('calOverlay').classList.add('open');
}

export function closeCalendar() {
  document.getElementById('calOverlay').classList.remove('open');
  syncDayoffsFromCalendar();
  window.dispatchEvent(new CustomEvent('calendar:closed'));
}

export function syncDayoffsFromCalendar() {
  document.getElementById('calDayoffCount').textContent = calCustomDayoffs.size;
}

export function renderCalendar() {
  document.getElementById('calTitle').textContent =
    `${CAL_MONTH_NAMES[calViewMonth]} ${calViewYear}`;
  renderCalGrid();
}

export function renderCalGrid() {
  const excludeWeekends = document.getElementById('calExcludeWeekendsChk').checked;
  const today  = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  const y = calViewYear;
  const m = calViewMonth;
  const daysInMonth  = new Date(y, m + 1, 0).getDate();
  const firstDow     = new Date(y, m, 1).getDay();
  const startOffset  = (firstDow + 6) % 7;

  const grid = document.getElementById('calGrid');
  let html = CAL_DAY_NAMES.map(n => `<div class="cal-day-name">${n}</div>`).join('');

  for (let i = 0; i < startOffset; i++) {
    html += `<div class="cal-cell cal-empty"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(y, m, d).getDay();
    const isWeekend = dow === 0 || dow === 6;
    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isDayoff = calCustomDayoffs.has(iso);
    const isToday  = y === todayY && m === todayM && d === todayD;

    let cls = 'cal-cell';
    if (isToday) cls += ' cal-today';
    if (isDayoff) {
      cls += ' cal-dayoff';
    } else if (isWeekend && excludeWeekends) {
      cls += ' cal-weekend-off';
    } else if (isWeekend) {
      cls += ' cal-weekend';
    }

    const clickable = !(isWeekend && excludeWeekends);
    const onclick = clickable ? `onclick="calToggleDay('${iso}')"` : '';
    html += `<div class="${cls}" ${onclick} title="${iso}">${d}</div>`;
  }

  grid.innerHTML = html;
}

export function calNavMonth(delta) {
  calViewMonth += delta;
  if (calViewMonth < 0)  { calViewMonth = 11; calViewYear--; }
  if (calViewMonth > 11) { calViewMonth = 0;  calViewYear++; }
  renderCalendar();
}

export function calToggleDay(iso) {
  if (calCustomDayoffs.has(iso)) {
    calCustomDayoffs.delete(iso);
  } else {
    calCustomDayoffs.add(iso);
  }
  renderCalGrid();
  document.getElementById('calDayoffCount').textContent = calCustomDayoffs.size;
  window.dispatchEvent(new CustomEvent('calendar:dayoff-changed'));
}

export function clearCustomDayoffs() {
  calCustomDayoffs.clear();
  document.getElementById('calDayoffCount').textContent = '0';
  renderCalGrid();
  window.dispatchEvent(new CustomEvent('calendar:dayoff-changed'));
}

export function onWeekendsToggle() {
  const excludeWeekends = getExcludeWeekends();
  if (excludeWeekends) {
    for (const iso of [...calCustomDayoffs]) {
      const dow = new Date(iso + 'T00:00:00').getDay();
      if (dow === 0 || dow === 6) calCustomDayoffs.delete(iso);
    }
    document.getElementById('calDayoffCount').textContent = calCustomDayoffs.size;
  }
  document.getElementById('calExcludeWeekendsChk').checked = excludeWeekends;
  renderCalGrid();
  window.dispatchEvent(new CustomEvent('calendar:weekends-changed'));
}

export function onCalWeekendsToggle() {
  document.getElementById('excludeWeekendsChk').checked =
    document.getElementById('calExcludeWeekendsChk').checked;
  renderCalGrid();
  window.dispatchEvent(new CustomEvent('calendar:weekends-changed'));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/js/calendar.js
git commit -m "feat: add calendar module"
```

---

## Task 8: Write and pass `calendar.test.js`

**Files:**
- Create: `src/tests/calendar.test.js`

- [ ] **Step 1: Create `src/tests/calendar.test.js`**

```js
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
  clearCustomDayoffs();
  // April 2026 — starts Wednesday
  setCalView(2026, 3);
  setupDom(false);
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
```

- [ ] **Step 2: Run tests**

```bash
npm test -- src/tests/calendar.test.js
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/tests/calendar.test.js
git commit -m "test: add calendar module unit tests"
```

---

## Task 9: Create `src/js/uiHelpers.js`

**Files:**
- Create: `src/js/uiHelpers.js`

This module imports from `budgetCalculator.js` and `calendar.js`. It reads global state (`quotaEntitlement`, `quotaRemaining`) from `main.js` via a shared state object.

- [ ] **Step 1: Create `src/js/uiHelpers.js`**

```js
import { calculateBudget } from './budgetCalculator.js';
import {
  calCustomDayoffs, calViewYear, calViewMonth, getExcludeWeekends,
} from './calendar.js';
import { state } from './main.js';

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
  const rawValue = (parseFloat(inputEl.value) || 0) + delta;
  const decimals = (String(delta).split('.')[1] || '').length;
  const clampedValue = Math.min(max, Math.max(min, decimals > 0
    ? parseFloat(rawValue.toFixed(decimals))
    : rawValue));
  inputEl.value = decimals > 0 ? clampedValue.toFixed(decimals) : clampedValue;
  inputEl.dispatchEvent(new Event('input'));
}

export function syncUsage(val) {
  val = parseFloat(val);
  document.getElementById('usageInput').value = val;
  document.getElementById('usageDisplay').textContent = fmt1(val) + '%';
  updateStatus();
}

export function syncUsageFromInput(val) {
  val = parseFloat(parseFloat(val || 0).toFixed(1));
  val = Math.min(100, Math.max(0, val));
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
      dot.style.background = usage >= 100 ? 'var(--red)' : 'var(--accent-hover)';
      const leftover = requestMode
        ? `${r.remainingRequests} req leftover`
        : `${fmt2(r.remainingPct)}% leftover`;
      paceTextEl.textContent = usage >= 100
        ? `✕ Quota exhausted — ${fmt2(usage)}% used by end of month.`
        : `✓ Month complete — ${fmt2(usage)}% used, ${leftover}.`;
    },
    noUsage: () => {
      pill.textContent = 'No usage';
      dot.style.background = 'var(--muted)';
      paceTextEl.textContent = 'No usage recorded yet.';
    },
    under: () => {
      pill.textContent = 'Under Budget';
      dot.style.background = 'var(--accent-hover)';
      paceTextEl.textContent = `✓ Burn rate (${burnRateDisp}) is well below ideal (${idealDisp}). You have headroom.`;
    },
    onTrack: () => {
      pill.textContent = 'On Track';
      dot.style.background = 'var(--blue)';
      paceTextEl.textContent = `✓ Burn rate (${burnRateDisp}) is close to ideal (${idealDisp}). Keep this pace.`;
    },
    slightlyOver: () => {
      pill.textContent = 'Slightly Over';
      dot.style.background = 'var(--yellow)';
      paceTextEl.textContent = `⚠ Burn rate (${burnRateDisp}) exceeds ideal (${idealDisp}). Consider shifting to cheaper models.`;
    },
    over: () => {
      pill.textContent = 'Over Budget';
      dot.style.background = 'var(--red)';
      paceTextEl.textContent = `✕ Burn rate (${burnRateDisp}) significantly exceeds ideal (${idealDisp}). Switch to 0.3× models now.`;
    },
  };
  paceMessages[r.paceStatus]();

  // Projection
  const projEl    = document.getElementById('projectionLine');
  const projColor = r.projected > 100 ? 'var(--red)' : r.projected > 90 ? 'var(--yellow)' : 'var(--accent-hover)';
  if (requestMode) {
    const projUsedReqs = Math.min(entitlement, Math.round(r.projected / 100 * entitlement));
    if (r.projected > 100) {
      projEl.innerHTML = `<span class="proj-value" style="color:${projColor}">${projUsedReqs} req</span> <span class="fs-12 muted">— ⚠ quota exhausted ~day ${r.burnRate > 0 ? Math.round(currentDay + (100 - usage) / r.burnRate) : '?'}</span>`;
    } else {
      projEl.innerHTML = `<span class="proj-value" style="color:${projColor}">${projUsedReqs} req</span> <span class="fs-12 muted">— ${entitlement - projUsedReqs} req leftover</span>`;
    }
  } else {
    const projPct = fmt1(Math.min(r.projected, 100));
    if (r.projected > 100) {
      projEl.innerHTML = `<span class="proj-value" style="color:${projColor}">${projPct}%</span> <span class="fs-12 muted">— ⚠ quota exhausted ~day ${r.burnRate > 0 ? Math.round(currentDay + (100 - usage) / r.burnRate) : '?'}</span>`;
    } else {
      projEl.innerHTML = `<span class="proj-value" style="color:${projColor}">${projPct}%</span> <span class="fs-12 muted">— ${fmt1(100 - r.projected)}% leftover</span>`;
    }
  }

  updateRequestsToday(r.idealDailyBudget);
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
```

- [ ] **Step 2: Commit**

```bash
git add src/js/uiHelpers.js
git commit -m "feat: add uiHelpers module"
```

---

## Task 10: Write and pass `uiHelpers.test.js`

**Files:**
- Create: `src/tests/uiHelpers.test.js`

Note: `uiHelpers.js` imports `state` from `main.js`. The test mocks `main.js` using `vi.mock`.

- [ ] **Step 1: Create `src/tests/uiHelpers.test.js`**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock main.js state before importing uiHelpers
vi.mock('../js/main.js', () => ({
  state: { quotaEntitlement: 300, quotaRemaining: null },
}));

// Mock calendar.js state
vi.mock('../js/calendar.js', () => ({
  calCustomDayoffs: new Set(),
  calViewYear: 2026,
  calViewMonth: 3,
  getExcludeWeekends: () => false,
}));

import { fmt1, fmt2, fmtInt, barColor, escHtml, stepNum, syncUsage, syncUsageFromInput } from '../js/uiHelpers.js';

describe('fmt1', () => {
  it('formats to 1 decimal place', () => expect(fmt1(3.14159)).toBe('3.1'));
  it('rounds correctly', () => expect(fmt1(3.15)).toBe('3.2'));
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

describe('escHtml', () => {
  it('escapes &', () => expect(escHtml('a&b')).toBe('a&amp;b'));
  it('escapes <', () => expect(escHtml('<b>')).toBe('&lt;b&gt;'));
  it('escapes "', () => expect(escHtml('"x"')).toBe('&quot;x&quot;'));
  it('does not escape safe chars', () => expect(escHtml('hello 123')).toBe('hello 123'));
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

describe('syncUsage', () => {
  beforeEach(() => {
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
  });

  it('updates usageDisplay with 1 decimal', () => {
    syncUsage(33.378);
    expect(document.getElementById('usageDisplay').textContent).toBe('33.4%');
  });

  it('updates usageInput value', () => {
    syncUsage(75);
    expect(document.getElementById('usageInput').value).toBe('75');
  });
});

describe('syncUsageFromInput', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input type="range" id="usageSlider" value="50" />
      <input type="number" id="usageInput" value="50" />
      <span id="usageDisplay">50.0%</span>
      <input type="number" id="dayInput" value="15" />
      <select id="monthLen"><option value="30" selected>30</option></select>
      <input type="checkbox" id="excludeWeekendsChk" />
      <input type="checkbox" id="reqModeChk" />
      <div id="progressBar" style="width:50%"></div>
      <span id="progressUsed"></span><span id="progressRemain"></span>
      <span id="statDaysLeft"></span><span id="statBudgetLeft"></span>
      <span id="statBudgetLeftLabel"></span><span id="statDailyAllowance"></span>
      <span id="statDailyAllowanceLabel"></span><span id="statCurrentPace"></span>
      <span id="statCurrentPaceLabel"></span><span id="statPerfectTarget"></span>
      <span id="statVsTarget"></span><span id="statusPill"></span>
      <span id="paceDot" style="background:green"></span>
      <span id="paceText"></span><div id="projectionLine"></div>
      <div id="requestsToday"></div>
    `;
  });

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
```

- [ ] **Step 2: Run tests**

```bash
npm test -- src/tests/uiHelpers.test.js
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/tests/uiHelpers.test.js
git commit -m "test: add uiHelpers unit tests"
```

---

## Task 11: Create `src/js/main.js`

**Files:**
- Create: `src/js/main.js`

This module owns global state and orchestrates startup. Its `state` export is imported by `uiHelpers.js` to read quota values.

- [ ] **Step 1: Create `src/js/main.js`**

```js
import {
  getToken, renderAuthCard, openAuthModal, closeAuthModal,
  signOut, _savePAT, _setFetchStatus, ghHeaders, escHtml, GH_API,
} from './auth.js';
import {
  openCalendar, closeCalendar, calNavMonth, calToggleDay, clearCustomDayoffs,
  onWeekendsToggle, onCalWeekendsToggle, setCalView, calCustomDayoffs,
} from './calendar.js';
import { syncUsage, syncUsageFromInput, updateStatus, renderAllMonths, stepNum } from './uiHelpers.js';
import { fmt1 } from './uiHelpers.js';

// ─── Shared mutable state (read by uiHelpers via import) ──
export const state = {
  quotaEntitlement: 300,
  quotaRemaining:   null,
};

// ─── Expose functions to inline HTML event handlers ───────
// (Vite builds with iife or es — these must be on window for onclick="…")
Object.assign(window, {
  syncUsage, syncUsageFromInput, updateStatus, stepNum,
  openCalendar, closeCalendar, calNavMonth, calToggleDay, clearCustomDayoffs,
  onWeekendsToggle, onCalWeekendsToggle,
  openAuthModal, closeAuthModal, signOut, _savePAT,
  fetchRealUsage, onMonthLenChange,
});

// ─── API fetch ─────────────────────────────────────────────
const LONG_MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

export async function fetchRealUsage() {
  const token = getToken();
  if (!token) {
    _setFetchStatus('No token — click "Connect token" above', 'var(--muted)');
    openAuthModal();
    return;
  }

  const btn = document.getElementById('fetchBtn');
  btn.disabled = true;
  btn.textContent = 'Fetching…';
  _setFetchStatus('⏳ Fetching quota from GitHub…', 'var(--blue)');

  try {
    const res = await fetch(`${GH_API}/copilot_internal/user`, {
      headers: { ...ghHeaders(), 'X-GitHub-Api-Version': '2025-04-01' },
    });

    if (res.status === 404 || res.status === 403) {
      const userRes = await fetch(`${GH_API}/user`, { headers: ghHeaders() });
      if (!userRes.ok) throw new Error(`Token invalid (${userRes.status}). Sign out and reconnect.`);
      const fallbackUser = await userRes.json();
      _setFetchStatus(
        `✓ Token valid for @${escHtml(fallbackUser.login)} · Real quota % needs a ghu_ OAuth token — see "Connect token" ↑ for step-by-step instructions`,
        'var(--blue)',
      );
      return;
    }

    if (!res.ok) {
      if (res.status === 401) throw new Error('Token invalid or expired (401). Sign out and reconnect.');
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

async function autoFetchOnLoad() {
  if (!getToken()) return;
  try { await fetchRealUsage(); } catch (_) { /* silent */ }
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

  // Close popups on Escape
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('calOverlay').classList.contains('open')) closeCalendar();
    if (document.getElementById('authModal').classList.contains('open')) closeAuthModal();
  });

  // React to calendar changes that trigger status update
  window.addEventListener('calendar:closed', updateStatus);
  window.addEventListener('calendar:dayoff-changed', updateStatus);
  window.addEventListener('calendar:weekends-changed', updateStatus);

  // After auth connects, fetch real usage
  window.addEventListener('auth:connected', fetchRealUsage);

  renderAllMonths();
  updateStatus();
  renderAuthCard();
  autoFetchOnLoad();
});
```

- [ ] **Step 2: Commit**

```bash
git add src/js/main.js
git commit -m "feat: add main.js entry point and orchestration"
```

---

## Task 12: Create `src/index.html` (HTML template)

**Files:**
- Create: `src/index.html`

This is the HTML structure from the current `index.html`, with all `<style>` content replaced by a CSS link and all `<script>` content replaced by a module script import.

- [ ] **Step 1: Create `src/index.html`**

Copy `index.html` verbatim, then:
1. Remove the entire `<style>…</style>` block and replace with:
   ```html
   <link rel="stylesheet" href="./style.css" />
   ```
2. Remove the entire `<script>…</script>` block and replace with:
   ```html
   <script type="module" src="./js/main.js"></script>
   ```
3. Remove all `onclick="…"` attributes that reference functions now on `window` — keep them, because `main.js` assigns them to `window` explicitly. No changes needed to HTML event handlers.

The `<head>` should look like:
```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GitHub Copilot Quota Planner</title>
  <link rel="stylesheet" href="./style.css" />
</head>
```

The bottom of `<body>` should look like:
```html
  <script type="module" src="./js/main.js"></script>
</body>
```

- [ ] **Step 2: Commit**

```bash
git add src/index.html
git commit -m "feat: add src/index.html HTML template"
```

---

## Task 13: Dev server smoke test

**Files:** None created — validation only.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Expected output:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

- [ ] **Step 2: Open browser at `http://localhost:5173/`**

Manually verify:
- Page loads without console errors
- Usage slider moves and updates all stats
- "Fetch" button shows auth modal when no token
- Calendar opens and day toggling works
- "Show as requests" toggle switches display mode
- Month length selector changes projections
- All stat cards update on input change

- [ ] **Step 3: Stop dev server**

Press `Ctrl+C` in terminal.

- [ ] **Step 4: Commit** (no new files — nothing to commit if no fixups needed)

If fixups were made during smoke test, commit them:
```bash
git add -A
git commit -m "fix: resolve dev server startup issues"
```

---

## Task 14: Production build and validation

**Files:**
- Created by build: `dist/index.html`

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected output:
```
dist/index.html  XX kB
```

No errors expected. Build should complete in under 5 seconds.

- [ ] **Step 2: Open `dist/index.html` directly in browser**

```bash
# Linux
xdg-open dist/index.html
# macOS
open dist/index.html
```

Verify:
- File opens directly (no server)
- All features work identically to dev server
- No 404s in browser console
- CSS and JS are inlined (inspect source — no `<link>` or `<script src>` tags)
- Output is **not minified** (JS/CSS readable in source view)

- [ ] **Step 3: Diff feature parity against original `index.html`**

With original `index.html` open in a second tab, verify all features are present:
- [ ] Usage slider + fetch button
- [ ] Auth card (signed out state) + "Connect token" modal
- [ ] Calendar popup with day toggle and weekend exclusion
- [ ] "Show as requests" toggle
- [ ] All 6 stat blocks (days left, quota remaining, ideal daily, burn rate, perfect target, vs target)
- [ ] Pace indicator pill + message
- [ ] Projection line
- [ ] "Requests You Can Make Today" grid (3 models)
- [ ] "Model Request Budget" reference table (4 rows)

- [ ] **Step 4: Commit**

```bash
git add dist/index.html
git commit -m "build: add production dist/index.html"
```

---

## Task 15: Run full test suite and cleanup

**Files:**
- Delete: `index.html` (original monolith — now superseded by `dist/index.html`)

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected:
```
 ✓ src/tests/budgetCalculator.test.js (N tests)
 ✓ src/tests/auth.test.js (N tests)
 ✓ src/tests/calendar.test.js (N tests)
 ✓ src/tests/uiHelpers.test.js (N tests)

 Test Files  4 passed (4)
 Tests       XX passed (XX)
```

Zero failures.

- [ ] **Step 2: Remove the original monolith `index.html`**

> ⚠️ Only do this after `dist/index.html` passes the manual feature parity check in Task 14.

```bash
git rm index.html
git commit -m "chore: remove original monolithic index.html (superseded by src/ + dist/)"
```

- [ ] **Step 3: Final commit message summary**

```bash
git log --oneline -15
```

Expected output showing the task commits in order:
```
chore: remove original monolithic index.html
build: add production dist/index.html
feat: add src/index.html HTML template
feat: add main.js entry point and orchestration
test: add uiHelpers unit tests
feat: add uiHelpers module
test: add calendar module unit tests
feat: add calendar module
test: add auth module unit tests
feat: add auth module
test: add budgetCalculator unit tests
feat: add pure calculateBudget function
chore: extract CSS to src/style.css
chore: scaffold Vite + Vitest project
```

---

## Self-Review

### Spec Coverage Check

| Spec Section | Covered by Task |
|---|---|
| Split into `src/` directory | Tasks 2, 3, 5, 7, 9, 11, 12 |
| Vite + vite-plugin-singlefile build | Task 1 |
| Non-minified output | Task 1 (`minify: false`) |
| `npm run dev` HMR | Task 1, validated Task 13 |
| `npm run build` → `dist/index.html` | Task 14 |
| `npm run test` | Task 15 |
| `auth.js` exports | Task 5 |
| `calendar.js` exports | Task 7 |
| `budgetCalculator.js` pure exports | Task 3 |
| `uiHelpers.js` exports | Task 9 |
| `main.js` orchestration | Task 11 |
| `budgetCalculator.test.js` | Task 4 |
| `auth.test.js` | Task 6 |
| `calendar.test.js` | Task 8 |
| `uiHelpers.test.js` | Task 10 |
| Feature parity validation | Task 14 Step 3 |
| `.gitignore` for `dist/`, `node_modules/` | Task 1 |

### Circular Import Risk

`uiHelpers.js` imports from `main.js` (for `state`). `main.js` imports from `uiHelpers.js`. This is a **circular dependency**. To resolve this cleanly, `state` is defined in `main.js` and exported; because ES module live bindings resolve after the module graph is fully loaded, this works at runtime — but **only if no code in `uiHelpers.js` runs at module load time** (i.e., no top-level calls to `updateStatus()`). All functions in `uiHelpers.js` are definitions only; the actual calls happen after DOMContentLoaded in `main.js`. This is safe.

If Vite warns about circular imports during build, move `state` into a dedicated `src/js/state.js` file and import it from both `main.js` and `uiHelpers.js`.

### Placeholder Scan

No placeholders found — all steps have complete code, exact commands, and expected outputs.

### Type Consistency

- `calculateBudget` parameter `p.customDayoffs` is a `Set` — calendar module exports `calCustomDayoffs` which is a `Set`. ✅
- `state.quotaEntitlement` default `300`, `state.quotaRemaining` default `null` — matches original behavior. ✅
- `setCalView(year, month)` is called in `main.js` `DOMContentLoaded` and in `calendar.test.js` `beforeEach`. Signature matches definition. ✅
- `paceStatus` string literals in `calculateBudget` (`'under'`, `'onTrack'`, etc.) match keys in `paceMessages` object in `uiHelpers.js`. ✅
