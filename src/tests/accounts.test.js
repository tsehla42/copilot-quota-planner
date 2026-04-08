import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAccounts, getSelectedId, saveAccounts, saveSelectedId,
  getSelectedAccount, addAccountObject, removeAccount, signOutAll,
  addAccounts, validateTokenFormat, updateAccountQuota, migrateFromLegacy,
  getSelectedToken, ghHeaders as accountGhHeaders, getNextAccountId,
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

  it('does not change selection when removing a non-selected account', () => {
    const a = { id: 'a1', token: 'ghu_x', login: 'alice', name: '', avatar_url: '', plan: null, lastQuota: null };
    const b = { id: 'a2', token: 'ghu_y', login: 'bob', name: '', avatar_url: '', plan: null, lastQuota: null };
    saveAccounts([a, b]);
    saveSelectedId('a2');
    removeAccount('a1');
    expect(getSelectedId()).toBe('a2');
  });

  it('falls back to previous account when last-position selected account is removed', () => {
    const a = { id: 'a1', token: 'ghu_x', login: 'alice', name: '', avatar_url: '', plan: null, lastQuota: null };
    const b = { id: 'a2', token: 'ghu_y', login: 'bob', name: '', avatar_url: '', plan: null, lastQuota: null };
    saveAccounts([a, b]);
    saveSelectedId('a2');
    removeAccount('a2');
    expect(getSelectedId()).toBe('a1');
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

  it('saves plan to account when provided', () => {
    const account = {
      id: 'acc-test-1', token: 'ghu_test', login: 'testuser',
      name: '', avatar_url: '', plan: null, lastQuota: null,
    };
    addAccountObject(account);
    updateAccountQuota('acc-test-1', { pctUsed: 50 }, 'copilot_business');
    const saved = getAccounts().find(a => a.id === 'acc-test-1');
    expect(saved.plan).toBe('copilot_business');
  });

  it('does not overwrite existing plan when plan param is null', () => {
    const account = {
      id: 'acc-test-2', token: 'ghu_test2', login: 'user2',
      name: '', avatar_url: '', plan: 'copilot_enterprise', lastQuota: null,
    };
    addAccountObject(account);
    updateAccountQuota('acc-test-2', { pctUsed: 30 }, null);
    const saved = getAccounts().find(a => a.id === 'acc-test-2');
    expect(saved.plan).toBe('copilot_enterprise');
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

  it('preserves legacy keys when gh_user is malformed JSON', () => {
    localStorage.setItem('gh_token', 'ghu_oldtoken123');
    localStorage.setItem('gh_user', 'NOT_JSON{{{');
    migrateFromLegacy();
    expect(getAccounts()).toEqual([]);
    expect(localStorage.getItem('gh_token')).toBe('ghu_oldtoken123');
  });
});

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

  it('returns null when currentId is not found in a non-empty list', () => {
    const a = { id: 'a1', token: 'ghu_x', login: 'alice', name: '', avatar_url: '', plan: null, lastQuota: null };
    saveAccounts([a]);
    expect(getNextAccountId('MISSING_ID', 1)).toBeNull();
  });
});

describe('peek card account assignment', () => {
  it('peek-1 shows the OTHER account with 2 accounts', () => {
    const accounts = [
      { id: 'a1', login: 'alice' },
      { id: 'a2', login: 'bob' },
    ];
    const maxPeeks = 1, selectedIdx = 0, count = 2;
    // formula: (selectedIdx + (maxPeeks - i)) % count
    // i=0: (0 + 1) % 2 = 1 → bob ✓
    const peekIdx = (selectedIdx + (maxPeeks - 0)) % count;
    expect(accounts[peekIdx].login).toBe('bob');
  });

  it('peek cards show correct accounts with 3 accounts (maxPeeks=2)', () => {
    const accounts = [
      { id: 'a1', login: 'alice' },
      { id: 'a2', login: 'bob' },
      { id: 'a3', login: 'carol' },
    ];
    const maxPeeks = 2, selectedIdx = 0, count = 3;
    // i=0 (peek-2, furthest back): (0 + 2) % 3 = 2 → carol
    // i=1 (peek-1):                (0 + 1) % 3 = 1 → bob
    expect(accounts[(selectedIdx + (maxPeeks - 0)) % count].login).toBe('carol');
    expect(accounts[(selectedIdx + (maxPeeks - 1)) % count].login).toBe('bob');
  });
});
