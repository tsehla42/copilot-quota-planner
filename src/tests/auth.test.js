import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getToken, getUser, ghHeaders, escHtml, _verifyAndSave, signOut } from '../js/auth.js';

// jsdom provides localStorage
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('getToken', () => {
  it('returns null when not set', () => {
    expect(getToken()).toBeNull();
  });

  it('returns stored token', () => {
    localStorage.setItem('gh_token', 'ghu_testtoken123');
    expect(getToken()).toBe('ghu_testtoken123');
  });
});

describe('getUser', () => {
  it('returns null when not set', () => {
    expect(getUser()).toBeNull();
  });

  it('returns parsed user object', () => {
    const user = { login: 'alice', name: 'Alice', avatar_url: 'https://example.com/avatar.png' };
    localStorage.setItem('gh_user', JSON.stringify(user));
    expect(getUser()).toEqual(user);
  });
});

describe('ghHeaders', () => {
  it('includes Bearer token from localStorage', () => {
    localStorage.setItem('gh_token', 'ghu_abc123');
    const h = ghHeaders();
    expect(h['Authorization']).toBe('Bearer ghu_abc123');
  });

  it('includes Accept header', () => {
    const h = ghHeaders();
    expect(h['Accept']).toBe('application/vnd.github+json');
  });

  it('includes X-GitHub-Api-Version header', () => {
    const h = ghHeaders();
    expect(h['X-GitHub-Api-Version']).toBe('2022-11-28');
  });
});

describe('escHtml', () => {
  it('escapes &', () => expect(escHtml('a&b')).toBe('a&amp;b'));
  it('escapes <', () => expect(escHtml('<tag>')).toBe('&lt;tag&gt;'));
  it('escapes >', () => expect(escHtml('a>b')).toBe('a&gt;b'));
  it('escapes "', () => expect(escHtml('"quote"')).toBe('&quot;quote&quot;'));
  it('passes through plain strings', () => expect(escHtml('hello world')).toBe('hello world'));
  it('converts non-strings to string', () => expect(escHtml(42)).toBe('42'));
});

describe('signOut', () => {
  it('removes gh_token and gh_user from localStorage', () => {
    localStorage.setItem('gh_token', 'ghu_test');
    localStorage.setItem('gh_user', JSON.stringify({ login: 'alice' }));
    // signOut touches DOM — mock getElementById
    document.body.innerHTML = '<div id="authCard"></div><div id="fetchStatus"></div>';
    signOut();
    expect(localStorage.getItem('gh_token')).toBeNull();
    expect(localStorage.getItem('gh_user')).toBeNull();
  });
});

describe('_verifyAndSave', () => {
  it('stores token and user on 200 response', async () => {
    document.body.innerHTML = '<div id="authCard"></div>';
    const mockUser = { login: 'bob', name: 'Bob', avatar_url: 'https://example.com/bob.png' };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockUser),
    })));
    await _verifyAndSave('ghu_faketoken');
    expect(localStorage.getItem('gh_token')).toBe('ghu_faketoken');
    expect(JSON.parse(localStorage.getItem('gh_user')).login).toBe('bob');
  });

  it('throws on 401', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 401 })));
    await expect(_verifyAndSave('ghu_bad')).rejects.toThrow('invalid or expired');
  });

  it('throws on 403', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 403 })));
    await expect(_verifyAndSave('ghu_bad')).rejects.toThrow('forbidden');
  });
});
