# Multi-Account Token Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-token auth system with a multi-account system that stores an unlimited number of GitHub tokens, caches per-account quota, and lets users switch accounts instantly via an animated card-stack header.

**Architecture:** A new `accounts.js` module manages the `gh_accounts` array and `gh_selected_id` localStorage keys. The existing `auth.js` is kept intact (backward compatibility) but its role shrinks to utility helpers (`escHtml`, `GH_API`). `main.js` is rewired to import from `accounts.js`. The header `#authCard` is replaced by a new `#accountsHeader` element with static controls and an animated card stack.

**Tech Stack:** Vanilla JS (ES2020+), CSS transitions, Vite, Vitest + jsdom

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/js/accounts.js` | Account CRUD, localStorage schema, UI rendering, switchAccount, modal form |
| Create | `src/tests/accounts.test.js` | Unit tests for accounts.js (no DOM) |
| Modify | `src/js/auth.js` | Keep escHtml, GH_API, GITHUB_ICON; deprecate token/user helpers |
| Modify | `src/js/main.js` | Rewire imports, replace fetchRealUsage token source, wire new events |
| Modify | `src/index.html` | Replace `#authCard` with `#accountsHeader`, add `#accountsModal` overlay |
| Modify | `src/style.css` | Add account header, card stack, animation, and modal multi-field CSS |

---

## Task 1: Scaffold `accounts.js` — localStorage read/write

**Files:**
- Create: `src/js/accounts.js`
- Create: `src/tests/accounts.test.js`

- [ ] **Step 1: Write failing tests for `getAccounts`, `getSelectedId`, `saveAccounts`, `saveSelectedId`**

Create `src/tests/accounts.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAccounts, getSelectedId, saveAccounts, saveSelectedId,
  getSelectedAccount,
} from '../js/accounts.js';

beforeEach(() => {
  localStorage.clear();
});

describe('getAccounts', () => {
  it('returns empty array when nothing stored', () => {
    expect(getAccounts()).toEqual([]);
  });

  it('returns parsed array from localStorage', () => {
    const accounts = [{ id: '1', token: 'ghu_abc', login: 'alice', name: 'Alice', avatar_url: '', plan: null, lastQuota: null }];
    localStorage.setItem('gh_accounts', JSON.stringify(accounts));
    expect(getAccounts()).toEqual(accounts);
  });

  it('returns empty array on malformed JSON', () => {
    localStorage.setItem('gh_accounts', 'INVALID{JSON}');
    expect(getAccounts()).toEqual([]);
  });
});

describe('getSelectedId', () => {
  it('returns null when nothing stored', () => {
    expect(getSelectedId()).toBeNull();
  });

  it('returns stored string', () => {
    localStorage.setItem('gh_selected_id', 'acc-123');
    expect(getSelectedId()).toBe('acc-123');
  });
});

describe('getSelectedAccount', () => {
  it('returns null when no accounts', () => {
    expect(getSelectedAccount()).toBeNull();
  });

  it('returns account matching selected id', () => {
    const a = { id: 'a1', token: 'ghu_x', login: 'bob', name: '', avatar_url: '', plan: null, lastQuota: null };
    const b = { id: 'a2', token: 'ghu_y', login: 'carol', name: '', avatar_url: '', plan: null, lastQuota: null };
    localStorage.setItem('gh_accounts', JSON.stringify([a, b]));
    localStorage.setItem('gh_selected_id', 'a2');
    expect(getSelectedAccount()).toEqual(b);
  });

  it('falls back to first account if selected id is missing', () => {
    const a = { id: 'a1', token: 'ghu_x', login: 'bob', name: '', avatar_url: '', plan: null, lastQuota: null };
    localStorage.setItem('gh_accounts', JSON.stringify([a]));
    localStorage.setItem('gh_selected_id', 'MISSING_ID');
    expect(getSelectedAccount()).toEqual(a);
  });
});

describe('saveAccounts', () => {
  it('writes array to localStorage', () => {
    const accounts = [{ id: '1', token: 'ghu_abc', login: 'alice', name: '', avatar_url: '', plan: null, lastQuota: null }];
    saveAccounts(accounts);
    expect(JSON.parse(localStorage.getItem('gh_accounts'))).toEqual(accounts);
  });
});

describe('saveSelectedId', () => {
  it('writes id to localStorage', () => {
    saveSelectedId('xyz');
    expect(localStorage.getItem('gh_selected_id')).toBe('xyz');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose 2>&1 | head -30
```

Expected: `Cannot find module '../js/accounts.js'`

- [ ] **Step 3: Create `src/js/accounts.js` with storage functions**

```js
export const GH_ACCOUNTS_KEY  = 'gh_accounts';
export const GH_SELECTED_KEY  = 'gh_selected_id';

export function getAccounts() {
  try {
    return JSON.parse(localStorage.getItem(GH_ACCOUNTS_KEY) || '[]');
  } catch { return []; }
}

export function saveAccounts(accounts) {
  localStorage.setItem(GH_ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function getSelectedId() {
  return localStorage.getItem(GH_SELECTED_KEY);
}

export function saveSelectedId(id) {
  localStorage.setItem(GH_SELECTED_KEY, String(id));
}

export function getSelectedAccount() {
  const accounts = getAccounts();
  if (!accounts.length) return null;
  const id = getSelectedId();
  return accounts.find(a => a.id === id) ?? accounts[0];
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose 2>&1 | head -30
```

Expected: all 8 tests in `accounts.test.js` PASS

- [ ] **Step 5: Commit**

```bash
git add src/js/accounts.js src/tests/accounts.test.js
git commit -m "feat: scaffold accounts.js with localStorage read/write"
```

---

## Task 2: Account CRUD — add, remove, signOutAll

**Files:**
- Modify: `src/js/accounts.js`
- Modify: `src/tests/accounts.test.js`

- [ ] **Step 1: Write failing tests for `addAccountObject`, `removeAccount`, `signOutAll`**

Append to `src/tests/accounts.test.js`:

```js
import {
  getAccounts, getSelectedId, saveAccounts, saveSelectedId,
  getSelectedAccount, addAccountObject, removeAccount, signOutAll,
} from '../js/accounts.js';

describe('addAccountObject', () => {
  it('adds an account to the list', () => {
    const acct = { id: 'a1', token: 'ghu_x', login: 'alice', name: 'Alice', avatar_url: '', plan: null, lastQuota: null };
    addAccountObject(acct);
    expect(getAccounts()).toEqual([acct]);
  });

  it('does not add duplicate tokens', () => {
    const a = { id: 'a1', token: 'ghu_dup', login: 'alice', name: '', avatar_url: '', plan: null, lastQuota: null };
    addAccountObject(a);
    addAccountObject({ ...a, id: 'a2' });
    expect(getAccounts()).toHaveLength(1);
  });

  it('selects first account when none previously selected', () => {
    const a = { id: 'a1', token: 'ghu_x', login: 'alice', name: '', avatar_url: '', plan: null, lastQuota: null };
    addAccountObject(a);
    expect(getSelectedId()).toBe('a1');
  });

  it('keeps existing selection when adding a second account', () => {
    const a = { id: 'a1', token: 'ghu_x', login: 'alice', name: '', avatar_url: '', plan: null, lastQuota: null };
    const b = { id: 'a2', token: 'ghu_y', login: 'bob', name: '', avatar_url: '', plan: null, lastQuota: null };
    addAccountObject(a);
    addAccountObject(b);
    expect(getSelectedId()).toBe('a1');
  });
});

describe('removeAccount', () => {
  it('removes account by id', () => {
    const a = { id: 'a1', token: 'ghu_x', login: 'alice', name: '', avatar_url: '', plan: null, lastQuota: null };
    const b = { id: 'a2', token: 'ghu_y', login: 'bob', name: '', avatar_url: '', plan: null, lastQuota: null };
    saveAccounts([a, b]);
    removeAccount('a1');
    expect(getAccounts()).toEqual([b]);
  });

  it('shifts selection to next account when selected is removed', () => {
    const a = { id: 'a1', token: 'ghu_x', login: 'alice', name: '', avatar_url: '', plan: null, lastQuota: null };
    const b = { id: 'a2', token: 'ghu_y', login: 'bob', name: '', avatar_url: '', plan: null, lastQuota: null };
    saveAccounts([a, b]);
    saveSelectedId('a1');
    removeAccount('a1');
    expect(getSelectedId()).toBe('a2');
  });

  it('clears selection when last account is removed', () => {
    const a = { id: 'a1', token: 'ghu_x', login: 'alice', name: '', avatar_url: '', plan: null, lastQuota: null };
    saveAccounts([a]);
    saveSelectedId('a1');
    removeAccount('a1');
    expect(getAccounts()).toEqual([]);
    expect(getSelectedId()).toBeNull();
  });
});

describe('signOutAll', () => {
  it('removes all accounts and selection from localStorage', () => {
    saveAccounts([{ id: 'a1', token: 'ghu_x', login: 'a', name: '', avatar_url: '', plan: null, lastQuota: null }]);
    saveSelectedId('a1');
    signOutAll();
    expect(getAccounts()).toEqual([]);
    expect(getSelectedId()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm new ones fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|accounts"
```

Expected: new tests fail with `addAccountObject is not a function`

- [ ] **Step 3: Implement `addAccountObject`, `removeAccount`, `signOutAll` in `accounts.js`**

Append to `src/js/accounts.js`:

```js
export function addAccountObject(account) {
  const accounts = getAccounts();
  // No duplicate tokens
  if (accounts.some(a => a.token === account.token)) return;
  accounts.push(account);
  saveAccounts(accounts);
  // Select first account if nothing is selected
  if (!getSelectedId()) saveSelectedId(account.id);
}

export function removeAccount(id) {
  const accounts = getAccounts();
  const idx = accounts.findIndex(a => a.id === id);
  if (idx === -1) return;
  const wasSelected = getSelectedId() === id;
  accounts.splice(idx, 1);
  saveAccounts(accounts);
  if (wasSelected) {
    const next = accounts[idx] ?? accounts[idx - 1] ?? null;
    if (next) saveSelectedId(next.id);
    else localStorage.removeItem(GH_SELECTED_KEY);
  }
}

export function signOutAll() {
  localStorage.removeItem(GH_ACCOUNTS_KEY);
  localStorage.removeItem(GH_SELECTED_KEY);
}
```

- [ ] **Step 4: Run all tests to confirm they pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|✓|✗"
```

Expected: all `accounts.test.js` tests PASS, no regressions in other test files

- [ ] **Step 5: Commit**

```bash
git add src/js/accounts.js src/tests/accounts.test.js
git commit -m "feat: account CRUD — add, remove, signOutAll"
```

---

## Task 3: Account token validation and `addAccounts(tokenArray)`

**Files:**
- Modify: `src/js/accounts.js`
- Modify: `src/tests/accounts.test.js`

This task implements `addAccounts(tokenArray)` which validates token formats, fetches `/user` for each, creates account objects, and calls `addAccountObject`. This function calls `fetch` — tests mock it.

- [ ] **Step 1: Write failing tests for `validateTokenFormat` and `addAccounts`**

Append to `src/tests/accounts.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAccounts, addAccounts, validateTokenFormat,
} from '../js/accounts.js';

describe('validateTokenFormat', () => {
  it('accepts ghu_ tokens', () => expect(validateTokenFormat('ghu_abc123')).toBe(true));
  it('accepts ghp_ tokens', () => expect(validateTokenFormat('ghp_abc123')).toBe(true));
  it('accepts github_pat_ tokens', () => expect(validateTokenFormat('github_pat_abc123')).toBe(true));
  it('accepts gho_ tokens', () => expect(validateTokenFormat('gho_abc123')).toBe(true));
  it('rejects empty string', () => expect(validateTokenFormat('')).toBe(false));
  it('rejects random string', () => expect(validateTokenFormat('notavalidtoken')).toBe(false));
  it('rejects partial prefix', () => expect(validateTokenFormat('ghu_')).toBe(false));
});

describe('addAccounts', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('adds a valid token and returns added count', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ login: 'alice', name: 'Alice', avatar_url: 'https://example.com/a.png' }),
    })));
    const result = await addAccounts(['ghu_abc123XYZ']);
    expect(result.added).toBe(1);
    expect(result.failed).toHaveLength(0);
    expect(getAccounts()).toHaveLength(1);
    expect(getAccounts()[0].login).toBe('alice');
  });

  it('skips tokens with invalid format', async () => {
    const result = await addAccounts(['notvalidtoken']);
    expect(result.added).toBe(0);
    expect(result.failed[0]).toMatchObject({ token: 'notvalidtoken', reason: expect.stringContaining('format') });
  });

  it('reports failure if API returns 401', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: false, status: 401,
    })));
    const result = await addAccounts(['ghu_badtoken123']);
    expect(result.added).toBe(0);
    expect(result.failed[0].reason).toContain('401');
  });

  it('skips blank tokens silently', async () => {
    const result = await addAccounts(['', '   ']);
    expect(result.added).toBe(0);
    expect(result.failed).toHaveLength(0);
  });

  it('adds multiple valid tokens', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ login: 'alice', name: '', avatar_url: '' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ login: 'bob', name: '', avatar_url: '' }) }),
    );
    const result = await addAccounts(['ghu_token1xxxxx', 'ghu_token2xxxxx']);
    expect(result.added).toBe(2);
    expect(getAccounts()).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to confirm new ones fail**

```bash
npm test -- --reporter=verbose src/tests/accounts.test.js 2>&1 | grep -E "FAIL|PASS|×|✓" | head -20
```

Expected: new tests fail with `validateTokenFormat is not a function`

- [ ] **Step 3: Implement `validateTokenFormat` and `addAccounts` in `accounts.js`**

Append to `src/js/accounts.js`:

```js
export const GH_API = 'https://api.github.com';

export function validateTokenFormat(token) {
  return /^(ghp_|github_pat_|gho_|ghu_)[A-Za-z0-9_]{5,}$/.test(token);
}

export async function addAccounts(tokenArray) {
  const added = [];
  const failed = [];

  for (const raw of tokenArray) {
    const token = raw.trim();
    if (!token) continue;  // skip blank
    if (!validateTokenFormat(token)) {
      failed.push({ token, reason: 'Invalid token format — must start with ghp_, ghu_, gho_, or github_pat_' });
      continue;
    }
    try {
      const res = await fetch(`${GH_API}/user`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' },
      });
      if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
      const user = await res.json();
      const account = {
        id: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        token,
        login: user.login,
        name: user.name || '',
        avatar_url: user.avatar_url || '',
        plan: null,
        lastQuota: null,
      };
      addAccountObject(account);
      added.push(account);
    } catch (e) {
      failed.push({ token, reason: e.message });
    }
  }

  return { added: added.length, failed };
}
```

- [ ] **Step 4: Run all tests to confirm they pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|×|✓"
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/js/accounts.js src/tests/accounts.test.js
git commit -m "feat: addAccounts — token validation and batch GitHub user fetch"
```

---

## Task 4: `updateAccountQuota` and legacy migration

**Files:**
- Modify: `src/js/accounts.js`
- Modify: `src/tests/accounts.test.js`

- [ ] **Step 1: Write failing tests**

Append to `src/tests/accounts.test.js`:

```js
import { updateAccountQuota, migrateFromLegacy, getAccounts, getSelectedId } from '../js/accounts.js';

describe('updateAccountQuota', () => {
  it('saves lastQuota on the matching account', () => {
    const a = { id: 'a1', token: 'ghu_x', login: 'alice', name: '', avatar_url: '', plan: 'business', lastQuota: null };
    saveAccounts([a]);
    const quota = { pctUsed: 42, entitlement: 300, remaining: 174, resetDate: '2026-05-01', unlimited: false, timestamp: 1000 };
    updateAccountQuota('a1', quota);
    expect(getAccounts()[0].lastQuota).toEqual(quota);
  });

  it('does nothing for unknown id', () => {
    const a = { id: 'a1', token: 'ghu_x', login: 'alice', name: '', avatar_url: '', plan: null, lastQuota: null };
    saveAccounts([a]);
    updateAccountQuota('MISSING', { pctUsed: 99 });
    expect(getAccounts()[0].lastQuota).toBeNull();
  });
});

describe('migrateFromLegacy', () => {
  it('migrates old gh_token and gh_user into gh_accounts', () => {
    localStorage.setItem('gh_token', 'ghu_oldtoken123');
    localStorage.setItem('gh_user', JSON.stringify({ login: 'alice', name: 'Alice', avatar_url: 'https://example.com/a.png' }));
    migrateFromLegacy();
    const accounts = getAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].token).toBe('ghu_oldtoken123');
    expect(accounts[0].login).toBe('alice');
    expect(localStorage.getItem('gh_token')).toBeNull();
    expect(localStorage.getItem('gh_user')).toBeNull();
  });

  it('does nothing if gh_accounts already exists', () => {
    const a = { id: 'a1', token: 'ghu_x', login: 'alice', name: '', avatar_url: '', plan: null, lastQuota: null };
    saveAccounts([a]);
    localStorage.setItem('gh_token', 'ghu_old');
    migrateFromLegacy();
    expect(getAccounts()).toHaveLength(1); // not duplicated
  });

  it('does nothing if no legacy keys', () => {
    migrateFromLegacy();
    expect(getAccounts()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to confirm new ones fail**

```bash
npm test -- --reporter=verbose src/tests/accounts.test.js 2>&1 | grep -E "FAIL|×" | head -10
```

Expected: `updateAccountQuota is not a function`, `migrateFromLegacy is not a function`

- [ ] **Step 3: Implement `updateAccountQuota` and `migrateFromLegacy`**

Append to `src/js/accounts.js`:

```js
export function updateAccountQuota(id, quota) {
  const accounts = getAccounts();
  const account = accounts.find(a => a.id === id);
  if (!account) return;
  account.lastQuota = quota;
  saveAccounts(accounts);
}

export function migrateFromLegacy() {
  // Only migrate if gh_accounts doesn't exist yet
  if (localStorage.getItem(GH_ACCOUNTS_KEY)) return;
  const token = localStorage.getItem('gh_token');
  const userJson = localStorage.getItem('gh_user');
  if (!token || !userJson) return;
  try {
    const user = JSON.parse(userJson);
    addAccountObject({
      id: `acc-${Date.now()}-legacy`,
      token,
      login: user.login || '',
      name: user.name || '',
      avatar_url: user.avatar_url || '',
      plan: null,
      lastQuota: null,
    });
    localStorage.removeItem('gh_token');
    localStorage.removeItem('gh_user');
  } catch { /* ignore malformed legacy data */ }
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS"
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/js/accounts.js src/tests/accounts.test.js
git commit -m "feat: updateAccountQuota + legacy migration from gh_token/gh_user"
```

---

## Task 5: `getSelectedToken`, `ghHeaders`, `getNextAccountId`

**Files:**
- Modify: `src/js/accounts.js`
- Modify: `src/tests/accounts.test.js`

- [ ] **Step 1: Write failing tests**

Append to `src/tests/accounts.test.js`:

```js
import { getSelectedToken, ghHeaders as accountGhHeaders, getNextAccountId } from '../js/accounts.js';

describe('getSelectedToken', () => {
  it('returns null when no accounts', () => {
    expect(getSelectedToken()).toBeNull();
  });

  it('returns token of selected account', () => {
    const a = { id: 'a1', token: 'ghu_selected', login: 'alice', name: '', avatar_url: '', plan: null, lastQuota: null };
    saveAccounts([a]);
    saveSelectedId('a1');
    expect(getSelectedToken()).toBe('ghu_selected');
  });
});

describe('accountGhHeaders', () => {
  it('uses selected account token', () => {
    const a = { id: 'a1', token: 'ghu_mytoken', login: 'alice', name: '', avatar_url: '', plan: null, lastQuota: null };
    saveAccounts([a]);
    saveSelectedId('a1');
    const h = accountGhHeaders();
    expect(h['Authorization']).toBe('Bearer ghu_mytoken');
    expect(h['Accept']).toBe('application/vnd.github+json');
    expect(h['X-GitHub-Api-Version']).toBe('2022-11-28');
  });
});

describe('getNextAccountId', () => {
  it('returns null when no accounts', () => {
    expect(getNextAccountId('any', 1)).toBeNull();
  });

  it('returns next account id in direction +1', () => {
    const a = { id: 'a1', token: 'ghu_x', login: 'alice', name: '', avatar_url: '', plan: null, lastQuota: null };
    const b = { id: 'a2', token: 'ghu_y', login: 'bob', name: '', avatar_url: '', plan: null, lastQuota: null };
    saveAccounts([a, b]);
    expect(getNextAccountId('a1', 1)).toBe('a2');
  });

  it('wraps around at end (direction +1)', () => {
    const a = { id: 'a1', token: 'ghu_x', login: 'alice', name: '', avatar_url: '', plan: null, lastQuota: null };
    const b = { id: 'a2', token: 'ghu_y', login: 'bob', name: '', avatar_url: '', plan: null, lastQuota: null };
    saveAccounts([a, b]);
    expect(getNextAccountId('a2', 1)).toBe('a1');
  });

  it('wraps around at start (direction -1)', () => {
    const a = { id: 'a1', token: 'ghu_x', login: 'alice', name: '', avatar_url: '', plan: null, lastQuota: null };
    const b = { id: 'a2', token: 'ghu_y', login: 'bob', name: '', avatar_url: '', plan: null, lastQuota: null };
    saveAccounts([a, b]);
    expect(getNextAccountId('a1', -1)).toBe('a2');
  });
});
```

- [ ] **Step 2: Run tests to confirm new ones fail**

```bash
npm test -- --reporter=verbose src/tests/accounts.test.js 2>&1 | grep -E "FAIL|×" | head -10
```

- [ ] **Step 3: Implement helpers in `accounts.js`**

Append to `src/js/accounts.js`:

```js
export function getSelectedToken() {
  return getSelectedAccount()?.token ?? null;
}

export function ghHeaders() {
  return {
    'Authorization': `Bearer ${getSelectedToken()}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export function getNextAccountId(currentId, direction) {
  const accounts = getAccounts();
  if (!accounts.length) return null;
  const idx = accounts.findIndex(a => a.id === currentId);
  const nextIdx = (idx + direction + accounts.length) % accounts.length;
  return accounts[nextIdx].id;
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS"
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/js/accounts.js src/tests/accounts.test.js
git commit -m "feat: getSelectedToken, ghHeaders, getNextAccountId"
```

---

## Task 6: Header HTML + CSS — static section and empty state

**Files:**
- Modify: `src/index.html`
- Modify: `src/style.css`

- [ ] **Step 1: Replace `#authCard` with `#accountsHeader` in `index.html`**

In `src/index.html`, replace:

```html
  <!-- ─── GITHUB AUTH ─────────────────────────────────── -->
  <div class="card mb16" id="authCard">
    <!-- rendered by renderAuthCard() -->
  </div>
```

With:

```html
  <!-- ─── ACCOUNTS HEADER ──────────────────────────────── -->
  <div class="accounts-header mb16" id="accountsHeader">
    <!-- rendered by renderAccountsHeader() in accounts.js -->
  </div>
```

- [ ] **Step 2: Add CSS for `accounts-header` and empty state in `style.css`**

Append to `src/style.css` (before the last closing `</style>` or at the end of the file):

```css
/* ─── Accounts Header ──────────────────────────────────── */
.accounts-header {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px 20px;
  min-height: 72px;
}

.accounts-static {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  flex: 1;
}

.accounts-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}

.accounts-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.nav-arrow {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
  line-height: 1;
  transition: border-color 0.15s, color 0.15s;
}
.nav-arrow:hover { border-color: var(--blue); color: var(--blue); }

/* ─── Account Card Stack ────────────────────────────────── */
.accounts-dynamic {
  position: relative;
  width: 220px;
  flex-shrink: 0;
}

.account-card-stack {
  position: relative;
  height: 56px;
}

.account-card {
  position: absolute;
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.account-card.selected {
  position: relative;
  z-index: 3;
  opacity: 1;
  transform: translateY(0);
  background: var(--tag-bg);
  border-color: var(--border);
}

.account-card.peek-1 {
  z-index: 2;
  opacity: 0.45;
  transform: translateY(6px) scale(0.97);
  pointer-events: none;
}

.account-card.peek-2 {
  z-index: 1;
  opacity: 0.22;
  transform: translateY(11px) scale(0.94);
  pointer-events: none;
}

.account-card-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.account-card-avatar-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--tag-bg);
  border: 1px solid var(--border);
  flex-shrink: 0;
}

.account-card-info {
  flex: 1;
  min-width: 0;
}

.account-card-login {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-card-plan {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-card-remove {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 14px;
  padding: 2px 4px;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
  flex-shrink: 0;
}
.account-card:hover .account-card-remove,
.account-card-remove:focus { opacity: 1; }
.account-card-remove:hover { color: var(--red); }

/* ─── Token Modal multi-field ───────────────────────────── */
.token-fields { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
.token-field-row { display: flex; gap: 6px; align-items: center; }
.token-field-row input { flex: 1; }
.token-field-remove {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--muted);
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
  flex-shrink: 0;
}
.token-field-remove:hover { border-color: var(--red); color: var(--red); }

.btn-add-field {
  background: none;
  border: 1px dashed var(--border);
  border-radius: 6px;
  color: var(--muted);
  cursor: pointer;
  font-size: 13px;
  padding: 6px 12px;
  width: 100%;
  transition: border-color 0.15s, color 0.15s;
}
.btn-add-field:hover { border-color: var(--blue); color: var(--blue); }

/* ─── Toast notification ────────────────────────────────── */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(80px);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 18px;
  font-size: 13px;
  z-index: 9999;
  opacity: 0;
  transition: transform 0.25s ease, opacity 0.25s ease;
  max-width: 420px;
  text-align: center;
  pointer-events: none;
}
.toast.toast-visible {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}
.toast.toast-error { border-color: rgba(218,54,51,0.5); color: var(--red); }

@media (max-width: 640px) {
  .accounts-header { flex-direction: column; }
  .accounts-dynamic { width: 100%; }
}
```

- [ ] **Step 3: Build to verify no CSS/HTML errors**

```bash
npm run build 2>&1 | tail -10
```

Expected: build exits 0

- [ ] **Step 4: Commit**

```bash
git add src/index.html src/style.css
git commit -m "feat: accounts header HTML + CSS (card stack, controls, modal fields, toast)"
```

---

## Task 7: `renderAccountsHeader` and `showToast`

**Files:**
- Modify: `src/js/accounts.js`

This renders the full header HTML into `#accountsHeader`. No unit tests for rendering (DOM-heavy). Test by building and checking in browser in Task 10.

- [ ] **Step 1: Implement `showToast` in `accounts.js`**

Append to `src/js/accounts.js`:

```js
let _toastTimer = null;

export function showToast(msg, isError = false) {
  let el = document.getElementById('appToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'appToast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.toggle('toast-error', isError);
  el.classList.add('toast-visible');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('toast-visible'), 3500);
}
```

- [ ] **Step 2: Implement `renderAccountsHeader` in `accounts.js`**

Append to `src/js/accounts.js`:

```js
import { escHtml } from './auth.js';

export function renderAccountsHeader() {
  const container = document.getElementById('accountsHeader');
  if (!container) return;
  const accounts = getAccounts();

  if (!accounts.length) {
    container.innerHTML = `
      <div class="d-flex jc-between ai-center flex-wrap gap-12" style="width:100%">
        <div>
          <div class="fw-600 mb-3">Connect GitHub token (optional)</div>
          <div class="fs-12 muted">Add a token to auto-fetch your quota from GitHub.</div>
        </div>
        <div>
          <button class="auth-btn auth-btn-primary" onclick="openAccountsModal()">
            <svg height="15" viewBox="0 0 16 16" fill="currentColor" style="vertical-align:-2px"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            Connect token
          </button>
        </div>
      </div>`;
    return;
  }

  const count = accounts.length;
  const multi = count > 1;
  const selected = getSelectedAccount();

  // Build card stack (selected + up to 2 peek cards)
  const selectedIdx = accounts.findIndex(a => a.id === selected?.id);
  const peekAccounts = multi
    ? [
        accounts[(selectedIdx + 1) % count],
        count > 2 ? accounts[(selectedIdx + 2) % count] : null,
      ].filter(Boolean)
    : [];

  function cardHtml(account, role) {
    const removeBtn = (role === 'selected' && multi) ? `
      <button class="account-card-remove" onclick="removeAccountAndRender('${escHtml(account.id)}')" title="Remove account" aria-label="Remove ${escHtml(account.login)}">✕</button>
    ` : '';
    const planLabel = account.plan ? escHtml(account.plan) + ' plan' : 'plan unknown';
    const avatarEl = account.avatar_url
      ? `<img src="${escHtml(account.avatar_url)}" alt="" class="account-card-avatar" loading="lazy" />`
      : `<div class="account-card-avatar-placeholder"></div>`;
    return `
      <div class="account-card ${role}">
        ${avatarEl}
        <div class="account-card-info">
          <div class="account-card-login">@${escHtml(account.login)}</div>
          <div class="account-card-plan">${planLabel}</div>
        </div>
        ${removeBtn}
      </div>`;
  }

  const peekHtml = peekAccounts
    .map((a, i) => cardHtml(a, i === 0 ? 'peek-1' : 'peek-2'))
    .join('');

  const arrowsHtml = multi ? `
    <button class="nav-arrow" onclick="navigateAccount(-1)" title="Previous account">↑</button>
    <button class="nav-arrow" onclick="navigateAccount(1)" title="Next account">↓</button>
  ` : '';

  const countLabel = count === 1 ? '1 account connected' : `${count} accounts connected`;

  container.innerHTML = `
    <div class="accounts-static">
      <div class="accounts-label">${countLabel}</div>
      <div class="accounts-controls">
        ${arrowsHtml}
        <button class="auth-btn" onclick="openAccountsModal()">+ Add account</button>
        <button class="auth-btn auth-btn-danger" onclick="signOutAllAndRender()">Sign out all</button>
      </div>
    </div>
    <div class="accounts-dynamic">
      <div class="account-card-stack">
        ${peekHtml}
        ${selected ? cardHtml(selected, 'selected') : ''}
      </div>
    </div>`;
}
```

- [ ] **Step 3: Implement `openAccountsModal`, `closeAccountsModal`, `_addTokenField`, `_removeTokenField`, `_submitTokens`**

Append to `src/js/accounts.js`:

```js
export function openAccountsModal() {
  const content = document.getElementById('modalContent');
  const modal = document.getElementById('authModal');
  if (!content || !modal) return;
  content.innerHTML = _tokenModalHtml();
  modal.classList.add('open');
}

export function closeAccountsModal() {
  document.getElementById('authModal')?.classList.remove('open');
}

function _tokenModalHtml() {
  return `
    <h3>Add GitHub Token(s)</h3>
    <p class="modal-sub">Tokens are stored only in this browser and sent directly to <code>api.github.com</code> — never to any third party.</p>
    <div id="tokenModalErr" class="auth-error"></div>
    <div class="info-box" style="margin-bottom:16px">
      <strong>How to get a <code>ghu_</code> token from VS Code</strong><br><br>
      <div class="step-row"><span class="step-num">1</span><div>Press <code>F1</code> → <strong>Toggle Developer Tools</strong> → Network tab</div></div>
      <div class="step-row"><span class="step-num">2</span><div>Filter by <code>copilot_internal</code>, tick <strong>Preserve log</strong></div></div>
      <div class="step-row"><span class="step-num">3</span><div>Send any Copilot Chat message (<code>Ctrl+Alt+I</code>) — a <code>user</code> row appears</div></div>
      <div class="step-row"><span class="step-num">4</span><div>Click that row → Request Headers → copy value after <code>Authorization: token </code></div></div>
      <div class="step-row"><span class="step-num">5</span><div>Starts with <code>ghu_</code> — paste it below</div></div>
    </div>
    <label>Token(s)</label>
    <div class="token-fields" id="tokenFields">
      <div class="token-field-row">
        <input type="password" placeholder="ghx_…" autocomplete="new-password" class="token-input" />
      </div>
    </div>
    <button class="btn-add-field" onclick="_addTokenField()">＋ Add another token</button>
    <div class="modal-row" style="margin-top:16px">
      <button class="auth-btn" onclick="closeAccountsModal()">Cancel</button>
      <button class="auth-btn auth-btn-primary" id="tokenSubmitBtn" onclick="_submitTokens()">Add account(s)</button>
    </div>`;
}

export function _addTokenField() {
  const fields = document.getElementById('tokenFields');
  if (!fields) return;
  const row = document.createElement('div');
  row.className = 'token-field-row';
  row.innerHTML = `
    <input type="password" placeholder="ghx_…" autocomplete="new-password" class="token-input" />
    <button class="token-field-remove" onclick="this.closest('.token-field-row').remove()" title="Remove field">✕</button>`;
  fields.appendChild(row);
  row.querySelector('input').focus();
}

export async function _submitTokens() {
  const fields = document.getElementById('tokenFields');
  const btn = document.getElementById('tokenSubmitBtn');
  const errEl = document.getElementById('tokenModalErr');
  if (!fields || !btn) return;

  const tokens = Array.from(fields.querySelectorAll('.token-input')).map(i => i.value.trim()).filter(Boolean);
  if (!tokens.length) {
    if (errEl) { errEl.textContent = 'Please enter at least one token'; errEl.style.display = 'block'; }
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Adding…';
  if (errEl) errEl.style.display = 'none';

  try {
    const result = await addAccounts(tokens);
    if (result.failed.length) {
      const msgs = result.failed.map(f => `${f.token.slice(0, 12)}…: ${f.reason}`).join('\n');
      if (errEl) { errEl.textContent = msgs; errEl.style.display = 'block'; }
    }
    if (result.added > 0) {
      closeAccountsModal();
      renderAccountsHeader();
      window.dispatchEvent(new CustomEvent('account:switched'));
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Add account(s)';
  }
}
```

- [ ] **Step 4: Implement `navigateAccount`, `removeAccountAndRender`, `signOutAllAndRender`**

Append to `src/js/accounts.js`:

```js
export function navigateAccount(direction) {
  const current = getSelectedAccount();
  if (!current) return;
  const nextId = getNextAccountId(current.id, direction);
  if (!nextId || nextId === current.id) return;
  window.dispatchEvent(new CustomEvent('account:switch-requested', { detail: { id: nextId, previousId: current.id } }));
}

export function removeAccountAndRender(id) {
  const wasSelected = getSelectedId() === id;
  removeAccount(id);
  renderAccountsHeader();
  if (wasSelected) {
    window.dispatchEvent(new CustomEvent('account:switched'));
  }
}

export function signOutAllAndRender() {
  signOutAll();
  renderAccountsHeader();
  window.dispatchEvent(new CustomEvent('account:signed-out'));
}
```

- [ ] **Step 5: Commit**

```bash
git add src/js/accounts.js
git commit -m "feat: renderAccountsHeader, modal multi-field form, navigation, toast"
```

---

## Task 8: Wire `accounts.js` into `main.js`

**Files:**
- Modify: `src/js/main.js`

This task replaces auth imports with accounts imports and handles the new `account:switch-requested` / `account:switched` / `account:signed-out` events.

- [ ] **Step 1: Replace imports and window assignments in `main.js`**

In `src/js/main.js`, replace the top import block and `Object.assign(window, ...)`:

```js
import {
  getSelectedToken, ghHeaders, renderAccountsHeader,
  openAccountsModal, closeAccountsModal, signOutAllAndRender,
  _addTokenField, _submitTokens, navigateAccount, removeAccountAndRender,
  migrateFromLegacy, updateAccountQuota, getSelectedAccount, showToast,
} from './accounts.js';
import { escHtml, GH_API } from './auth.js';
import {
  openCalendar, closeCalendar, calNavMonth, calToggleDay, clearCustomDayoffs,
  onWeekendsToggle, onCalWeekendsToggle, setCalView,
} from './calendar.js';
import { syncUsage, syncUsageFromInput, updateStatus, renderAllMonths, stepNum, fmt1 } from './uiHelpers.js';
import { state } from './state.js';

Object.assign(window, {
  syncUsage, syncUsageFromInput, updateStatus, stepNum,
  openCalendar, closeCalendar, calNavMonth, calToggleDay, clearCustomDayoffs,
  onWeekendsToggle, onCalWeekendsToggle,
  openAccountsModal, closeAccountsModal, signOutAllAndRender,
  _addTokenField, _submitTokens, navigateAccount, removeAccountAndRender,
  fetchRealUsage, onMonthLenChange,
});
```

- [ ] **Step 2: Update `fetchRealUsage` to use `getSelectedToken` and `getSelectedAccount`**

In `src/js/main.js`, replace the `fetchRealUsage` function:

```js
export async function fetchRealUsage() {
  const token = getSelectedToken();
  if (!token) {
    _setFetchStatus('No token — click "Connect token" above', 'var(--muted)');
    openAccountsModal();
    return;
  }

  const btn = document.getElementById('fetchBtn');
  btn.disabled = true;
  btn.textContent = 'Fetching…';
  _setFetchStatus('⏳ Fetching quota from GitHub…', 'var(--blue)');

  const account = getSelectedAccount();

  try {
    const res = await fetch(`${GH_API}/copilot_internal/user`, {
      headers: { ...ghHeaders(), 'X-GitHub-Api-Version': '2025-04-01' },
    });

    if (res.status === 404 || res.status === 403) {
      const userRes = await fetch(`${GH_API}/user`, { headers: ghHeaders() });
      if (!userRes.ok) throw new Error(`Token invalid (${userRes.status}). Remove this account and reconnect.`);
      const fallbackUser = await userRes.json();
      _setFetchStatus(
        `✓ Token valid for @${escHtml(fallbackUser.login)} · Real quota % needs a ghu_ OAuth token`,
        'var(--blue)',
      );
      return;
    }

    if (!res.ok) {
      if (res.status === 401) throw new Error('Token invalid or expired (401). Remove this account and reconnect.');
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
      if (account) {
        account.plan = plan || account.plan;
        updateAccountQuota(account.id, {
          pctUsed,
          entitlement: pi.entitlement,
          remaining: pi.remaining,
          resetDate: data.quota_reset_date,
          unlimited: !!pi.unlimited,
          timestamp: Math.floor(Date.now() / 1000),
        });
        renderAccountsHeader();
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
      if (account) {
        updateAccountQuota(account.id, {
          pctUsed, entitlement: chat.entitlement, remaining: chat.remaining,
          resetDate: data.quota_reset_date, unlimited: false,
          timestamp: Math.floor(Date.now() / 1000),
        });
        renderAccountsHeader();
      }
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
```

Add `_setFetchStatus` import from auth (it stays in auth.js for now). Add this import alongside the existing auth imports:

```js
import { escHtml, GH_API, _setFetchStatus } from './auth.js';
```

- [ ] **Step 3: Update `DOMContentLoaded` handler to use accounts**

In `src/js/main.js`, replace the content of the existing `DOMContentLoaded` listener:

```js
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

  // Migrate legacy gh_token / gh_user keys if present
  migrateFromLegacy();

  // Close popups on Escape
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('calOverlay').classList.contains('open')) closeCalendar();
    if (document.getElementById('authModal').classList.contains('open')) closeAccountsModal();
  });

  // React to calendar changes
  window.addEventListener('calendar:closed', updateStatus);
  window.addEventListener('calendar:dayoff-changed', updateStatus);
  window.addEventListener('calendar:weekends-changed', updateStatus);

  // Switch account: load cached quota into calculator, then refresh in bg
  window.addEventListener('account:switch-requested', async (e) => {
    const { id, previousId } = e.detail;
    const accounts = (await import('./accounts.js')).getAccounts();
    const target = accounts.find(a => a.id === id);
    if (!target) return;

    // Update selection
    const { saveSelectedId } = await import('./accounts.js');
    saveSelectedId(id);
    renderAccountsHeader();

    // Load cached quota immediately
    if (target.lastQuota) {
      const q = target.lastQuota;
      state.quotaEntitlement = q.entitlement ?? state.quotaEntitlement;
      state.quotaRemaining   = q.remaining ?? null;
      document.getElementById('usageInput').value  = q.pctUsed.toFixed(1);
      document.getElementById('usageSlider').value = q.pctUsed;
      syncUsage(q.pctUsed);
    }

    // Fetch fresh in background
    try {
      await fetchRealUsage();
    } catch (err) {
      // revert to previous account on failure
      const { saveSelectedId: revert, showToast: toast } = await import('./accounts.js');
      revert(previousId);
      renderAccountsHeader();
      toast(`Failed to fetch for @${escHtml(target.login)} — staying on previous account`, true);
    }
  });

  // After adding new accounts, fetch for the newly selected one
  window.addEventListener('account:switched', fetchRealUsage);

  // After sign out, reset calculator to defaults
  window.addEventListener('account:signed-out', () => {
    state.quotaEntitlement = 300;
    state.quotaRemaining   = null;
    _setFetchStatus('', '');
    updateStatus();
  });

  renderAllMonths();
  updateStatus();
  renderAccountsHeader();
  // Auto-fetch on load (silent) if token saved
  fetchRealUsage().catch(() => {});
});
```

- [ ] **Step 4: Build to verify no errors**

```bash
npm run build 2>&1 | tail -15
```

Expected: build exits 0, no unresolved imports

- [ ] **Step 5: Run all tests**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS"
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/js/main.js
git commit -m "feat: wire accounts.js into main.js — fetch, switch, migrate, events"
```

---

## Task 9: Remove `#authCard` references and clean up `auth.js` exports

**Files:**
- Modify: `src/js/auth.js`

The old `renderAuthCard`, `openAuthModal`, `_savePAT`, `signOut` are no longer wired to window in `main.js`. Mark them deprecated but keep the file intact (tests import from it). Export `_setFetchStatus` explicitly so `main.js` can import it.

- [ ] **Step 1: Verify `_setFetchStatus` is already exported from `auth.js`**

```bash
grep "export function _setFetchStatus" src/js/auth.js
```

Expected: line found. If not, add `export` keyword.

- [ ] **Step 2: Build and run tests to verify no regressions**

```bash
npm run build 2>&1 | tail -5 && npm test 2>&1 | grep -E "FAIL|PASS"
```

Expected: build exits 0, all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/js/auth.js
git commit -m "chore: confirm auth.js _setFetchStatus export, mark legacy helpers deprecated"
```

---

## Task 10: Manual browser verification and smoke test

**Files:** None (verification only)

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open the URL printed in the terminal (usually `http://localhost:5173`).

- [ ] **Step 2: Test empty state**

- Page loads with "Connect GitHub token" button
- No header arrows, no card stack

- [ ] **Step 3: Test adding first account**

- Click "Connect token"
- Add a `ghu_` token
- Modal shows single field + "＋ Add another token" button
- After submit: header shows "1 account connected", card renders with avatar and plan

- [ ] **Step 4: Test adding second account**

- Click "+ Add account"
- Add a second `ghu_` token for a different account
- After submit: "2 accounts connected", arrow buttons ↑↓ appear, second card peeks below first

- [ ] **Step 5: Test switching accounts**

- Click ↓ arrow — card stack animates, second account rises to top
- Calculator re-populates with that account's quota (cached immediately; refreshed in background)

- [ ] **Step 6: Test remove account**

- Hover over selected card — ✕ button appears
- Click ✕ — account removed, next account becomes selected, fetch runs
- After removing all but one — arrows disappear, ✕ disappears from last card

- [ ] **Step 7: Test sign out all**

- Click "Sign out all" — all accounts removed, header reverts to "Connect token" state

- [ ] **Step 8: Test page refresh persistence**

- Add 2+ accounts, switch to account #2, refresh page
- Account #2 is still selected, quota auto-fetches

- [ ] **Step 9: Test legacy migration**

- In browser console: `localStorage.setItem('gh_token', 'ghu_exampletoken'); localStorage.setItem('gh_user', JSON.stringify({login:'alice',name:'Alice',avatar_url:''}))`
- Hard-refresh page
- Old keys migrated to `gh_accounts`, displayed in header, old keys removed
- Verify: `localStorage.getItem('gh_token')` → `null`

- [ ] **Step 10: Commit final build**

```bash
npm run build && git add -A && git commit -m "feat: multi-account token management — complete"
```

---

## Task 11: Update `copilot-instructions.md` auth storage docs

**Files:**
- Modify: `.github/copilot-instructions.md`

- [ ] **Step 1: Update the Auth Storage section to reflect new keys**

In `.github/copilot-instructions.md`, replace the Auth Storage table:

```markdown
### Auth Storage (localStorage)
| Key | Value |
|-----|-------|
| `gh_accounts` | JSON array of `{ id, token, login, name, avatar_url, plan, lastQuota }` account objects |
| `gh_selected_id` | String ID of the currently selected account |
```

Remove references to the old `gh_token` and `gh_user` keys (they are now only used during legacy migration on first load).

- [ ] **Step 2: Commit**

```bash
git add .github/copilot-instructions.md
git commit -m "docs: update auth storage section for multi-account schema"
```

---

## Done

All tasks complete when:
- All 40+ `accounts.test.js` tests pass
- No regressions in existing test files (`auth.test.js`, `budgetCalculator.test.js`, `calendar.test.js`, `uiHelpers.test.js`)
- Manual smoke test in browser passes all 9 steps
- `copilot-instructions.md` reflects new schema
