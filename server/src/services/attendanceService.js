// Pure attendance helpers, unit-tested in test.js.

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDay = (s) => typeof s === 'string' && DAY_RE.test(s) && !isNaN(new Date(`${s}T00:00:00Z`));

// The calendar day ('YYYY-MM-DD') of a moment as seen in a timezone, e.g. 6 AM IST stays
// "today" even though it is still the previous day in UTC.
export function localDay(date = new Date(), timeZone = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
}

// Shift a 'YYYY-MM-DD' day by n days
export function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Last 10 digits, so "+91 98765-43210" and "9876543210" are the same member
export const phoneKey = (phone) => String(phone ?? '').replace(/\D/g, '').slice(-10);

// Counts for records within [fromDay, toDay]
export function summarize(records, fromDay, toDay) {
  const inRange = records.filter((r) => r.day >= fromDay && r.day <= toDay);
  const present = inRange.filter((r) => r.status === 'present');
  return {
    present: present.length,
    absent: inRange.length - present.length,
    marked: inRange.length,
    lastPresent: present.map((r) => r.day).sort().at(-1) || null,
  };
}

// ---- Biometric machine exports (eSSL, ZKTeco and similar) ----
// Their software exports Excel/CSV in many layouts: one row per punch with a combined
// date-time, or one row per person per day with Date + In Time. Title rows often sit above
// the table. These helpers find the columns, read the times, and keep the first punch a day.

const COLUMN_PATTERNS = {
  datetime: /(date\s*[/&-]?\s*time|check\s*time|punch\s*time|time\s*stamp|log\s*time|att(endance)?\s*time|verify\s*time)/i,
  id: /^(ac[-\s]?no\.?|user\s*(id|no\.?)|emp(loyee)?\s*(id|code|no\.?)|enroll(ment)?\s*(no\.?|id)|badge(\s*no\.?)?|card\s*no\.?|id|code|pin|no\.?)$/i,
  name: /name/i,
  date: /^(date|att(endance)?\s*date|punch\s*date|log\s*date|work\s*date)$/i,
  time: /^(time|in\s*time|first\s*in|check\s*in|punch\s*in|in)$/i,
};

// Column indexes in a header row (-1 = not found). Each column is used for one thing only.
export function detectColumns(header) {
  const cells = header.map((c) => String(c ?? '').trim());
  const cols = {};
  const used = new Set();
  for (const key of ['datetime', 'id', 'name', 'date', 'time']) {
    cols[key] = cells.findIndex((c, i) => !used.has(i) && c && COLUMN_PATTERNS[key].test(c));
    if (cols[key] >= 0) used.add(cols[key]);
  }
  return cols;
}

// The header row: the first of the top 15 rows with an ID column and a date or date-time column
export function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const c = detectColumns(rows[i] || []);
    if (c.id >= 0 && (c.datetime >= 0 || c.date >= 0)) return i;
  }
  return -1;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

// Wall-clock time as the machine printed it. Dates are read day-first (Indian format) unless
// they start with a 4-digit year. Returns null when there is no time (no punch that day).
// timeText: the separate Time column, when the export has one; it wins over any time in text.
export function parseWallTime(text, timeText) {
  const s = String(text ?? '').trim();
  if (!s) return null;
  let y, m, d, rest;
  let x;
  if ((x = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(.*)$/))) [, y, m, d, rest] = x;
  else if ((x = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(.*)$/))) [, d, m, y, rest] = x;
  else if ((x = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s,]+(\d{2,4})(.*)$/))) {
    [, d, m, y, rest] = x;
    m = MONTHS[m.toLowerCase()];
  } else return null;
  y = Number(y); m = Number(m); d = Number(d);
  if (y < 100) y += 2000;
  const timeSource = timeText === undefined ? rest : String(timeText ?? '');
  const t = (timeSource || '').match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/);
  if (!t) return null;
  let hh = Number(t[1]);
  const mm = Number(t[2]), ss = Number(t[3] || 0);
  if (t[4]) {
    const pm = /p/i.test(t[4]);
    if (hh === 12) hh = pm ? 12 : 0;
    else if (pm) hh += 12;
  }
  const check = new Date(Date.UTC(y, m - 1, d));
  if (!m || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d || hh > 23 || mm > 59 || ss > 59) return null;
  return { day: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, hh, mm, ss };
}

// The moment a wall-clock time happened in a timezone (e.g. 06:42 in Asia/Kolkata = 01:12 UTC)
export function wallToUtc({ day, hh, mm, ss }, timeZone = 'Asia/Kolkata') {
  const [y, m, d] = day.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, ss);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(guess - (shown - guess));
}

// Rows -> punches [{ machineId, name, day, at }], counting rows that had no readable time
export function buildPunches(rows, cols, timeZone) {
  const punches = [];
  let skipped = 0;
  for (const r of rows) {
    if (!r || !r.length) continue;
    const machineId = String(r[cols.id] ?? '').trim().replace(/\.0$/, '');
    const separate = cols.datetime < 0 && cols.time >= 0;
    const when = cols.datetime >= 0 ? r[cols.datetime] : r[cols.date];
    const wall = machineId ? (separate ? parseWallTime(when, r[cols.time]) : parseWallTime(when)) : null;
    if (!wall) {
      // unreadable, not just "no punch that day" (a bare date with an empty time) or a filler row without an ID
      const text = String(when ?? '').trim();
      if (machineId && text && !/^[\d\s/.-]+$/.test(text)) skipped++;
      continue;
    }
    punches.push({ machineId, name: cols.name >= 0 ? String(r[cols.name] ?? '').trim() : '', day: wall.day, at: wallToUtc(wall, timeZone) });
  }
  return { punches, skipped };
}

// First punch per machine ID per day: that's the check-in
export function firstPunchPerDay(punches) {
  const first = new Map();
  for (const p of punches) {
    const k = `${p.machineId}|${p.day}`;
    if (!first.has(k) || p.at < first.get(k).at) first.set(k, p);
  }
  return [...first.values()];
}
