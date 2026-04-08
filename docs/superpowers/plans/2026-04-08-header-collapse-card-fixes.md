# Header Collapse + Card Stack Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible header with floating avatar toggle, fix peek card avatar bug, replace opacity-based peek dimming with dark backgrounds, and vertically center peek cards behind the selected card.

**Architecture:** All changes are isolated to `src/style.css` and `src/js/accounts.js`, with a small addition to `src/js/main.js` for startup state restoration. No new files. No new dependencies.

**Tech Stack:** Vanilla JS (ES2020), CSS custom properties, localStorage for persistence.

---

## Task 1: Fix peek card avatar bug

**Files:**
- Modify: `src/js/accounts.js` (function `_updateCardSlots`, ~line 295)
- Test: `src/tests/accounts.test.js`

- [ ] **Step 1: Write a failing unit test for the peek card formula**

Open `src/tests/accounts.test.js` and add at the end:

```js
describe('peek card account assignment (2 accounts)', () => {
  it('peek-1 shows the OTHER account, not selected', () => {
    const accounts = [
      { id: 'a1', token: 'ghu_x', login: 'alice', name: '', avatar_url: 'https://example.com/alice.png', plan: null, lastQuota: null },
      { id: 'a2', token: 'ghu_y', login: 'bob',   name: '', avatar_url: 'https://example.com/bob.png',   plan: null, lastQuota: null },
    ];
    localStorage.setItem('gh_accounts', JSON.stringify(accounts));
    localStorage.setItem('gh_selected_id', 'a1');
    const maxPeeks = 1;
    const selectedIdx = 0;
    const count = 2;
    // Correct formula: (selectedIdx + (maxPeeks - i)) % count
    // i=0 (peek slot): (0 + (1 - 0)) % 2 = 1 → accounts[1] = bob ✓
    const peekIdx = (selectedIdx + (maxPeeks - 0)) % count;
    expect(accounts[peekIdx].login).toBe('bob');
  });
});
```

- [ ] **Step 2: Run the test to confirm it passes (formula verification)**

```bash
npx vitest run src/tests/accounts.test.js --reporter=verbose 2>&1 | tail -20
```

Expected: test PASSES (this is a formula logic test, not DOM test). If it fails, recheck the formula.

- [ ] **Step 3: Apply the bugfix to `_updateCardSlots`**

In `src/js/accounts.js`, locate the loop inside `_updateCardSlots` (around line 293-302):

```js
  // BEFORE (buggy):
  for (let i = 0; i <= maxPeeks; i++) {
    if (i < maxPeeks) {
      // Peek card: account at (selectedIdx + maxPeeks + 1 - i) % count
      slotAccounts.push(accounts[(selectedIdx + maxPeeks + 1 - i) % count]);
    } else {
      // Selected card (always at the last position)
      slotAccounts.push(selected);
    }
  }
```

Replace with:

```js
  for (let i = 0; i <= maxPeeks; i++) {
    if (i < maxPeeks) {
      // Peek card: account at (selectedIdx + (maxPeeks - i)) % count
      slotAccounts.push(accounts[(selectedIdx + (maxPeeks - i)) % count]);
    } else {
      // Selected card (always at the last position)
      slotAccounts.push(selected);
    }
  }
```

- [ ] **Step 4: Run all tests to confirm no regressions**

```bash
npx vitest run --reporter=verbose 2>&1 | tail -30
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/js/accounts.js src/tests/accounts.test.js
git commit -m "fix: correct peek card account index formula"
```

---

## Task 2: Replace opacity dimming with dark backgrounds on peek cards

**Files:**
- Modify: `src/style.css` (`.account-card`, `.account-card.peek-1`, `.account-card.peek-2`)

- [ ] **Step 1: Update `.account-card` base transition**

In `src/style.css`, find:

```css
.account-card {
  position: absolute;
  width: 280px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: left 0.25s ease, opacity 0.25s ease;
}
```

Change only the `transition` line to:

```css
  transition: left 0.25s ease, top 0.25s ease;
```

- [ ] **Step 2: Rewrite `.account-card.peek-1`**

Find:

```css
.account-card.peek-1 {
  z-index: 2;
  opacity: 0.67;
  pointer-events: none;
  height: 52px; /* 4px smaller than 56px base */
}
```

Replace with:

```css
.account-card.peek-1 {
  z-index: 2;
  opacity: 1;
  pointer-events: none;
  height: 52px;
  background: color-mix(in srgb, var(--surface) 55%, var(--bg) 45%);
  border-color: color-mix(in srgb, var(--border) 50%, var(--bg) 50%);
}
```

- [ ] **Step 3: Rewrite `.account-card.peek-2`**

Find:

```css
.account-card.peek-2 {
  z-index: 1;
  opacity: 0.42;
  pointer-events: none;
  height: 48px; /* 4px smaller than peek-1 */
}
```

Replace with:

```css
.account-card.peek-2 {
  z-index: 1;
  opacity: 1;
  pointer-events: none;
  height: 48px;
  background: color-mix(in srgb, var(--surface) 20%, var(--bg) 80%);
  border-color: color-mix(in srgb, var(--border) 25%, var(--bg) 75%);
}
```

- [ ] **Step 4: Add `.account-card.peek-3` rule (for 4+ accounts)**

After the `.peek-2` rule, add:

```css
.account-card.peek-3 {
  z-index: 0;
  opacity: 1;
  pointer-events: none;
  height: 44px;
  background: color-mix(in srgb, var(--surface) 8%, var(--bg) 92%);
  border-color: color-mix(in srgb, var(--border) 12%, var(--bg) 88%);
}
```

- [ ] **Step 5: Verify visually**

Open http://localhost:5173/?demo=1 in the browser (vite already running). With 2+ accounts, peek cards should look darker, not translucent. Opacity blending with bg should be gone.

- [ ] **Step 6: Run tests**

```bash
npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/style.css
git commit -m "feat: peek cards use dark bg instead of opacity"
```

---

## Task 3: Vertically center peek cards behind selected card

**Files:**
- Modify: `src/style.css` (`.account-card.peek-1`, `.account-card.peek-2`, `.account-card.peek-3`, `.account-card-stack`)

- [ ] **Step 1: Add `top` to `.account-card.selected`**

Find `.account-card.selected` in `src/style.css`:

```css
.account-card.selected {
  z-index: 3;
  opacity: 1;
  background: var(--tag-bg);
  border-color: var(--border);
}
```

Add `top: 0;` explicitly (no height change needed):

```css
.account-card.selected {
  z-index: 3;
  opacity: 1;
  background: var(--tag-bg);
  border-color: var(--border);
  top: 0;
}
```

- [ ] **Step 2: Add `top` offsets to peek rules**

In `.account-card.peek-1` (now from Task 2), add `top: 2px;`:

```css
.account-card.peek-1 {
  z-index: 2;
  opacity: 1;
  pointer-events: none;
  height: 52px;
  top: 2px;
  background: color-mix(in srgb, var(--surface) 55%, var(--bg) 45%);
  border-color: color-mix(in srgb, var(--border) 50%, var(--bg) 50%);
}
```

In `.account-card.peek-2`, add `top: 4px;`:

```css
.account-card.peek-2 {
  z-index: 1;
  opacity: 1;
  pointer-events: none;
  height: 48px;
  top: 4px;
  background: color-mix(in srgb, var(--surface) 20%, var(--bg) 80%);
  border-color: color-mix(in srgb, var(--border) 25%, var(--bg) 75%);
}
```

In `.account-card.peek-3`, add `top: 6px;`:

```css
.account-card.peek-3 {
  z-index: 0;
  opacity: 1;
  pointer-events: none;
  height: 44px;
  top: 6px;
  background: color-mix(in srgb, var(--surface) 8%, var(--bg) 92%);
  border-color: color-mix(in srgb, var(--border) 12%, var(--bg) 88%);
}
```

- [ ] **Step 3: Verify visually**

Open http://localhost:5173/?demo=1. With 3-4 demo accounts, the peek cards should be centered behind the selected card — equal space above and below each peeking card relative to the selected card's edges.

- [ ] **Step 4: Commit**

```bash
git add src/style.css
git commit -m "feat: vertically center peek cards behind selected card"
```

---

## Task 4: Collapsible header with floating avatar toggle

**Files:**
- Modify: `src/js/accounts.js` (add `toggleHeader`, `initHeaderCollapsed`, update `renderAccountsHeader`)
- Modify: `src/style.css` (add header collapse + toggle button CSS)
- Modify: `src/js/main.js` (call `initHeaderCollapsed`, expose `toggleHeader` on window)

### 4a — CSS for header collapse and toggle button

- [ ] **Step 1: Add `position: relative` and collapse/transition to `.accounts-header`**

In `src/style.css`, find `.accounts-header`:

```css
.accounts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px 20px;
  height: 88px;
  overflow: hidden;
}
```

Replace with (add `position: relative`, replace fixed `height` with `max-height` + transitions):

```css
.accounts-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px 20px;
  max-height: 120px;
  overflow: hidden;
  transition: max-height 0.3s ease, padding 0.3s ease, opacity 0.3s ease, border-color 0.3s ease, margin 0.3s ease;
}

.accounts-header.collapsed {
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  opacity: 0;
  border-color: transparent;
  margin-bottom: 0;
}

.accounts-header.no-transition,
.accounts-header.no-transition * {
  transition: none !important;
}
```

- [ ] **Step 2: Add `#headerToggleBtn` CSS**

After the `.accounts-header` block in `src/style.css`, add:

```css
/* ─── Header toggle button ──────────────────────────────── */
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
  transition: border-color 0.15s, box-shadow 0.15s;
  z-index: 10;
  padding: 0;
}
#headerToggleBtn:hover {
  border-color: var(--blue);
  box-shadow: 0 0 0 2px rgba(56,139,253,0.15);
}
#headerToggleBtn img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}
#headerToggleBtn svg {
  color: var(--muted);
  width: 18px;
  height: 18px;
}
#headerToggleBtn .toggle-hint {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--tag-bg);
  border: 1px solid var(--border);
  font-size: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
  line-height: 1;
}
#headerToggleBtn:hover .toggle-hint { opacity: 1; }

/* Floating state (when header is collapsed) */
#headerToggleBtn.floating {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 200;
}
#headerToggleBtn.floating .toggle-hint::before {
  content: '▲';
}
#headerToggleBtn:not(.floating) .toggle-hint::before {
  content: '▼';
}
```

### 4b — JS: `renderAccountsHeader` injects toggle button

- [ ] **Step 3: Add toggle button HTML injection in `renderAccountsHeader`**

In `src/js/accounts.js`, export `toggleHeader` and `initHeaderCollapsed` functions. Add them after the `renderAccountsHeader` export:

```js
export function toggleHeader() {
  const header = document.getElementById('accountsHeader');
  const btn    = document.getElementById('headerToggleBtn');
  if (!header || !btn) return;
  const isCollapsed = header.classList.contains('collapsed');
  if (isCollapsed) {
    header.classList.remove('collapsed');
    btn.classList.remove('floating');
    localStorage.setItem('headerCollapsed', 'false');
  } else {
    header.classList.add('collapsed');
    btn.classList.add('floating');
    localStorage.setItem('headerCollapsed', 'true');
  }
}

export function initHeaderCollapsed() {
  if (localStorage.getItem('headerCollapsed') !== 'true') return;
  const header = document.getElementById('accountsHeader');
  const btn    = document.getElementById('headerToggleBtn');
  if (!header || !btn) return;
  // Apply without animation
  header.classList.add('no-transition');
  header.classList.add('collapsed');
  btn.classList.add('floating');
  // Remove no-transition after one frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => header.classList.remove('no-transition'));
  });
}
```

- [ ] **Step 4: Build `_toggleBtnHtml` helper and inject into `renderAccountsHeader`**

In `src/js/accounts.js`, add a helper function (before `renderAccountsHeader`):

```js
function _toggleBtnHtml(accounts) {
  const selected = getSelectedAccount();
  const iconContent = (selected?.avatar_url)
    ? `<img src="${escHtml(selected.avatar_url)}" alt="${escHtml(selected.login)}" loading="lazy" />`
    : GITHUB_ICON;
  return `<button id="headerToggleBtn" onclick="toggleHeader()" title="Toggle header" aria-label="Toggle accounts header">${iconContent}<span class="toggle-hint"></span></button>`;
}
```

Then in `renderAccountsHeader`, in the **zero-accounts** branch (the `if (!accounts.length)` block), change:

```js
    container.innerHTML = `
      <div class="accounts-header-body">
        <div>
          <div class="fw-600 mb-3">GitHub Copilot Quota Planner</div>
          <div class="fs-12 muted">Add a token to auto-fetch your quota from GitHub.</div>
        </div>
        <div>
          <button class="auth-btn auth-btn-primary" onclick="openAccountsModal()">
            ${GITHUB_ICON}
            Connect token
          </button>
        </div>
      </div>`;
    return;
```

To (add toggle button):

```js
    container.innerHTML = `
      ${_toggleBtnHtml([])}
      <div class="accounts-header-body">
        <div>
          <div class="fw-600 mb-3">GitHub Copilot Quota Planner</div>
          <div class="fs-12 muted">Add a token to auto-fetch your quota from GitHub.</div>
        </div>
        <div>
          <button class="auth-btn auth-btn-primary" onclick="openAccountsModal()">
            ${GITHUB_ICON}
            Connect token
          </button>
        </div>
      </div>`;
    return;
```

And in the **non-zero-accounts** branch, inside the `if (count !== _lastRenderedCount)` block, change:

```js
    container.innerHTML = `
      <div class="accounts-header-body">
```

To:

```js
    container.innerHTML = `
      ${_toggleBtnHtml(accounts)}
      <div class="accounts-header-body">
```

- [ ] **Step 5: Update toggle button icon whenever accounts/selection change**

The toggle button icon (avatar vs GitHub icon) must update when the selection changes without rebuilding the whole header. Add this helper and call it from `_updateCardSlots`:

In `src/js/accounts.js`, add after `_toggleBtnHtml`:

```js
function _syncToggleBtnIcon() {
  const btn = document.getElementById('headerToggleBtn');
  if (!btn) return;
  const selected = getSelectedAccount();
  // Preserve the .toggle-hint span, only replace the icon
  const hint = btn.querySelector('.toggle-hint');
  btn.innerHTML = '';
  if (selected?.avatar_url) {
    const img = document.createElement('img');
    img.src = escHtml(selected.avatar_url);
    img.alt = escHtml(selected.login);
    img.loading = 'lazy';
    btn.appendChild(img);
  } else {
    btn.insertAdjacentHTML('beforeend', GITHUB_ICON);
  }
  if (hint) btn.appendChild(hint);
}
```

Then at the **end of `_updateCardSlots`** (after the exiting animation block), add:

```js
  _syncToggleBtnIcon();
```

### 4c — `main.js`: expose and initialize

- [ ] **Step 6: Import and expose `toggleHeader` and `initHeaderCollapsed` in `main.js`**

In `src/js/main.js`, update the import from `accounts.js`:

```js
import {
  getSelectedToken, ghHeaders, renderAccountsHeader,
  openAccountsModal, closeAccountsModal, signOutAllAndRender,
  _addTokenField, _submitTokens, navigateAccount, removeAccountAndRender,
  migrateFromLegacy, updateAccountQuota, getSelectedAccount, showToast,
  getAccounts, saveSelectedId, toggleHeader, initHeaderCollapsed,
} from './accounts.js';
```

In the `Object.assign(window, { ... })` block, add `toggleHeader`:

```js
Object.assign(window, {
  syncUsage, syncUsageFromInput, updateStatus, stepNum,
  openCalendar, closeCalendar, calNavMonth, calToggleDay, clearCustomDayoffs,
  onWeekendsToggle, onCalWeekendsToggle,
  openAccountsModal, closeAccountsModal, signOutAllAndRender,
  _addTokenField, _submitTokens, navigateAccount, removeAccountAndRender,
  fetchRealUsage, onMonthLenChange, toggleHeader,
});
```

At the end of the `DOMContentLoaded` handler (after `migrateFromLegacy()` and before the `Escape` keydown handler), add:

```js
  // Restore header collapsed state
  initHeaderCollapsed();
```

- [ ] **Step 7: Verify visually**

Open http://localhost:5173/. The avatar (or GitHub icon if no account) should appear at top-right of the header. Click it — the header collapses, the button floats top-right. Refresh — the collapsed state persists. Click again — it expands, the page content shifts down smoothly. With 2 accounts, the floating button shows account 1's avatar; switch to account 2 — the floating button updates.

- [ ] **Step 8: Run all tests**

```bash
npx vitest run --reporter=verbose 2>&1 | tail -30
```

Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add src/js/accounts.js src/js/main.js src/style.css
git commit -m "feat: collapsible header with floating avatar toggle"
```

---

## Final verification

- [ ] **Run full test suite one last time**

```bash
npx vitest run --reporter=verbose 2>&1 | tail -30
```

Expected: all tests PASS.

- [ ] **Manual smoke test checklist**
  - [ ] 0 accounts: GitHub icon shown in toggle button; collapse/expand works
  - [ ] 1 account: avatar shown; collapse persists on refresh
  - [ ] 2 accounts: peek card shows the OTHER account's avatar (not selected)
  - [ ] 2 accounts: peek card is darker, not translucent
  - [ ] 3+ accounts: peek cards get progressively darker with `opacity: 1`
  - [ ] peek cards are vertically centered behind selected card
  - [ ] Switching accounts updates the floating toggle button's avatar

- [ ] **Final commit if any last tweaks were made**

```bash
git add -A
git commit -m "chore: final polish on header collapse + card fixes"
```
