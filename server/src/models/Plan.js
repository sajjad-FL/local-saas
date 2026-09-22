import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, index: true });

const planSchema = new Schema({
  businessId: ref('Business'),
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  cycleDays: { type: Number, default: 30 },
});

export const Plan = model('Plan', planSchema);
export default Plan;

