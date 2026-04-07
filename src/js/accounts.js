import { GH_API, escHtml } from './auth.js';

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

export function updateAccountQuota(id, quota, plan = null) {
  const accounts = getAccounts();
  const account = accounts.find(a => a.id === id);
  if (!account) return;
  account.lastQuota = quota;
  if (plan) account.plan = plan;
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
  if (idx === -1) return null;
  const nextIdx = (idx + direction + accounts.length) % accounts.length;
  return accounts[nextIdx].id;
}

// ── DOM helpers ──────────────────────────────────────────────────────────────

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

  const selectedIdx = accounts.findIndex(a => a.id === selected?.id);
  const peekAccounts = multi
    ? [
        accounts[(selectedIdx + 1) % count],
        count > 2 ? accounts[(selectedIdx + 2) % count] : null,
      ].filter(Boolean)
    : [];

  const CARD_WIDTH  = 280;
  const PEEK_OFFSET = 40;

  function cardHtml(account, role, leftPx) {
    const removeBtn = (role === 'selected' && multi) ? `
      <button class="account-card-remove" onclick="removeAccountAndRender('${escHtml(account.id)}')" title="Remove account" aria-label="Remove ${escHtml(account.login)}">✕</button>
    ` : '';
    const planLabel = account.plan ? escHtml(account.plan) + ' plan' : 'plan unknown';
    const avatarEl = account.avatar_url
      ? `<img src="${escHtml(account.avatar_url)}" alt="" class="account-card-avatar" loading="lazy" />`
      : `<div class="account-card-avatar-placeholder"></div>`;
    return `
      <div class="account-card ${role}" style="left:${leftPx}px">
        ${avatarEl}
        <div class="account-card-info">
          <div class="account-card-login">@${escHtml(account.login)}</div>
          <div class="account-card-plan">${planLabel}</div>
        </div>
        ${removeBtn}
      </div>`;
  }

  const peekCount  = peekAccounts.length;
  const stackWidth = CARD_WIDTH + peekCount * PEEK_OFFSET;

  const peekHtml = peekAccounts
    .map((a, i) => {
      const role   = i === 0 ? 'peek-1' : 'peek-2';
      const leftPx = (peekCount - 1 - i) * PEEK_OFFSET;
      return cardHtml(a, role, leftPx);
    })
    .join('');

  const arrowsHtml = multi ? `
    <button class="nav-arrow" onclick="navigateAccount(-1)" title="Previous account">←</button>
    <button class="nav-arrow" onclick="navigateAccount(1)" title="Next account">→</button>
  ` : '';

  const countLabel = count === 1 ? '1 account connected' : `${count} accounts connected`;

  const selectedLeftPx = peekCount * PEEK_OFFSET;

  container.innerHTML = `
    <div class="accounts-dynamic" style="width:${stackWidth}px">
      <div class="account-card-stack">
        ${peekHtml}
        ${selected ? cardHtml(selected, 'selected', selectedLeftPx) : ''}
      </div>
    </div>
    <div class="accounts-static">
      <div class="accounts-label">${countLabel}</div>
      <div class="accounts-controls">
        ${arrowsHtml}
        <button class="auth-btn" onclick="openAccountsModal()">+ Add account</button>
        <button class="auth-btn auth-btn-danger" onclick="signOutAllAndRender()">${count === 1 ? 'Sign out' : 'Sign out all'}</button>
      </div>
    </div>`;
}

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
    <details class="info-box">
      <summary>How to get a <code>ghu_</code> token from VS Code</summary>
      <div style="margin-top:8px">
        <div class="step-row"><span class="step-num">1</span><div>Press <code>F1</code> → <strong>Toggle Developer Tools</strong> → Network tab</div></div>
        <div class="step-row"><span class="step-num">2</span><div>Filter by <code>copilot_internal</code>, tick <strong>Preserve log</strong></div></div>
        <div class="step-row"><span class="step-num">3</span><div>Send any Copilot Chat message (<code>Ctrl+Alt+I</code>) — a <code>user</code> row appears</div></div>
        <div class="step-row"><span class="step-num">4</span><div>Click that row → Request Headers → copy value after <code>Authorization: token </code></div></div>
        <div class="step-row"><span class="step-num">5</span><div>Starts with <code>ghu_</code> — paste it below</div></div>
      </div>
    </details>
    <label>Token(s)</label>
    <div class="token-fields" id="tokenFields">
      <div class="token-field-row">
        <input type="password" placeholder="ghx_…" autocomplete="new-password" class="token-input" onkeydown="if(event.key==='Enter')_submitTokens()" />
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
    <input type="password" placeholder="ghx_…" autocomplete="new-password" class="token-input" onkeydown="if(event.key==='Enter')_submitTokens()" />
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
  btn.textContent = 'Adding\u2026';
  if (errEl) errEl.style.display = 'none';

  try {
    const result = await addAccounts(tokens);
    if (result.failed.length) {
      const msgs = result.failed.map(f => `${f.token.slice(0, 12)}\u2026: ${f.reason}`).join('\n');
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
