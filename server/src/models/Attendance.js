import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, index: true });

// One record per member per day. No record means "not marked", never an assumed absence.
const attendanceSchema = new Schema({
  businessId: ref('Business'),
  memberId: ref('Member'),
  day: { type: String, required: true }, // 'YYYY-MM-DD' in the business's timezone
  status: { type: String, enum: ['present', 'absent'], required: true },
  method: { type: String, enum: ['staff', 'qr', 'biometric'], default: 'staff' }, // biometric = imported from the gym's machine
  markedBy: { type: Schema.Types.ObjectId, ref: 'User' }, // staff/owner; empty for QR check-ins
  at: { type: Date, default: Date.now }, // when it was marked (check-in time for QR)
});

attendanceSchema.index({ memberId: 1, day: 1 }, { unique: true });
attendanceSchema.index({ businessId: 1, day: 1 });

export const Attendance = model('Attendance', attendanceSchema);
export default Attendance;
