import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, index: true });

const reminderSchema = new Schema({
  memberId: ref('Member'),
  businessId: ref('Business'),
  amount: Number,
  sentAt: { type: Date, default: Date.now },
});

export const Reminder = model('Reminder', reminderSchema);
export default Reminder;

