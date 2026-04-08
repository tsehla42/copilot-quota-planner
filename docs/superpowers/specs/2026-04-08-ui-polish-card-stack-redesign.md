# GitHub Copilot Quota Planner — UI Polish & Card Stack Redesign

**Date**: April 8, 2026  
**Status**: Design — Ready for Implementation  
**Scope**: 7 linked issues — card stack viewport-awareness, animation fix, progress bar semantics, spinner order, projection alignment, header consolidation

---

## Issues Addressed

| # | Issue | Severity |
|---|-------|----------|
| 1 | 2-account card overlap — selected and peek end up at same `left` | Bug — UX broken |
| 2 | 4 accounts shows only 3 cards — max peek count hardcoded to 2 | Bug — UX broken |
| 3 | Card count is static — not recalculated after fetch or account add/remove | Bug |
| 4 | Card stack not centered in header | UX issue |
| 5 | Card transitions fire without animation — DOM batch prevents reflow | Bug — UX broken |
| 6 | Progress bar color based on raw % instead of budget status | UX issue |
| 7 | `statBudgetLeft` value ("37.40%") always blue — should match status color | UX issue |
| 8 | ±0.1 spinner left of ±1 — should be right | UX issue |
| 9 | Projection line text not centered; label too small | UX issue |
| 10 | "GitHub Copilot Quota Planner" header separate from accounts label | UX issue |

---

## Bug 1 & 2 & 3: Card Stack — Overlap, Missing 4th Card, Viewport-Awareness

### Root Cause Analysis

**Overlap with 2 accounts:**

```js
const peekCount = Math.min(count - 1, 2);  // = 1 with 2 accounts
const leftPositions = [0, PEEK_OFFSET, peekCount * PEEK_OFFSET];
//                          ^peek-1     ^selected = 1 * 40 = 40px = same as peek-1
```

`slot-1` (peek-1) and `slot-2` (selected) both get `left: 40px` → complete overlap.

**4 accounts shows 3:**

`slotAccounts` has a fixed length of 3. Hardcoded:
```js
const slotAccounts = [
  count >= 3 ? accounts[(selectedIdx + 2) % count] : null,  // peek-2
  count >= 2 ? accounts[(selectedIdx + 1) % count] : null,  // peek-1
  selected,                                                   // always
];
```

Even with 4 accounts, only 3 are ever placed.

**Not recalculated on viewport/account change:**

`PEEK_OFFSET = 40` is a compile-time constant. Maximum visible peeks is capped regardless of available space.

---

### Fix: Viewport-Aware Stack Layout

**File**: `src/js/accounts.js`

#### Constants & helpers

Replace:
```js
const CARD_WIDTH  = 280;
const PEEK_OFFSET = 40;
```

With:
```js
const CARD_WIDTH  = 280;
const PEEK_OFFSET = 60;
const MAX_SLOTS   = 4;        // number of persistent #cardSlot-{0..3} DOM nodes
```

Add helper to compute how many peeks fit in the viewport:

```js
/**
 * Compute the number of peek cards that can sit behind the selected card.
 * @param {number} accountCount
 * @returns {number} 0–MAX_SLOTS-1
 */
function _computeMaxPeeks(accountCount) {
  // Available horizontal space for peek cards to the LEFT of selected
  const viewportWidth = document.getElementById('accountsDynamic')?.parentElement?.offsetWidth
    ?? window.innerWidth;
  // How much horizontal space can peeks occupy without overflowing the parent?
  const spaceForPeeks = Math.floor((viewportWidth - CARD_WIDTH - 40) / PEEK_OFFSET);
  return Math.min(accountCount - 1, MAX_SLOTS - 1, Math.max(0, spaceForPeeks));
}
```

> The `-40` guard gives 20px clearance on each side of the dynamic area inside the header.

#### Slot assignment (back-to-front = slot-0 to slot-N)

**Slot layout** (after fix):

| Slot index | Role when N peeks |
|------------|-------------------|
| 0 | peek-(N-1) — furthest back, most transparent |
| 1 | peek-(N-2) |
| … | … |
| N-1 | peek-0 — closest peek behind selected |
| N | selected (frontmost) |

Left-positions formula:
```js
// slot i → left = i * PEEK_OFFSET
// selected is at slot maxPeeks → left = maxPeeks * PEEK_OFFSET
```

With 2 accounts, `maxPeeks = 1`:
- slot-0 = peek-0 → `left: 0`
- slot-1 = selected → `left: 60px`

With 3 accounts, `maxPeeks = 2`:
- slot-0 = peek-1 (back) → `left: 0`
- slot-1 = peek-0 → `left: 60`
- slot-2 = selected → `left: 120`

With 4 accounts (if viewport allows), `maxPeeks = 3`:
- slot-0 = peek-2 (back) → `left: 0`
- slot-1 = peek-1 → `left: 60`
- slot-2 = peek-0 → `left: 120`
- slot-3 = selected → `left: 180`

#### Stack width

```js
const stackWidth = CARD_WIDTH + maxPeeks * PEEK_OFFSET;
```

#### Recalculate on each render call

`_updateCardSlots()` must call `_computeMaxPeeks(count)` on every invocation, not cache the result.

`renderAccountsHeader()` sets `#accountsDynamic`'s width and rebuilds `_updateCardSlots()` on every call (including after fetch and after account add/remove). The existing `count !== _lastRenderedCount` guard governs only whether the **static zone** is rebuilt, not the slot positions.

---

## Bug 4: Center the Card Stack

**File**: `src/style.css`

The `.accounts-header-body` has `justify-content: space-between`. With a large viewport, the card stack is left-flush while buttons are right-flush. For 1–4 accounts, the stack should be centered within the available space.

**Change**: replace hard-coded `style="width:${stackWidth}px"` on `#accountsDynamic` with a flexbox layout that centers the stack:

In `accounts.js`, set on `#accountsDynamic`:
```js
el.style.width = stackWidth + 'px';
el.style.margin = '0 auto';  // already inside flex — works as auto-margin centering
```

And in `.accounts-header-body`:
```css
.accounts-header-body {
  justify-content: center;  /* was: space-between */
  gap: 24px;
}
```

This centers the stack + static-zone group, with the stack on the left and buttons on the right, both centered as a unit.

---

## Bug 5: Card Animation — Reflow Required

### Root Cause

`_updateCardSlots()` currently removes animation classes, then immediately adds them back in the same synchronous call stack. The browser batches these DOM mutations and never applies the old class state, so the CSS keyframe reset never triggers and no animation plays.

### Fix

**File**: `src/js/accounts.js`

In `_updateCardSlots()`, after removing old animation classes and before adding new ones, force the browser to flush the style update by reading a layout property:

```js
// 1. Remove old animation classes
slot.classList.remove('entering', 'exiting');

// 2. Force reflow — this flushes style recalculation and resets the animation
void slot.offsetWidth;  // eslint-disable-line no-void

// 3. Now add the class — browser sees a genuine class transition
slot.classList.add('entering');
```

The reflow (`void slot.offsetWidth`) forces the CSS engine to compute styles before the next statements run, ensuring the animation state machine starts fresh.

**Order of operations in `_updateCardSlots(animate, prevSelectedId)`**:

1. For each slot that will receive a new card:
   a. Remove `entering`/`exiting` classes
   b. Force reflow
   c. Update `slot.innerHTML`
   d. Update `slot.className` (set role classes)
   e. Force reflow again
   f. If this is the selected slot and `animate === true` → add `entering`
   g. Add `animationend` listener (once) to remove `entering`

2. For old selected slot moving to peek:
   a. Remove `entering`/`exiting`
   b. Force reflow
   c. Add `exiting`
   d. Add `animationend` listener (once) to remove `exiting`

---

## Bug 6 & 7: Progress Bar and Quota Value Color — Status-Driven

### Root Cause

`barColor(percentage)` uses raw usage %:
```js
export function barColor(percentage) {
  if (percentage < 60) return 'var(--accent-hover)';
  if (percentage < 80) return 'var(--yellow)';
  return 'var(--red)';
}
```

This means at 50% usage the bar is green even if you're burning 3× your budget. Conversely, at 75% usage near month-end you'd see yellow even though you're perfectly on track.

**Desired behavior**: color reflects whether the user is over or under budget.

### Fix

**File**: `src/js/uiHelpers.js`

Remove `barColor()` export entirely. In `updateStatus()`, derive the progress bar color directly from `r.paceStatus`:

```js
function _statusColor(paceStatus, remainingPct) {
  switch (paceStatus) {
    case 'under':
    case 'onTrack':
    case 'noUsage':
      return 'var(--accent-hover)';  // green
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

Apply to both:

**Progress bar** (currently `bar.style.background = barColor(usage)`):
```js
const statusColor = _statusColor(r.paceStatus, r.remainingPct);
bar.style.background = statusColor;
```

**`statBudgetLeft` value** (currently hardcoded `.green` class in HTML, or driven by `.blue` in uiHelpers):
```js
document.getElementById('statBudgetLeft').style.color = statusColor;
```

The `statBudgetLeft` element in `index.html` has class `green` set statically. Remove the static class and let `updateStatus()` set `style.color` on every call.

---

## Bug 8: Swap ±0.1 and ±1 Spinner Order

**File**: `src/index.html`

The dual spinner currently shows ±0.1 on the left and ±1 on the right. User wants ±1 on the left (primary) and ±0.1 on the right (fine-tune).

**Current order**:
```html
<div class="num-spin-dual">
  <div class="num-spin-group">
    <div class="spin-label">±0.1</div>
    <button onclick="stepNum('usageInput',0.1,0,100)" title="+0.1%">▲</button>
    <button onclick="stepNum('usageInput',-0.1,0,100)" title="-0.1%">▼</button>
  </div>
  <div class="num-spin-group">
    <div class="spin-label">±1</div>
    <button onclick="stepNum('usageInput',1,0,100)" title="+1%">▲</button>
    <button onclick="stepNum('usageInput',-1,0,100)" title="-1%">▼</button>
  </div>
</div>
```

**New order**: swap the two `.num-spin-group` blocks so ±1 comes first:
```html
<div class="num-spin-dual">
  <div class="num-spin-group">
    <div class="spin-label">±1</div>
    <button onclick="stepNum('usageInput',1,0,100)" title="+1%">▲</button>
    <button onclick="stepNum('usageInput',-1,0,100)" title="-1%">▼</button>
  </div>
  <div class="num-spin-group">
    <div class="spin-label">±0.1</div>
    <button onclick="stepNum('usageInput',0.1,0,100)" title="+0.1%">▲</button>
    <button onclick="stepNum('usageInput',-0.1,0,100)" title="-0.1%">▼</button>
  </div>
</div>
```

---

## Bug 9: Projection Line — Center Text and Larger Label

### Part A: Center the projection value + warning text

**File**: `src/style.css`

The `#projectionLine` container renders as inline content (large `proj-value` + small `muted` suffix). With the combined text shorter than the card width, it appears left-aligned while looking visually unbalanced.

Add `text-align: center` to `#projectionLine`:

```css
#projectionLine {
  text-align: center;
}
```

This centers `"100.0% — ⚠ quota exhausted ~day 13 (17 days remaining)"` as a visual unit.

### Part B: PROJECTED END-OF-MONTH label font size

**File**: `src/index.html`

Current:
```html
<div class="fs-12 muted mb-6">PROJECTED END-OF-MONTH</div>
```

The "Day of month (today)" label is styled as a `<label>` element (14px, uppercase, `var(--muted)`, `letter-spacing: 0.04em`). Match that styling by converting this div to a `<label>`:

```html
<label>PROJECTED END-OF-MONTH</label>
```

This automatically applies the full label styling (14px, uppercase, muted color, letter-spacing) that matches `Day of month (today)`.

---

## Feature: Consolidate Header into Accounts Section

### Intent

Remove the standalone `<header class="site-header">` and integrate the app title into the accounts-header label line. Result: `"GitHub Copilot Quota Planner — 1 account connected"` (or N accounts).

### Part A: Remove `site-header` from HTML

**File**: `src/index.html`

Remove:
```html
<header class="site-header">
  <h1 class="site-header-title">GitHub Copilot Quota Planner</h1>
</header>
```

### Part B: Update accounts label in JS

**File**: `src/js/accounts.js`

In `renderAccountsHeader()`, update the `countLabel` computation:

```js
// Old:
const countLabel = count === 1 ? '1 account connected' : `${count} accounts connected`;

// New:
const accountsText = count === 1 ? '1 account connected' : `${count} accounts connected`;
const countLabel = `GitHub Copilot Quota Planner — ${accountsText}`;
```

For the zero-accounts state, the header body also needs a title. Replace the current zero-accounts prompt with:

```html
<div class="accounts-header-body">
  <div>
    <div class="fw-600 mb-3">GitHub Copilot Quota Planner</div>
    <div class="fs-12 muted">Connect a GitHub token to auto-fetch your quota.</div>
  </div>
  <div>
    <button class="auth-btn auth-btn-primary" onclick="openAccountsModal()">
      ${GITHUB_ICON}
      Connect token
    </button>
  </div>
</div>
```

### Part C: Update `.accounts-label` styling

**File**: `src/style.css`

The current `.accounts-label` is tiny (11px uppercase muted). The combined title line should be more prominent:

```css
.accounts-label {
  font-size: 13px;        /* was: 11px */
  font-weight: 600;
  color: var(--text);     /* was: var(--muted) */
  letter-spacing: 0.01em; /* was: 0.05em uppercase */
  text-transform: none;   /* was: uppercase */
}
```

### Part D: Remove `.site-header` CSS

**File**: `src/style.css`

Remove the `.site-header` and `.site-header-title` blocks (no longer referenced):

```css
/* DELETE: */
.site-header { ... }
.site-header-title { ... }
```

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `src/js/accounts.js` | PEEK_OFFSET 40→60; add `_computeMaxPeeks()`; add 4th DOM slot; fix left-position formula; fix animation with reflow; center stack with `margin:0 auto`; update countLabel to include app title |
| `src/index.html` | Remove `<header class="site-header">`; add 4th cardSlot; swap ±1/±0.1 spinner order; convert PROJECTED div to `<label>` |
| `src/style.css` | `justify-content: center` on `.accounts-header-body`; update `.accounts-label` styling; remove `.site-header` / `.site-header-title`; add `text-align: center` on `#projectionLine` |
| `src/js/uiHelpers.js` | Remove `barColor()`; add `_statusColor(paceStatus, remainingPct)`; apply to progress bar and `statBudgetLeft` color |

---

## Open Questions / Decisions

| Question | Recommended default |
|----------|---------------------|
| What is the minimum viewport width before peeks start hiding? | When `_computeMaxPeeks` returns 0 (window too narrow for even one peek), show only selected card |
| Should the `accounts-header` have a fixed height even with 0 accounts? | Yes — keep `height: 88px` to prevent layout jump |
| Should `statBudgetLeft` class `green` be removed from `index.html`? | Yes — JS now owns the color; static class conflicts |
