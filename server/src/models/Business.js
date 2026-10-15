import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, index: true });

const businessSchema = new Schema({
  ownerId: ref('User'),
  name: { type: String, required: true },
  type: { type: String, enum: ['mess', 'tuition', 'gym', 'hostel'], required: true },
  upiId: String,            // appended to reminder messages as a pay link
  reminderEveryDays: { type: Number, enum: [3, 5, 7], default: 3 },
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

