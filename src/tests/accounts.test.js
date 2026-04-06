import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAccounts, getSelectedId, saveAccounts, saveSelectedId,
  getSelectedAccount, addAccountObject, removeAccount, signOutAll,
  addAccounts, validateTokenFormat, updateAccountQuota, migrateFromLegacy,
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
