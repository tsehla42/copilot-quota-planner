# GitHub Copilot Quota Calculator — AI Assistant Instructions

## Purpose

Enable AI agents to understand, maintain, and enhance a standalone SPA calculator for GitHub Copilot Business quota tracking with live GitHub API integration.

## Project Overview

**GitHub Copilot Quota Planner** — an interactive calculator for tracking GitHub Copilot Business quota usage. Runs entirely in the browser with no server, no build step, and no dependencies.

- **Type**: Fully standalone single-page app (one `index.html` file)
- **Architecture**: All logic (UI, calculations, GitHub API calls) lives in `index.html`
- **Tech Stack**: Zero dependencies — vanilla HTML5, CSS3, pure JavaScript (ES2020+)
- **Runtime**: Browser only. Open `index.html` directly — no server required.

## Key Files

| File | Type | Purpose |
|------|------|---------|
| [index.html](index.html) | Everything | Layout, styles, calculation logic, UI state, GitHub API fetch |
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | Docs | This file — agent context and conventions |

## Architecture & Data Flow

```
User Browser (index.html)
    ↓ Manual usage % input  OR  click "Fetch" button
    ↓
Direct fetch to api.github.com (CORS: Access-Control-Allow-Origin: *)
    └─ GET /copilot_internal/user  (requires ghu_ OAuth token)
         Response: { quota_snapshots: { premium_interactions: { percent_remaining, ... } }, quota_reset_date, copilot_plan }
    ↓ usage % = 100 - percent_remaining
    ↓
Frontend updates slider + calculates burn rate / projection / daily budget
```

**Key Design Principle**: No server, no proxy, no env vars. All GitHub API calls are made directly from the browser. 

## Token Requirements

| Token type | Prefix | Works for |
|------------|--------|-----------|
| OAuth (VS Code session) | `ghu_` | `/copilot_internal/user` — returns real quota % ✅ |
| Classic PAT | `ghp_` | `/user` only — no quota data ❌ |
| Fine-grained PAT | `github_pat_` | `/user` only — no quota data ❌ |

**To get a `ghu_` token from VS Code (recommended):**
1. `F1` → "Developer: Toggle Developer Tools" → Network tab
2. Filter by `copilot_internal`, tick Preserve log
3. Send any Copilot Chat message (`Ctrl+Alt+I`)
4. Click the `user` request → Request Headers → copy value after `Authorization: token `

## Development Workflow

### Running Locally
Just open `index.html` in a browser — no server, no install, no build.

### Auth Storage (localStorage)
| Key | Value |
|-----|-------|
| `gh_token` | The `ghu_` or `ghp_` token |
| `gh_user` | `{ login, name, avatar_url }` JSON |

## Important Patterns & Conventions

### Frontend (Vanilla HTML/JS in index.html)
- **Everything in one file**: styles in `<style>`, logic in `<script>` at bottom of `<body>`
- **No framework**: DOM state via input values + direct `getElementById` manipulation
- **Custom number spinners**: `.num-wrap` / `.num-spin` CSS classes wrap `<input type="number">` with custom ▲▼ buttons driven by `stepNum(id, delta, min, max)`
- **Status indicators**: Green (under budget) → Yellow (slightly over) → Red (over budget)
- **Modal pattern**: Single `#authModal` overlay; content swapped via `#modalContent` innerHTML
- **Toggle switch**: `.toggle-switch` / `.toggle-track` / `.toggle-knob` CSS — `#reqModeChk` checkbox toggles `%` vs request-count display throughout the budget card (off by default)
- **No inline styles**: use utility CSS classes (`.fw-600`, `.fs-11`, `.muted`, `.mb-*`, `.d-block`, `.pr-88`, etc.) or component classes; inline `style=` only for dynamic JS-driven values like colors

### Global State
```js
let quotaEntitlement = 300;  // updated from API response (pi.entitlement)
let quotaRemaining   = null; // null until fetched; stores pi.remaining
let calCustomDayoffs = new Set(); // ISO date strings marked as days off
let calViewYear / calViewMonth;   // calendar popup month navigation
```

### Key JS Functions

```js
// Auth
getToken()            // reads from localStorage
ghHeaders()           // returns Authorization + Accept headers
renderAuthCard()      // renders connected/disconnected states in #authCard
openAuthModal()       // opens PAT input modal
_savePAT()            // validates format, calls _verifyAndSave(token)
_verifyAndSave(token) // GET /user to confirm valid, stores in localStorage
signOut()             // clears gh_token, gh_user from localStorage

// Core fetch
fetchRealUsage()      // tries copilot_internal/user → falls back to /user for ghp_ tokens
                      // on success: sets quotaEntitlement + quotaRemaining globals
autoFetchOnLoad()     // silent fetch on page load if token is saved

// UI helpers
stepNum(id, delta, min, max) // increment/decrement number inputs, dispatches 'input' event
syncUsage(val)        // syncs slider ↔ number input ↔ display label
updateStatus()        // main calculator: burn rate, projection, pace indicator
                      // respects #reqModeChk toggle for % vs request-count display
                      // perfect pace target is working-days-aware (not raw calendar days)

// Tables
renderAllMonths()     // populates #allMonthsBody from MODELS array (all 4 entries incl. Grok)
updateRequestsToday() // populates #requestsToday — filters MODELS by showInToday: true (excludes Grok)
```

### MODELS Array
All model tiers live in `MODELS`; `showInToday` controls visibility in the daily-budget card:
```js
{ mult, costPct, label, color, examples[], showInToday }
// 0.25× Grok Code Fast 1    — showInToday: false (table only)
// 0.3×  Claude Haiku etc.   — showInToday: true
// 1×    Claude Sonnet etc.  — showInToday: true
// 3×    Claude Opus etc.    — showInToday: true
```

### Perfect Pace Target (working-days-aware)
`perfectTarget = 100 * workingDaysElapsed / totalWorkingDays`

This accounts for excluded weekends and calendar day-offs. `workingDaysElapsed` counts working days 1→today inclusive; `totalWorkingDays = workingDaysElapsed + workingDaysLeft`.

## GitHub API Integration

### Endpoint Used
- `GET https://api.github.com/copilot_internal/user`
  - Requires `X-GitHub-Api-Version: 2025-04-01` header
  - Requires `ghu_` OAuth token with `github.copilot` scope
  - Returns: `{ quota_snapshots: { premium_interactions: { percent_remaining, entitlement, remaining, unlimited }, chat: {...}, completions: {...} }, quota_reset_date, copilot_plan }`
  - **This is the exact endpoint VS Code's Copilot extension uses for its status bar quota display**

### Fallback for ghp_ tokens
- On 404/403 from `copilot_internal/user` → falls back to `GET /user` (token validity check only)
- Sets informational status message directing user to get a `ghu_` token

## Common Pitfalls & Solutions

| Pitfall | Solution |
|---------|----------|
| Fetch returns 404 on `copilot_internal/user` | Token is a `ghp_` PAT — needs OAuth `ghu_` token |
| Token works but quota % not shown | Same — only `ghu_` tokens have the `github.copilot` scope |
| Req-mode toggle shows wrong counts | `quotaRemaining`/`quotaEntitlement` come from API; without fetch they default to 300 entitlement with counts derived from usage % |
| Calculations incorrect | Check that usage % and day inputs are valid numbers (1–31 for day) |
| Day shows yesterday | Page was loaded on the previous day — refresh |
| Perfect pace target doesn't change with days-off | Expected: it's working-days-aware, so toggling weekends/calendar offs does shift it |
| XSS via user data | All user-supplied strings rendered via `escHtml()` before innerHTML injection |
