import { Business, Attendance } from '../models/index.js';

// Hostels start with attendance off (they rarely take daily attendance). For hostels created
// before that default, turn it off too, but only if the owner never chose either way and
// the hostel has no attendance records. Safe to run on every boot.
export async function applyHostelAttendanceDefault() {
  const hostels = await Business.find({ type: 'hostel', attendanceEnabled: { $ne: false }, attendanceChosen: { $ne: true } }).select('_id');
  if (!hostels.length) return;
  const used = new Set((await Attendance.distinct('businessId', { businessId: { $in: hostels.map((h) => h._id) } })).map(String));
  const ids = hostels.filter((h) => !used.has(String(h._id))).map((h) => h._id);
  if (ids.length) {
    await Business.updateMany({ _id: { $in: ids } }, { attendanceEnabled: false });
    console.log(`attendance switched off by default for ${ids.length} hostel(s)`);
  }
}
