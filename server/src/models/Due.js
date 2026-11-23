import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, index: true });

const dueSchema = new Schema({
  memberId: ref('Member'),
  businessId: ref('Business'),
  subscriptionId: ref('Subscription'),
  amount: Number,
  periodStart: Date,
  periodEnd: Date,
  dueDate: Date,
  status: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
  kind: { type: String, enum: ['fee', 'sale'], default: 'fee' }, // sale = a one-off charge for catalogue items
  label: String, // what a sale was for, e.g. "Whey protein ×2"
});

// one due per cycle: a rerun or overlapping cron can never bill the same period twice
dueSchema.index({ subscriptionId: 1, periodStart: 1 }, { unique: true });

export const Due = model('Due', dueSchema);
export default Due;

