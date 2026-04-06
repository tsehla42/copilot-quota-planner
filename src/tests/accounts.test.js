import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAccounts, getSelectedId, saveAccounts, saveSelectedId,
  getSelectedAccount, addAccountObject, removeAccount, signOutAll,
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
