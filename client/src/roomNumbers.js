// Room numbers for a floor copied from another floor of the same building.
//   floor-style numbers (101, 102 on floor 1)  → the new floor's hundreds (201, 202 on floor 2)
//   anything else numeric (01–04, A1–A4)        → carry on after the building's highest number (05–08)
// Returns null when the numbers can't be worked out (names like "Corner room").
const split = (no) => String(no).match(/^(\D*)(\d+)$/);

export function copyNumbers(source, buildingRooms, sourceIndex, newIndex) {
  const parts = source.map((r) => split(r.roomNo));
  if (!source.length || parts.some((p) => !p)) return null;
  const taken = new Set(buildingRooms.map((r) => String(r.roomNo).toLowerCase()));
  const free = (list) => list.every((n) => !taken.has(n.toLowerCase())) && new Set(list).size === list.length;

  // 1. floor-style: 3+ digits whose hundreds match the source floor's place in the building
  const hundreds = new Set(parts.map(([, , d]) => Math.floor(Number(d) / 100)));
  if (parts.every(([, , d]) => d.length >= 3) && hundreds.size === 1) {
    const shift = newIndex - sourceIndex;
    const list = parts.map(([, prefix, d]) => `${prefix}${String(Number(d) + shift * 100).padStart(d.length, '0')}`);
    if (shift !== 0 && list.every((n) => !n.includes('-')) && free(list)) return list;
  }

  // 2. carry on after the highest number in the building, same prefix and padding as the source
  const width = Math.max(...parts.map(([, , d]) => d.length));
  const prefix = parts[0][1];
  let next = Math.max(0, ...buildingRooms.map((r) => split(r.roomNo)).filter((p) => p && p[1] === prefix).map((p) => Number(p[2]))) + 1;
  const list = [];
  for (let i = 0; i < source.length; i += 1) {
    while (taken.has(`${prefix}${String(next).padStart(width, '0')}`.toLowerCase())) next += 1;
    list.push(`${prefix}${String(next).padStart(width, '0')}`);
    next += 1;
  }
  return free(list) ? list : null;
}
