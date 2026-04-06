// ─── Calendar state ───────────────────────────────────────
export let calCustomDayoffs = new Set();
export let calViewYear  = new Date().getFullYear();
export let calViewMonth = new Date().getMonth(); // 0-based

export function setCalView(year, month) {
  calViewYear  = year;
  calViewMonth = month;
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
  document.getElementById('calExcludeWeekendsChk').checked = getExcludeWeekends();
  renderCalendar();
  document.getElementById('calOverlay').classList.add('open');
}

export function closeCalendar() {
  document.getElementById('calOverlay').classList.remove('open');
  syncDayoffsFromCalendar();
  window.dispatchEvent(new CustomEvent('calendar:closed'));
}

export function syncDayoffsFromCalendar() {
  document.getElementById('calDayoffCount').textContent = calCustomDayoffs.size;
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
  calViewMonth += delta;
  if (calViewMonth < 0)  { calViewMonth = 11; calViewYear--; }
  if (calViewMonth > 11) { calViewMonth = 0;  calViewYear++; }
  renderCalendar();
}

export function calToggleDay(iso) {
  if (calCustomDayoffs.has(iso)) {
    calCustomDayoffs.delete(iso);
  } else {
    calCustomDayoffs.add(iso);
  }
  renderCalGrid();
  document.getElementById('calDayoffCount').textContent = calCustomDayoffs.size;
  window.dispatchEvent(new CustomEvent('calendar:dayoff-changed'));
}

export function clearCustomDayoffs() {
  calCustomDayoffs.clear();
  document.getElementById('calDayoffCount').textContent = '0';
  renderCalGrid();
  window.dispatchEvent(new CustomEvent('calendar:dayoff-changed'));
}

export function onWeekendsToggle() {
  const excludeWeekends = getExcludeWeekends();
  if (excludeWeekends) {
    for (const iso of [...calCustomDayoffs]) {
      const dow = new Date(iso + 'T00:00:00').getDay();
      if (dow === 0 || dow === 6) calCustomDayoffs.delete(iso);
    }
    document.getElementById('calDayoffCount').textContent = calCustomDayoffs.size;
  }
  document.getElementById('calExcludeWeekendsChk').checked = excludeWeekends;
  renderCalGrid();
  window.dispatchEvent(new CustomEvent('calendar:weekends-changed'));
}

export function onCalWeekendsToggle() {
  document.getElementById('excludeWeekendsChk').checked =
    document.getElementById('calExcludeWeekendsChk').checked;
  renderCalGrid();
  window.dispatchEvent(new CustomEvent('calendar:weekends-changed'));
}
