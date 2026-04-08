# GitHub Copilot Quota Planner — UI Polish & Card Stack Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix card stack overlap, animation, progress bar colors, spinners, projection alignment, and consolidate app header into accounts section.

**Architecture:** Incremental DOM/CSS/JS updates across 3 files. Each task changes one logical component (card layout, colors, UI text).

**Tech Stack:** Vanilla HTML/CSS/JS (no frameworks). Card DOM slots (existing structure), viewport detection (new), animation reflow fix (new), status-driven colors (new).

---

## Context

The app has a multi-account feature with card stacks that show the selected account + peek cards. Current issues:
- 2 accounts: cards overlap (both at same left position)
- 4 accounts: only 3 visible (max peeks hardcoded to 2)
- Animations: cards don't animate (reflow needed to trigger CSS keyframes)
- Progress bar: color based on raw % instead of budget status
- UI: header separate from accounts, projections misaligned, spinner order wrong

Spec: `docs/superpowers/specs/2026-04-08-ui-polish-card-stack-redesign.md`

---

## Task 1: Card Stack — Viewport-Aware Layout & Fix Overlap

**Files:**
- Modify: `src/js/accounts.js` (lines 1–20, add `_computeMaxPeeks()`) 
- Modify: `src/index.html` (add 4th card slot)
- Modify: `src/style.css` (stack centering)

**Scope:** Replace hardcoded `peekCount = 2` with viewport-aware `_computeMaxPeeks()` that calculates max peeks based on available space. Fix left-position formula to prevent card overlap. Ensure 4 slots available in DOM. Center stack in header.

**Acceptance criteria:**
- 2 accounts: selected at 60px, peek at 0px (no overlap)
- 3 accounts: selected at 120px, 2 peeks at 60px & 0px
- 4 accounts: selected at 180px, 3 peeks at 120px, 60px, 0px (if viewport allows)
- All peeks visible without overlapping
- Stack centered horizontally in header

- [ ] **Step 1: Add `_computeMaxPeeks()` function to accounts.js**

```js
function _computeMaxPeeks(accountCount) {
  const viewportWidth = document.getElementById('accountsDynamic')?.parentElement?.offsetWidth
    ?? window.innerWidth;
  const spaceForPeeks = Math.floor((viewportWidth - 280 - 40) / 60);
  return Math.min(accountCount - 1, 3, Math.max(0, spaceForPeeks));
}
```

- [ ] **Step 2: Update `renderAccountsHeader()` to call `_computeMaxPeeks()`**

Update the part where `peekCount` is computed:
```js
const maxPeeks = _computeMaxPeeks(count);
const stackWidth = 280 + maxPeeks * 60;
```

- [ ] **Step 3: Make `_updateCardSlots()` use computed `maxPeeks`**

Pass `maxPeeks` as a parameter to `_updateCardSlots()`:
```js
_updateCardSlots(false, null, maxPeeks);
```

Update slot assignment logic in `_updateCardSlots()` to compute correct left positions based on maxPeeks.

- [ ] **Step 4: Add 4th card slot DOM in index.html**

In `src/index.html`, find the `#cardStack` div and add:
```html
<div class="account-card" id="cardSlot-0"></div>
<div class="account-card" id="cardSlot-1"></div>
<div class="account-card" id="cardSlot-2"></div>
<div class="account-card" id="cardSlot-3"></div>
```

- [ ] **Step 5: Center the card stack in header**

In `style.css`, update `.accounts-header-body` to center via `justify-content: center` and add `margin: 0 auto` to `.accounts-dynamic` via inline `style=` in accounts.js.

- [ ] **Step 6: Run dev server and test**

Open http://localhost:5173 in browser. Add 2, 3, 4 test accounts and verify:
- No overlaps
- All cards visible
- Stack is centered
- Resize window and check peeks update

- [ ] **Step 7: Commit**

```bash
git add src/js/accounts.js src/index.html src/style.css
git commit -m "feat: viewport-aware card stack layout with dynamic peek count"
```

---

## Task 2: Card Animation — Reflow Fix

**Files:**
- Modify: `src/js/accounts.js` (in `_updateCardSlots()`)

**Scope:** Add `void slot.offsetWidth` reflow calls between class removals and additions to force browser to flush style recalculations and trigger CSS animations.

**Acceptance criteria:**
- Cards animate smoothly (250-350ms) when navigating between accounts
- No visual glitches or instant transitions
- Animation cleanup listeners prevent stale classes

- [ ] **Step 1: Update `_updateCardSlots()` animation logic**

Before adding animation classes, insert reflow:
```js
slot.classList.remove('entering', 'exiting');
void slot.offsetWidth;  // Force reflow
slot.classList.add('entering');
```

- [ ] **Step 2: Run dev server, test animation**

Add 2+ accounts. Click navigation arrows (← / →) and verify smooth slide-in animation for selected card.

- [ ] **Step 3: Commit**

```bash
git add src/js/accounts.js
git commit -m "fix: card animation by forcing reflow between class changes"
```

---

## Task 3: Progress Bar & Quota Status Colors

**Files:**
- Modify: `src/js/uiHelpers.js` (remove `barColor()`, add `_statusColor()`)
- Modify: `src/index.html` (remove static `green` class from `statBudgetLeft`)

**Scope:** Drive progress bar and quota value colors from computed `paceStatus` (under/onTrack/slightlyOver/over) instead of raw usage %. Ensure colors match budget status, not percentage alone.

**Acceptance criteria:**
- At 50% usage but 3× burn rate → yellow/red (over budget), not green
- At 75% usage but 0.8× burn rate on month-end → green (under budget)
- Progress bar and `statBudgetLeft` value use same color

- [ ] **Step 1: Remove `barColor()` function from uiHelpers.js**

Delete the function entirely.

- [ ] **Step 2: Add `_statusColor()` helper in uiHelpers.js**

```js
function _statusColor(paceStatus, remainingPct) {
  switch (paceStatus) {
    case 'under':
    case 'onTrack':
    case 'noUsage':
      return 'var(--accent-hover)';
    case 'monthComplete':
      return remainingPct === 0 ? 'var(--red)' : 'var(--accent-hover)';
    case 'slightlyOver':
      return 'var(--yellow)';
    case 'over':
    default:
      return 'var(--red)';
  }
}
```

- [ ] **Step 3: Update `updateStatus()` to apply status-driven color**

Replace:
```js
bar.style.background = barColor(usage);
```

With:
```js
const statusColor = _statusColor(r.paceStatus, r.remainingPct);
bar.style.background = statusColor;
document.getElementById('statBudgetLeft').style.color = statusColor;
```

- [ ] **Step 4: Remove static color class from index.html**

Find `<div class="value green" id="statBudgetLeft">` and remove the `green` class:
```html
<div class="value" id="statBudgetLeft"></div>
```

- [ ] **Step 5: Run dev server and test**

Set usage to 60% with 20 days left (on-track → green). Set usage to 80% with 5 days left (over budget → red). Verify bar and quota value match.

- [ ] **Step 6: Commit**

```bash
git add src/js/uiHelpers.js src/index.html
git commit -m "feat: drive progress bar and quota colors from budget status, not raw %"
```

---

## Task 4: Swap Spinner Order & Projection Label

**Files:**
- Modify: `src/index.html` (swap spinners, convert label to `<label>`)

**Scope:** Move ±1 spinner to the left (primary) and ±0.1 to the right (fine-tune). Convert PROJECTED END-OF-MONTH div to `<label>` for consistent styling with "Day of month (today)".

**Acceptance criteria:**
- ±1 spinner appears on the left, ±0.1 on the right
- Label "PROJECTED END-OF-MONTH" uses 14px uppercase styling consistent with "Day of month (today)"

- [ ] **Step 1: Swap the two `.num-spin-group` blocks**

Find the dual spinner in Current Month Status card and swap order of the two groups so ±1 comes before ±0.1.

- [ ] **Step 2: Convert PROJECTED label to `<label>` tag**

Replace:
```html
<div class="fs-12 muted mb-6">PROJECTED END-OF-MONTH</div>
```

With:
```html
<label>PROJECTED END-OF-MONTH</label>
```

- [ ] **Step 3: Run dev server and verify**

Check that spinner order matches and label styling is consistent with other labels.

- [ ] **Step 4: Commit**

```bash
git add src/index.html
git commit -m "ux: swap spinner order and style projection label consistently"
```

---

## Task 5: Center Projection Text

**Files:**
- Modify: `src/style.css` (add text-align center to projection line)

**Scope:** Center the projection value + exhaustion warning so it appears as a cohesive visual unit rather than left-aligned.

**Acceptance criteria:**
- `#projectionLine` content is centered horizontally
- "100.0% — ⚠ quota exhausted" reads as centered block

- [ ] **Step 1: Add `text-align: center` to `#projectionLine` in CSS**

Add a new CSS rule or update existing:
```css
#projectionLine {
  text-align: center;
}
```

- [ ] **Step 2: Run dev server and verify**

Open browser, check that projection text is centered.

- [ ] **Step 3: Commit**

```bash
git add src/style.css
git commit -m "ux: center projection text vertically"
```

---

## Task 6: Consolidate App Header into Accounts Section

**Files:**
- Modify: `src/index.html` (remove `<header>`, update title in accounts label)
- Modify: `src/js/accounts.js` (update countLabel to include app title)
- Modify: `src/style.css` (remove `.site-header` styles, update `.accounts-label`)

**Scope:** Move "GitHub Copilot Quota Planner" from standalone header into the accounts header label. Remove standalone `<header>` element. Update label styling to be more prominent.

**Acceptance criteria:**
- "GitHub Copilot Quota Planner — 1 account connected" (or N accounts) appears in accounts header
- No redundant header element
- Label styling is consistent and prominent

- [ ] **Step 1: Remove `<header>` element from index.html**

Delete the entire:
```html
<header class="site-header">
  <h1 class="site-header-title">GitHub Copilot Quota Planner</h1>
</header>
```

- [ ] **Step 2: Update accounts.js to include title in countLabel**

In `renderAccountsHeader()`, update:
```js
const accountsText = count === 1 ? '1 account connected' : `${count} accounts connected`;
const countLabel = `GitHub Copilot Quota Planner — ${accountsText}`;
```

Also update zero-accounts state HTML to show the title:
```html
<div class="fw-600 mb-3">GitHub Copilot Quota Planner</div>
```

- [ ] **Step 3: Update `.accounts-label` CSS to be more prominent**

In `style.css`:
```css
.accounts-label {
  font-size: 13px;        /* was: 11px */
  font-weight: 600;
  color: var(--text);     /* was: var(--muted) */
  letter-spacing: 0.01em;
  text-transform: none;
}
```

- [ ] **Step 4: Remove `.site-header` CSS rules**

Delete `.site-header` and `.site-header-title` styles from `style.css`.

- [ ] **Step 5: Run dev server and verify**

Check that:
- No standalone header at top
- Accounts header shows full title + account count
- Title is prominent and readable

- [ ] **Step 6: Commit**

```bash
git add src/index.html src/js/accounts.js src/style.css
git commit -m "feat: consolidate app title into accounts header, remove redundant header element"
```

---

## Files Modified Summary

| File | Tasks |
|------|-------|
| `src/js/accounts.js` | Tasks 1, 2, 6 |
| `src/index.html` | Tasks 1, 3, 4, 6 |
| `src/style.css` | Tasks 1, 3, 5, 6 |
| `src/js/uiHelpers.js` | Task 3 |

---

## Execution Notes

- **Dev server is already running** at http://localhost:5173 with HMR enabled
- **Test manually** after each task by interacting in browser (add accounts, navigate, toggle modes, adjust sliders)
- **Commit after each task** to keep changes atomic
- **No new tests needed** — existing test suite covers changed functions; manual browser testing validates UI

---
