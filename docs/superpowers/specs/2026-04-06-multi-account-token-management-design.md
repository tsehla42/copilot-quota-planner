# Multi-Account Token Management Design

**Date:** April 6, 2026  
**Status:** Approved  
**Feature:** Support multiple GitHub Copilot Business accounts with per-account quota tracking and instant account switching.

---

## Overview

The GitHub Copilot Quota Planner currently stores a single token in localStorage and displays its quota. This design extends the system to handle **unlimited multiple accounts**, let users switch between them instantly (with cached quota), and manage (add/remove) accounts from a redesigned header.

---

## Requirements

### Functional

1. **Account management** — Users can add, view, and remove multiple GitHub tokens
2. **Per-account quota cache** — Each account stores its last-fetched quota (plan, %, remaining, reset date)
3. **Instant switching** — Switching accounts immediately renders the cached quota into the calculator
4. **Background refresh** — On switch, fetch fresh quota in the background; update cache on success
5. **Graceful errors** — If fetch fails on switch, show a toast and revert to the previous account
6. **Persistence** — Selected account persists across page refreshes
7. **Modal token entry** — Single modal form that accepts multiple tokens (with + button to add more fields)
8. **Remove accounts** — Each account can be removed; selecting defaults to the next account

### Non-Functional

- No server changes — stays browser-only
- localStorage only for persistence
- Backward compatible startup (if old `gh_token` / `gh_user` keys exist, migrate them on first load)
- Smooth animations on card stack transitions

---

## Data Model

### localStorage Keys

**`gh_accounts`** (JSON array)  
Array of account objects:
```json
[
  {
    "id": "uuid-or-timestamp",
    "token": "ghu_...",
    "login": "@username",
    "name": "User Name",
    "avatar_url": "https://avatars.githubusercontent.com/u/...",
    "plan": "business",
    "lastQuota": {
      "pctUsed": 45.3,
      "entitlement": 300,
      "remaining": 165,
      "resetDate": "2026-05-06T00:00:00Z",
      "unlimited": false,
      "timestamp": 1712402100
    }
  }
]
```

**`gh_selected_id`** (string)  
UUID of the currently selected account. If missing or invalid, default to first account.

### Account Object Structure

| Field | Type | Purpose |
|-------|------|---------|
| `id` | string | Unique identifier (UUID or timestamp); used as key for selection |
| `token` | string | GitHub token (ghu_, ghp_, github_pat_, gho_) |
| `login` | string | GitHub username (from `/user` endpoint) |
| `name` | string | GitHub full name (may be empty) |
| `avatar_url` | string | Profile picture URL |
| `plan` | string | Last-known plan type (free, pro, business) |
| `lastQuota` | object | Cached quota snapshot from last successful fetch (see below) |

### lastQuota Object

| Field | Type | Purpose |
|-------|------|---------|
| `pctUsed` | number | Usage percentage (0–100) |
| `entitlement` | number | Total quota entitlement (300 for Business) |
| `remaining` | number | Remaining quota count |
| `resetDate` | string | ISO-8601 date when quota resets |
| `unlimited` | boolean | Whether plan is unlimited |
| `timestamp` | number | Unix timestamp of when this was fetched |

**Note:** On first add, `lastQuota` may be `null` (fetch skipped to speed up add flow) or initialized from the add-flow fetch if time permits.

---

## UI Layout

### Header Section (New)

**Container:** Horizontal flex section above the calculator card. Two logical sections separated visually.

#### Static Section (Left)

- **Label row:** "Connected accounts" or "1 account connected" / "3 accounts connected"
- **Navigation row:**
  - **Up/Down arrow buttons** (←/→ or ↑↓): Visible only if 2+ accounts
    - On click: Move to next/previous account, trigger `switchAccount()`
    - Cycling: last account → first account
  - **"+ Add account" button:** Always visible if 1+ accounts exist
    - Opens token management modal
  - **"Sign out all" button:** 
    - Clears all accounts, renders disconnect state, hides header

#### Dynamic Section (Right)

**Card stack** (visual "playing cards" effect):

- **Selected card** (full opacity, center position):
  - **Avatar** (circular, 40x40px)
  - **Login handle** (@username) — bold
  - **Name/plan line:** "User Name · business plan" (or "free plan", etc.)
  - **Remove button** (× icon in top-right corner, visible on hover or always):
    - Deletes this account only
    - If it's the selected one, shifts to next (or first if last)
    - Re-renders UI + fetches new selected

- **Upcoming cards** (1–2 visible beneath, 12px peek, half-transparent/dim):
  - Visual hint that more accounts exist
  - Not interactive, purely decorative

**Animations:**
- On arrow click: selected card slides left/right with fade-out, next card slides in with fade-in
- Smooth CSS transitions (200–300ms)

**Single-account state:**
- Arrow buttons hidden
- Card centered, no peek cards below
- Remove button hidden (use "Sign out all" instead)

---

## Module Architecture

### New: `accounts.js`

Replaces the account-management role of `auth.js`. Exports:

```js
// Read/Write
getAccounts()                    // → gh_accounts array (or [])
getSelectedId()                  // → gh_selected_id (or null)
getSelectedAccount()             // → account object or null
setSelectedId(id)                // Update gh_selected_id, trigger re-render

// Manage accounts
addAccounts(tokenArray)          // Validate tokens, fetch user data, add to array
                                 // Returns: { added: number, failed: [] }
removeAccount(id)                // Delete account, shift selection if needed
signOutAll()                     // Clear all accounts from localStorage

// Token helpers (for calculator compatibility)
getSelectedToken()               // Shortcut: getSelectedAccount()?.token || null
ghHeaders()                      // Returns headers using selected token

// UI rendering
renderAccountsHeader()           // Render static + dynamic sections
switchAccount(id)                // Select, fetch fresh quota, update UI + calc
openTokenModal()                 // Open modal for adding token(s)
closeTokenModal()                // Close modal
```

### Updated: `auth.js`

Keep as-is for backward compatibility. Over time it becomes unused:
- `getToken()` → delegates to `getSelectedToken()`
- `renderAuthCard()` → no-op (header now rendered by `accounts.js`)
- `openAuthModal()`, `_savePAT()`, etc. → deprecated (new flow uses `openTokenModal()` + `accounts.addAccounts()`)

Deprecation can be cleaned up in a follow-up refactor.

### Updated: `main.js`

- Replace auth imports with accounts imports
- On page load: `renderAccountsHeader()` + `autoFetchSelectedQuota()` instead of `renderAuthCard()` + `autoFetchOnLoad()`
- Expose `switchAccount()` to window for onclick handlers
- Listen for `account:switched` CustomEvent to re-render calculator

### Updated: `uiHelpers.js`

No changes to calculator logic. But `syncUsage()` et al. continue to work with the global `state` object, which is now updated by `switchAccount()` → `fetchRealUsage()` with the selected token.

### Updated: `style.css`

Add new classes:
- `.accounts-header` — container for static + dynamic sections
- `.accounts-static` — label + buttons (left)
- `.accounts-dynamic` — card stack (right)
- `.account-card` — single card, selected state styling
- `.account-card:not(.selected)` — dimmed/transparent styling
- `.account-card-icon`, `.account-card-info` — layout inside card
- `.account-remove` — remove button styling
- `.card-stack-peek` — positioning for footer cards (12px visible)
- `.nav-arrow` — up/down button styling

---

## Interaction Flows

### 1. Add First Account

**User state:** No accounts, page shows "Connect GitHub token" button

| Step | Action | System |
|------|--------|--------|
| 1 | Click "Connect GitHub token" | Open token modal |
| 2 | Paste token, may click + to add more | Modal shows multiple input fields with × buttons |
| 3 | Click "Add account(s)" | Validate format → fetch `/user` for each → create account objects |
| 4 | Add successful | Select first added account → fetch `/copilot_internal/user` → update `lastQuota` → close modal → render header + calculator |
| 5 | Errors | Show toast per failed token, but continue adding others |

**Result:** Header shows account card + single "Sign out all" button (no arrows yet).

### 2. Add Subsequent Accounts

**User state:** 1+ accounts already connected

| Step | Action | System |
|------|--------|--------|
| 1 | Click "+ Add account" button | Open token modal (same form) |
| 2 | Paste token(s), click + | Modal allows multiple entries |
| 3 | Click "Add account(s)" | Validate, fetch user data, add to gh_accounts |
| 4 | Success | Remain on current selected account, update gh_accounts, render header |
| 5 | Result | New accounts appear in card stack (below selected), arrows now visible |

### 3. Switch Account (Arrow Click)

**Flow:**

| Step | Action | System |
|------|--------|--------|
| 1 | Click ↑ or ↓ button | Calculate next account ID |
| 2 | Call `switchAccount(nextId)` | Update `gh_selected_id` + render UI immediately |
| 3 | UI renders | Card stack reorganizes, new card rises to top (animated) |
| 4 | Background fetch | `fetchRealUsage()` with new token, no spinner (silent) |
| 5 | Fetch succeeds | Update `lastQuota` for new account, re-save to localStorage, re-render (card may show "last updated X ago" or similar hint) |
| 6 | Fetch fails | Show toast "Failed to fetch for @login · staying on %s" (previous account), revert `gh_selected_id` to previous, keep UI on previous card |

**Calculator sync:** When `switchAccount()` is called, the global `state` is updated with `lastQuota` values immediately, so the calculator re-renders with cached data. On fresh fetch success, `state` is updated again with latest values.

### 4. Remove Account

**User state:** 1+ accounts, mouse hovers on selected card (or card is focused)

| Step | Action | System |
|------|--------|--------|
| 1 | Click × (remove button) on card | Confirm dialog (optional: "Remove @login?") |
| 2 | User confirms | Delete account from `gh_accounts` |
| 3 | If was selected | Shift `gh_selected_id` to next account, fetch fresh quota |
| 4 | If not selected | Just remove, stay on current |
| 5 | Result | Header re-renders, account array is shorter, stack reflows |
| 6 | Edge case: Last account removed | Show disconnect state ("Connect GitHub token" button), hide header |

### 5. Sign Out All

**User state:** 1+ accounts

| Step | Action | System |
|------|--------|--------|
| 1 | Click "Sign out all" button | Confirm dialog (optional: "Sign out of all accounts?") |
| 2 | User confirms | `signOutAll()` → clear `gh_accounts` + `gh_selected_id` localStorage |
| 3 | UI updates | Hide header, show "Connect GitHub token" button, reset calculator to defaults |

### 6. Page Refresh

**User state:** 2+ accounts, account #2 was selected

| Step | Action | System |
|------|--------|--------|
| 1 | Page load, JS runs | Load `gh_accounts` + `gh_selected_id` from localStorage |
| 2 | Validate | If selected ID exists in accounts array, keep it; else default to first |
| 3 | Render | `renderAccountsHeader()` with selected account card |
| 4 | Auto-fetch | Silent background fetch for selected account (if `lastQuota` is stale) |
| 5 | Calculator update | Renderer with last-cached quota values immediately |

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| **Token format invalid** | Form-level validation before submit; show error next to field |
| **Token valid format, API returns 401** | Add account anyway with `lastQuota: null`, show warning toast; user can remove it or wait for manual fetch |
| **Fetch on switch fails** | Toast + revert selection to previous account; card remains on previous |
| **All accounts deleted** | Render disconnect state ("Connect token" button) |
| **localStorage corrupted** | On load, catch JSON parse errors, default to empty accounts + no selection |
| **Selected account ID missing on refresh** | Fall back to first account in array |
| **Network timeout on add** | Show toast per token, skip adding that one, add others |

---

## Backward Compatibility

Old users with `gh_token` + `gh_user` in localStorage:

**On first load:**
1. Check for `gh_accounts` key
2. If missing, check for old `gh_token` + `gh_user` keys
3. If found: migrate to new format:
   ```js
   gh_accounts = [{ id: timestamp(), token, login, name, avatar_url, plan: null, lastQuota: null }]
   gh_selected_id = accounts[0].id
   ```
4. Delete old keys
5. Continue normally

Result: Seamless upgrade, no user action needed.

---

## Testing Strategy

### Unit

- `accounts.js` functions (add, remove, select, persistence)
- Token validation regex
- localStorage read/write
- Account object shape

### Integration

- Add first account → header renders correctly
- Add 2nd, 3rd account → card stack shows properly
- Switch account → calculator updates with cached quota
- Remove account → array reorders, selection shifts correctly
- Refresh page → selected account persists
- Fetch in background on switch → success and error cases

### Manual (E2E)

1. Start fresh (no accounts)
2. Click "Connect token" → add 2 tokens simultaneously
3. Click arrow → verify calculator syncs, background fetch happens
4. Click remove on one card → verify deletion works
5. Refresh page → verify selected persists + fetches fresh quota
6. Try adding invalid token → error handling works
7. Click "Sign out all" → clean slate

---

## Open Questions / Future

- Animation performance on large account counts (10+) — may need virtualization later
- Account nickname feature (re-discussed in follow-up)
- Keyboard shortcuts for account cycling (arrow keys?)

---

## Success Criteria

- [ ] Users can add/remove/switch between multiple accounts
- [ ] Selected account persists across refreshes
- [ ] Calculator syncs instantly on switch (cached quota)
- [ ] Background fetch updates quota without blocking
- [ ] Error states are handled gracefully
- [ ] All existing calculator functionality continues to work
- [ ] localStorage schema is clean and documented
