// ─── Calendar state ───────────────────────────────────────
export let calCustomDayoffs = new Set();
export let calViewYear  = new Date().getFullYear();
export let calViewMonth = new Date().getMonth(); // 0-based

export function setCalView(year, month) {
  calViewYear  = year;
  calViewMonth = month;
}

// Per-session Map for month-scoped day-offs: key = "YYYY-M"
let _dayoffsByMonth = new Map();
function _monthKey(y, m) { return `${y}-${m}`; }

function _todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

function _isCurrentMonth() {
  const d = new Date();
  return calViewYear === d.getFullYear() && calViewMonth === d.getMonth();
}

function _persistDayoffs() {
  localStorage.setItem('cal_dayoffs_month', _todayKey());
  localStorage.setItem('cal_dayoffs', JSON.stringify([...calCustomDayoffs]));
}

function _syncDayoffUiState() {
  const count = calCustomDayoffs.size;
  const countEl = document.getElementById('calDayoffCount');
  if (countEl) countEl.textContent = String(count);

  const summaryEl = document.getElementById('calDayoffSummary');
  if (summaryEl) summaryEl.classList.toggle('is-active', count > 0);

  for (const buttonId of ['panelClearBtn', 'calendarClearBtn']) {
    const button = document.getElementById(buttonId);
    if (button) button.disabled = count === 0;
  }
}

const CAL_MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const CAL_DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export function getExcludeWeekends() {
  return document.getElementById('excludeWeekendsChk').checked;
}

export function countWeekendsInMonth(totalDays) {
  let count = 0;
  for (let d = 1; d <= totalDays; d++) {
    const dow = new Date(calViewYear, calViewMonth, d).getDay();
    if (dow === 0 || dow === 6) count++;
  }
  return count;
}

export function countEffectiveDayoffs() {
  const excludeWeekends = getExcludeWeekends();
  let count = 0;
  for (const iso of calCustomDayoffs) {
    const d = new Date(iso + 'T00:00:00');
    const dow = d.getDay();
    if (excludeWeekends && (dow === 0 || dow === 6)) continue;
    count++;
  }
  return count;
}

export function openCalendar() {
  // Snapshot the current active day-offs into the per-session map for the current view month
  _dayoffsByMonth.set(_monthKey(calViewYear, calViewMonth), new Set(calCustomDayoffs));
  document.getElementById('calExcludeWeekendsChk').checked = getExcludeWeekends();
  renderCalendar();
  _syncDayoffUiState();
  document.getElementById('calOverlay').classList.add('open');
}

export function closeCalendar() {
  // If user navigated away from current month, discard those selections
  if (!_isCurrentMonth()) {
    const savedMonth = localStorage.getItem('cal_dayoffs_month');
    const todayKey = _todayKey();
    calCustomDayoffs.clear();
    if (savedMonth === todayKey) {
      const saved = localStorage.getItem('cal_dayoffs');
      if (saved) {
        try { JSON.parse(saved).forEach(iso => calCustomDayoffs.add(iso)); } catch { /* ignore */ }
      }
    }
  }
  _dayoffsByMonth.clear(); // discard per-session month snapshots
  document.getElementById('calOverlay').classList.remove('open');
  syncDayoffsFromCalendar();
  // Sync the monthLen select to the currently viewed month
  const daysInViewedMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
  const sel = document.getElementById('monthLen');
  if (sel) {
    for (let i = 0; i < sel.options.length; i++) {
      if (parseInt(sel.options[i].value) === daysInViewedMonth) {
        sel.options[i].selected = true;
        break;
      }
    }
    sel.dispatchEvent(new Event('change'));
  }
  window.dispatchEvent(new CustomEvent('calendar:closed'));
}

export function syncDayoffsFromCalendar() {
  _syncDayoffUiState();
}

export function renderCalendar() {
  document.getElementById('calTitle').textContent =
    `${CAL_MONTH_NAMES[calViewMonth]} ${calViewYear}`;
  renderCalGrid();
}

export function renderCalGrid() {
  const excludeWeekends = document.getElementById('calExcludeWeekendsChk').checked;
  const today  = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  const y = calViewYear;
  const m = calViewMonth;
  const daysInMonth  = new Date(y, m + 1, 0).getDate();
  const firstDow     = new Date(y, m, 1).getDay();
  const startOffset  = (firstDow + 6) % 7;

  const grid = document.getElementById('calGrid');
  let html = CAL_DAY_NAMES.map(n => `<div class="cal-day-name">${n}</div>`).join('');

  for (let i = 0; i < startOffset; i++) {
    html += `<div class="cal-cell cal-empty"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(y, m, d).getDay();
    const isWeekend = dow === 0 || dow === 6;
    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isDayoff = calCustomDayoffs.has(iso);
    const isToday  = y === todayY && m === todayM && d === todayD;

    let cls = 'cal-cell';
    if (isToday) cls += ' cal-today';
    if (isDayoff) {
      cls += ' cal-dayoff';
    } else if (isWeekend && excludeWeekends) {
      cls += ' cal-weekend-off';
    } else if (isWeekend) {
      cls += ' cal-weekend';
    }

    const clickable = !(isWeekend && excludeWeekends);
    const onclick = clickable ? `onclick="calToggleDay('${iso}')"` : '';
    html += `<div class="${cls}" ${onclick} title="${iso}">${d}</div>`;
  }

  grid.innerHTML = html;
}

export function calNavMonth(delta) {
  // Save current month's day-offs before navigating
  _dayoffsByMonth.set(_monthKey(calViewYear, calViewMonth), new Set(calCustomDayoffs));

  calViewMonth += delta;
  if (calViewMonth < 0)  { calViewMonth = 11; calViewYear--; }
  if (calViewMonth > 11) { calViewMonth = 0;  calViewYear++; }

  // Load the target month's day-offs (or start empty)
  const saved = _dayoffsByMonth.get(_monthKey(calViewYear, calViewMonth));
  calCustomDayoffs.clear();
  if (saved) { for (const iso of saved) calCustomDayoffs.add(iso); }
  _syncDayoffUiState();

  renderCalendar();
}

export function calToggleDay(iso) {
  if (calCustomDayoffs.has(iso)) {
    calCustomDayoffs.delete(iso);
  } else {
    calCustomDayoffs.add(iso);
  }
  if (_isCurrentMonth()) _persistDayoffs();
  renderCalGrid();
  _syncDayoffUiState();
  window.dispatchEvent(new CustomEvent('calendar:dayoff-changed'));
}

export function clearCustomDayoffs() {
  if (_isCurrentMonth()) {
    localStorage.removeItem('cal_dayoffs');
    localStorage.removeItem('cal_dayoffs_month');
  }
  calCustomDayoffs.clear();
  _syncDayoffUiState();
  renderCalGrid();
  window.dispatchEvent(new CustomEvent('calendar:dayoff-changed'));
}

export function onWeekendsToggle() {
  const excludeWeekends = getExcludeWeekends();
  localStorage.setItem('pref_exclude_weekends', excludeWeekends ? '1' : '0');
  if (excludeWeekends) {
    for (const iso of [...calCustomDayoffs]) {
      const dow = new Date(iso + 'T00:00:00').getDay();
      if (dow === 0 || dow === 6) calCustomDayoffs.delete(iso);
    }
  }
  _syncDayoffUiState();
  document.getElementById('calExcludeWeekendsChk').checked = excludeWeekends;
  renderCalGrid();
  window.dispatchEvent(new CustomEvent('calendar:weekends-changed'));
}

export function onCalWeekendsToggle() {
  const checked = document.getElementById('calExcludeWeekendsChk').checked;
  document.getElementById('excludeWeekendsChk').checked = checked;
  localStorage.setItem('pref_exclude_weekends', checked ? '1' : '0');
  renderCalGrid();
  window.dispatchEvent(new CustomEvent('calendar:weekends-changed'));
}
