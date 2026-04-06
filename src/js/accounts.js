import { GH_API } from './auth.js';

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
