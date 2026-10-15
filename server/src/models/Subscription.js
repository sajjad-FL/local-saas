import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, index: true });

const subscriptionSchema = new Schema({
  memberId: ref('Member'),
  planId: ref('Plan'),
  periodStart: Date,
  periodEnd: Date,
  status: { type: String, enum: ['active', 'paused', 'stopped'], default: 'active' },
  pausedAt: Date,
  anchorDay: Number, // day of month monthly cycles renew on (1–31)
});

export const Subscription = model('Subscription', subscriptionSchema);
export default Subscription;

