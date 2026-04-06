export const GH_API = 'https://api.github.com';
export const GITHUB_ICON = `<svg height="15" viewBox="0 0 16 16" fill="currentColor" style="vertical-align:-2px"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;

export function getToken() { return localStorage.getItem('gh_token'); }
export function getUser()  { return JSON.parse(localStorage.getItem('gh_user') || 'null'); }

export function ghHeaders() {
  return {
    'Authorization': `Bearer ${getToken()}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderAuthCard() {
  const token = getToken();
  const user  = getUser();
  const card  = document.getElementById('authCard');
  if (token && user) {
    card.innerHTML = `
      <div class="d-flex jc-between ai-center flex-wrap gap-10">
        <div class="d-flex ai-center gap-10">
          <img src="${escHtml(user.avatar_url)}" alt="" class="avatar" loading="lazy" />
          <div>
            <div class="fw-600">@${escHtml(user.login)}</div>
            <div class="fs-11 muted">${escHtml(user.name || '')}${user.name ? ' · ' : ''}GitHub token connected</div>
          </div>
        </div>
        <div class="d-flex gap-8 ai-center flex-wrap">
          <button class="auth-btn auth-btn-danger" onclick="signOut()">Sign out</button>
        </div>
      </div>`;
  } else {
    card.innerHTML = `
      <div class="d-flex jc-between ai-center flex-wrap gap-12">
        <div>
          <div class="fw-600 mb-3">Connect GitHub token (optional)</div>
          <div class="fs-12 muted">Add a PAT to verify your plan. Usage % must still be entered manually from <a href="https://github.com/settings/copilot" target="_blank">github.com/settings/copilot</a>.</div>
        </div>
        <div class="d-flex gap-8 flex-wrap">
          <button class="auth-btn auth-btn-primary" onclick="openAuthModal()">${GITHUB_ICON} Connect token</button>
        </div>
      </div>`;
  }
}

export function openAuthModal() {
  document.getElementById('modalContent').innerHTML = _patForm();
  document.getElementById('authModal').classList.add('open');
}

export function closeAuthModal() {
  document.getElementById('authModal').classList.remove('open');
}

export function showModalError(msg) {
  const el = document.getElementById('authModalErr');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

export function _setFetchStatus(msg, color) {
  const el = document.getElementById('fetchStatus');
  if (el) { el.textContent = msg; el.style.color = color; }
}

export function _patForm() {
  return `
    <h3>Connect a GitHub Token</h3>
    <p class="modal-sub">Your token is stored only in this browser's localStorage and sent directly to <code>api.github.com</code> — never to any third party.</p>
    <div id="authModalErr" class="auth-error"></div>
    <div class="info-box">
      <strong>How to get a <code>ghu_</code> token from VS Code</strong><br><br>
      <div class="step-row"><span class="step-num">1</span>
        <div>Press <code>F1</code> → type <strong>Toggle Developer Tools</strong> → Enter → open the <strong>Network</strong> tab</div>
      </div>
      <div class="step-row"><span class="step-num">2</span>
        <div>Type <code>copilot_internal</code> in the filter box, tick <strong>Preserve log</strong></div>
      </div>
      <div class="step-row"><span class="step-num">3</span>
        <div>Open Copilot Chat (<code>Ctrl+Alt+I</code>) and send any message — a <code>user</code> row will appear in the network list</div>
      </div>
      <div class="step-row"><span class="step-num">4</span>
        <div>Click that <code>user</code> row → <strong>Request Headers</strong> → copy the value after <code>Authorization: token </code></div>
      </div>
      <div class="step-row"><span class="step-num">5</span>
        <div>The token starts with <code>ghu_</code> — paste it below</div>
      </div>
    </div>
    <label>Token</label>
    <input type="password" id="inPAT" placeholder="ghx_…" autocomplete="new-password" />
    <div class="modal-row">
      <button class="auth-btn" onclick="closeAuthModal()">Cancel</button>
      <button class="auth-btn auth-btn-primary" onclick="_savePAT()">Connect</button>
    </div>`;
}

export async function _savePAT() {
  const token = document.getElementById('inPAT')?.value.trim();
  if (!token) { showModalError('Please paste a token'); return; }
  if (!/^(ghp_|github_pat_|gho_|ghu_)[A-Za-z0-9_]+$/.test(token)) {
    showModalError('Token format looks invalid — GitHub tokens start with ghp_, github_pat_, gho_, or ghu_'); return;
  }
  try {
    await _verifyAndSave(token);
    closeAuthModal();
    // Caller (main.js) will call fetchRealUsage after this resolves
    window.dispatchEvent(new CustomEvent('auth:connected'));
  } catch (e) {
    showModalError(e.message);
  }
}

export async function _verifyAndSave(token) {
  const res = await fetch(`${GH_API}/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Token is invalid or expired (401)');
    if (res.status === 403) throw new Error('Token is forbidden (403) — check scopes');
    throw new Error(`GitHub API returned ${res.status}`);
  }
  const userData = await res.json();
  localStorage.setItem('gh_token', token);
  localStorage.setItem('gh_user', JSON.stringify({
    login: userData.login,
    name: userData.name || '',
    avatar_url: userData.avatar_url,
  }));
  renderAuthCard();
}

export function signOut() {
  ['gh_token', 'gh_user'].forEach(key => localStorage.removeItem(key));
  renderAuthCard();
  _setFetchStatus('', '');
}
