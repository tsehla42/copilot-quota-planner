# Header Collapse + Card Stack Fixes — Design Spec

**Date:** 2026-04-08  
**Status:** Approved

## Overview

Four independent UI improvements:
1. Collapsible header with floating avatar toggle
2. Fix peek card avatar bug (all cards showing selected account's avatar)
3. Replace opacity-based peek dimming with dark background colors
4. Vertically center peek cards behind the selected card

---

## 1 — Collapsible Header

### Behaviour

**Expanded (default):**
- `#accountsHeader` renders at full height (~88px) as today.
- A `#headerToggleBtn` lives **inside** the header, absolutely positioned at `top: 8px; right: 12px`.
- Button content:
  - **0 accounts**: GitHub icon SVG (same as "Connect token" button, via `GITHUB_ICON` from `auth.js`).
  - **1+ accounts**: Current selected account's avatar (`<img>`, 32px circle).
- Button has a subtle `▼` indicator that appears on hover to hint it is interactive.

**On collapse (click toggle when expanded):**
1. Set `localStorage.setItem('headerCollapsed', 'true')`.
2. Add class `.collapsed` to `#accountsHeader`.
3. Add class `.floating` to `#headerToggleBtn` — moves it to `position: fixed; top: 16px; right: 16px; z-index: 100`.
4. Header animates: `max-height → 0`, `padding → 0`, `opacity → 0` via CSS transition (~0.3s ease).
5. Page content shifts up naturally (header is in-flow).

**State: collapsed:**
- Only `#headerToggleBtn` is visible, floating top-right.
- On click: remove `.collapsed` from header, remove `.floating` from button, header re-expands, content shifts down.
- Set `localStorage.setItem('headerCollapsed', 'false')`.

**On page load:**
- Read `localStorage.getItem('headerCollapsed')`. If `'true'`, immediately apply `.collapsed` + `.floating` without transition (use a `.no-transition` class temporarily removed after one frame).

### CSS

```css
/* Header collapse */
.accounts-header {
  max-height: 120px;  /* big enough to not clip */
  overflow: hidden;
  transition: max-height 0.3s ease, opacity 0.3s ease, padding 0.3s ease;
}
.accounts-header.collapsed {
  max-height: 0;
  padding: 0;
  opacity: 0;
  border-color: transparent;
}
.accounts-header.no-transition {
  transition: none;
}

/* Toggle button */
#headerToggleBtn {
  position: absolute;
  top: 8px;
  right: 12px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--tag-bg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: border-color 0.15s, transform 0.15s;
}
#headerToggleBtn:hover { border-color: var(--blue); }
#headerToggleBtn img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

/* Floating state */
#headerToggleBtn.floating {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 100;
  /* inherit size/style from base rule */
}

/* Expand hint on hover */
#headerToggleBtn::after {
  content: '▼';
  position: absolute;
  font-size: 8px;
  bottom: 2px;
  right: 2px;
  color: var(--muted);
  opacity: 0;
  transition: opacity 0.15s;
}
#headerToggleBtn:hover::after { opacity: 1; }
#headerToggleBtn.floating::after { content: '▲'; }  /* reverse hint when collapsed */
```

### JS changes (`accounts.js`)

- `renderAccountsHeader()`:
  - `position: relative` is added to the `.accounts-header` CSS rule (not in HTML) so `#headerToggleBtn` can use `position: absolute` within it.
  - After building header HTML, inject `#headerToggleBtn` with correct icon (avatar or GitHub icon).
  - Re-render toggle button icon whenever accounts/selection changes (happens automatically since `renderAccountsHeader` is called on every account event).
- Add exported `toggleHeader()` function:
  - Reads/writes `localStorage.headerCollapsed`.
  - Toggles `.collapsed` on `#accountsHeader` and `.floating` on `#headerToggleBtn`.
- Add `initHeaderCollapsed()` called from `main.js` on page load:
  - Reads `localStorage.headerCollapsed`, applies state without animation.

---

## 2 — Avatar Bug Fix

**Bug:** Peek cards show the selected account's avatar instead of their own account's avatar.

**Root cause:** In `_updateCardSlots`, the formula for peek account index:
```js
accounts[(selectedIdx + maxPeeks + 1 - i) % count]
```
When `maxPeeks=1, count=2, i=0, selectedIdx=0`: `(0 + 1 + 1 - 0) % 2 = 0` → resolves to selected account.

**Fix:** Change to:
```js
accounts[(selectedIdx + (maxPeeks - i)) % count]
```
When `maxPeeks=1, count=2, i=0, selectedIdx=0`: `(0 + 1) % 2 = 1` → correct next account.

---

## 3 — Peek Card Styling (Dark Background, No Opacity)

**Remove:** `opacity` from `.account-card.peek-1` and `.account-card.peek-2`.

**Add:** Darker background using `color-mix` (CSS native, no hardcoded hex):

```css
.account-card.peek-1 {
  background: color-mix(in srgb, var(--surface) 55%, var(--bg) 45%);
  border-color: color-mix(in srgb, var(--border) 50%, var(--bg) 50%);
  opacity: 1;  /* explicitly reset */
}

.account-card.peek-2 {
  background: color-mix(in srgb, var(--surface) 20%, var(--bg) 80%);
  border-color: color-mix(in srgb, var(--border) 25%, var(--bg) 75%);
  opacity: 1;
}

/* peek-3 if ever rendered (4+ accounts) */
.account-card.peek-3 {
  background: color-mix(in srgb, var(--surface) 8%, var(--bg) 92%);
  border-color: color-mix(in srgb, var(--border) 12%, var(--bg) 88%);
  opacity: 1;
}
```

Text on peek cards will naturally become harder to read as background darkens — acceptable since they're non-interactive.

---

## 4 — Card Stack Vertical Centering

Peek cards should be vertically centered behind the selected card.

Selected card: `height: 56px; top: 0` (unchanged).
Peek cards get a `top` offset equal to half the height reduction:

```css
.account-card.peek-1 {
  height: 52px;
  top: 2px;   /* (56 - 52) / 2 */
}

.account-card.peek-2 {
  height: 48px;
  top: 4px;   /* (56 - 48) / 2 */
}

.account-card.peek-3 {
  height: 44px;
  top: 6px;   /* (56 - 44) / 2 */
}
```

Update `.account-card` base transition from `left 0.25s ease, opacity 0.25s ease` to `left 0.25s ease, top 0.25s ease` (opacity removed since peek dimming now uses background color, `top` added for centering animation).

---

## Files Changed

| File | Changes |
|------|---------|
| `src/js/accounts.js` | Avatar bug fix; `toggleHeader()`, `initHeaderCollapsed()`, `#headerToggleBtn` injection in `renderAccountsHeader()` |
| `src/style.css` | `.collapsed`, `.floating`, `#headerToggleBtn` styles; peek card background + centering |
| `src/index.html` | Expose `toggleHeader` globally |
| `src/js/main.js` | Call `initHeaderCollapsed()` on startup |

---

## Out of Scope

- Keyboard shortcut for collapse/expand
- Animation on `toggleHeader` for text/icon inside the button
- Saving per-user collapse preference server-side
