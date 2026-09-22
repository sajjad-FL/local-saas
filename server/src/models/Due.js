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
});

export const Due = model('Due', dueSchema);
export default Due;

