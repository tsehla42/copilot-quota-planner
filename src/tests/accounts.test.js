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
