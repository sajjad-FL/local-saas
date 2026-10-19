import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, index: true });

// Every platform-admin action, so there's always an answer to "who paused this and why?"
const adminLogSchema = new Schema({
  adminId: ref('User'),
  action: {
    type: String,
    enum: ['suspend_business', 'resume_business', 'note_business', 'suspend_owner', 'resume_owner', 'reset_password'],
    required: true,
  },
  businessId: ref('Business'),
  userId: ref('User'), // the owner acted on
  detail: String, // reason, note, or how many businesses were affected
  at: { type: Date, default: Date.now, index: true },
});

export const AdminLog = model('AdminLog', adminLogSchema);
export default AdminLog;
