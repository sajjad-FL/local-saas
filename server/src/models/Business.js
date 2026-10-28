import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, index: true });

const businessSchema = new Schema({
  ownerId: ref('User'),
  name: { type: String, required: true },
  type: { type: String, enum: ['mess', 'tuition', 'gym', 'hostel'], required: true },
  upiId: String,            // appended to reminder messages as a pay link
  reminderEveryDays: { type: Number, enum: [3, 5, 7], default: 3 },
  // platform admin can pause a business's service; owner and staff see the reason, data is kept
  status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
  suspendedAt: Date,
  suspendedReason: String,
  adminNote: String, // only platform admins see this
  attendanceEnabled: { type: Boolean, default: true }, // owner can switch attendance off in Settings; records are kept
  attendanceChosen: { type: Boolean, default: false }, // the owner used the switch, so defaults never override it
  timezone: { type: String, default: 'Asia/Kolkata' }, // decides which day attendance falls on
  checkinToken: { type: String, index: { unique: true, sparse: true } }, // gym QR check-in secret; rotate to revoke
  staffIds: [ref('User')],  // full access except staff/UPI management
  notifications: {
    renewalReminders: { type: Boolean, default: true },
    dailySummary: { type: Boolean, default: false },
    welcomeMessage: { type: Boolean, default: true },
    overdueAlerts: { type: Boolean, default: true },
  },
});

export const Business = model('Business', businessSchema);
export default Business;

