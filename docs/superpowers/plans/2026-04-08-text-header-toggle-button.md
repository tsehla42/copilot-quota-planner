# Text-Based Header Toggle Button Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the profile picture toggle button with text-based "Collapse header" and "Expand header" buttons.

**Architecture:** 
- Update `_toggleBtnHtml()` in `accounts.js` to render a text button instead of image
- Update CSS in `style.css` for minimal text button styling both inline and floating states
- Preserve all existing toggle logic and state management (no JS changes needed)

**Tech Stack:** Vanilla HTML, CSS, JavaScript (no new dependencies)

---

## File Structure

**Modified files:**
- `src/js/accounts.js` — Update button HTML generation
- `src/style.css` — Update button styling for text, positioning

No new files. Existing logic in `toggleHeader()` and `initHeaderCollapsed()` requires no changes.

---

## Task 1: Update Button HTML to Show Text

**Files:**
- Modify: `src/js/accounts.js:192`

**Steps:**

- [ ] **Step 1: Review current button HTML generation**

The current `_toggleBtnHtml()` function at line ~192 renders an image or GitHub icon. We need to replace it with text.

Location: [src/js/accounts.js](src/js/accounts.js#L192)

Current code structure:
```javascript
function _toggleBtnHtml() {
  const selected = getSelectedAccount();
  const iconContent = (selected?.avatar_url)
    ? `<img src="${escHtml(selected.avatar_url)}" alt="${escHtml(selected.login)}" loading="lazy" />`
    : GITHUB_ICON;
  return `<button id="headerToggleBtn" onclick="toggleHeader()" title="Toggle header" aria-label="Toggle accounts header">${iconContent}<span class="toggle-hint"></span></button>`;
}
```

- [ ] **Step 2: Update `_toggleBtnHtml()` to render text button**

Replace with:
```javascript
function _toggleBtnHtml() {
  return `<button id="headerToggleBtn" onclick="toggleHeader()" title="Collapse header" aria-label="Collapse accounts header">Collapse header</button>`;
}
```

**Reasoning:** 
- Remove all image/icon logic — no need to check for avatar
- Text stays consistent: "Collapse header" when expanded
- Remove `.toggle-hint` span since we don't need a visual indicator anymore
- Simplify attributes (title now says "Collapse header")

- [ ] **Step 3: Verify no other code references the profile picture**

Check if `_syncToggleBtnIcon()` needs to be removed or updated.

Location: [src/js/accounts.js](src/js/accounts.js#L200)

The function `_syncToggleBtnIcon()` syncs the button's icon when accounts change. Since we're removing images, this function can be deleted entirely. Search the file to confirm it's not called elsewhere.

- [ ] **Step 4: Delete `_syncToggleBtnIcon()` function**

Remove lines ~200-216 (the entire function). Verify no calls to it exist in `renderAccountsHeader()` or elsewhere.

- [ ] **Step 5: Commit**

```bash
git add src/js/accounts.js
git commit -m "refactor: replace profile pic toggle button with text 'Collapse header'"
```

---

## Task 2: Update CSS for Inline (Expanded) State

**Files:**
- Modify: `src/style.css:475-510`

The button should appear as minimal text when the header is expanded (not floating).

**Steps:**

- [ ] **Step 1: Review current button styling**

Location: [src/style.css](src/style.css#L475)

Current CSS makes it a circular 36px button with image/icon inside. We need to change it to an inline text button.

- [ ] **Step 2: Update base `#headerToggleBtn` styling**

Replace the entire `#headerToggleBtn` block (~lines 475-510) with:

```css
/* ─── Header toggle button ──────────────────────────────── */
#headerToggleBtn {
  position: absolute;
  top: 12px;
  right: 16px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  transition: color 0.15s;
  z-index: 10;
}

#headerToggleBtn:hover {
  color: var(--blue);
}
```

**Reasoning:**
- Remove `width`, `height`, `border-radius`, `overflow`, `display: flex` (no image)
- Add `padding` for text button spacing
- Change `border` to `none` (minimal style)
- Change `background` to `transparent` (minimal style)
- Add `font-size`, `font-weight`, `white-space: nowrap` for text buttons
- Keep `position: absolute` and `top/right` for inline positioning
- Simplified `transition` (no box-shadow, no border-color changes)

- [ ] **Step 3: Remove the old button state CSS**

Delete these blocks that are no longer needed:
- `#headerToggleBtn:hover` old version with border/shadow
- `#headerToggleBtn img` (no images anymore)
- `#headerToggleBtn svg` (though this might be used elsewhere, verify)
- `#headerToggleBtn .toggle-hint` entire block (no hint needed)

- [ ] **Step 4: Commit**

```bash
git add src/style.css
git commit -m "style: update toggle button to minimal text style (expanded state)"
```

---

## Task 3: Update CSS for Floating (Collapsed) State

**Files:**
- Modify: `src/style.css` (add/update floating state)

When header is collapsed, button shows at the top with "Expand header" text, positioned absolutely in the whitespace.

**Steps:**

- [ ] **Step 1: Update floating state CSS**

The existing `.floating` class needs updates. Find it around line ~520:

```css
#headerToggleBtn.floating {
  position: fixed;  /* CHANGE to absolute */
  top: 16px;        /* ADJUST positioning */
  right: 16px;
  z-index: 200;     /* Keep high z-index */
}
```

Replace with:
```css
#headerToggleBtn.floating {
  position: absolute;
  top: -44px;       /* Position above collapsed header */
  right: 16px;
  z-index: 10;      /* Can be same z-index as normal */
}
```

**Reasoning:**
- Change to `absolute` positioning (scrolls with content, not fixed to viewport)
- Position `-44px` from top of header (above it, in margin space)
- Adjust z-index to 10 (no need for 200 if absolute positioned, won't hide behind anything)

- [ ] **Step 2: Remove old `.toggle-hint` pseudo-element rules from floating state**

Delete or comment out:
```css
#headerToggleBtn.floating .toggle-hint::before {
  content: '▲';
}
#headerToggleBtn:not(.floating) .toggle-hint::before {
  content: '▼';
}
```

These are no longer needed since we removed the `.toggle-hint` span.

- [ ] **Step 3: Update button text via JavaScript on toggle**

Wait — we need to change the button text when toggling. Update `toggleHeader()` in `accounts.js` to change the button text.

Location: [src/js/accounts.js](src/js/accounts.js#L283)

Current code:
```javascript
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
```

Update to:
```javascript
export function toggleHeader() {
  const header = document.getElementById('accountsHeader');
  const btn    = document.getElementById('headerToggleBtn');
  if (!header || !btn) return;
  const isCollapsed = header.classList.contains('collapsed');
  if (isCollapsed) {
    header.classList.remove('collapsed');
    btn.classList.remove('floating');
    btn.textContent = 'Collapse header';
    btn.title = 'Collapse header';
    localStorage.setItem('headerCollapsed', 'false');
  } else {
    header.classList.add('collapsed');
    btn.classList.add('floating');
    btn.textContent = 'Expand header';
    btn.title = 'Expand header';
    localStorage.setItem('headerCollapsed', 'true');
  }
}
```

- [ ] **Step 4: Test button text change in browser**

Open dev tools console and run:
```javascript
toggleHeader();  // Should show "Expand header" 
toggleHeader();  // Should show "Collapse header"
```

Verify text changes and classes apply correctly.

- [ ] **Step 5: Commit**

```bash
git add src/js/accounts.js src/style.css
git commit -m "style: update toggle button floating state (absolute positioning, expand header text)"
```

---

## Task 4: Verify Floating Button Initialize on Page Load

**Files:**
- Check: `src/js/accounts.js:299` (initHeaderCollapsed function)

**Steps:**

- [ ] **Step 1: Review `initHeaderCollapsed()` logic**

Location: [src/js/accounts.js](src/js/accounts.js#L299)

Current code should set button text on initial page load. Update it:

```javascript
export function initHeaderCollapsed() {
  if (localStorage.getItem('headerCollapsed') !== 'true') return;
  const header = document.getElementById('accountsHeader');
  const btn    = document.getElementById('headerToggleBtn');
  if (!header || !btn) return;
  // Apply without animation
  header.classList.add('no-transition');
  header.classList.add('collapsed');
  btn.classList.add('floating');
  btn.textContent = 'Expand header';       // ADD THIS LINE
  btn.title = 'Expand header';             // ADD THIS LINE
  // Remove no-transition after one frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => header.classList.remove('no-transition'));
```

**Reasoning:** When page loads with header collapsed, button should show "Expand header" text from the start.

- [ ] **Step 2: Commit**

```bash
git add src/js/accounts.js
git commit -m "fix: set button text on page load when header is collapsed"
```

---

## Task 5: Build and Test in Browser

**Files:**
- No changes

**Steps:**

- [ ] **Step 1: Build the project**

```bash
npm run build
```

Expected output: Vite builds successfully, output file created at `_build/index.html`, copied to `index.html`.

- [ ] **Step 2: Open in browser and test**

Open `http://localhost:5173/` (if Vite dev server is running) or open built `index.html` directly.

Test the following scenarios:
- [ ] Header expanded: Button shows "Collapse header" inline on right side of header
- [ ] Click button: Header collapses, button moves to top of page (above header) and shows "Expand header"
- [ ] Click button again: Header expands, button returns inline and shows "Collapse header"
- [ ] Refresh page with header collapsed: Button shows "Expand header" at top on initial load (no animation)
- [ ] Refresh page with header expanded: Button shows "Collapse header" inline (normal state)

- [ ] **Step 3: Verify hover state**

- [ ] Button text changes color on hover (should use `var(--blue)`)
- [ ] No background/border visible (minimal style)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: replace profile picture toggle with text-based collapse/expand header buttons"
```

---

## Success Criteria

✅ Button displays "Collapse header" when header is expanded (inline, right side)
✅ Button displays "Expand header" when header is collapsed (absolutely positioned above header)
✅ All toggle functionality works (state persists across page loads)
✅ Text changes between states instantly (no animation)
✅ Minimal button styling (no background/border, text-only)
✅ Hover state shows blue text color
✅ Profile picture and icon code removed entirely
