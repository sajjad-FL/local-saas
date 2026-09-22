import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, index: true });

const paymentSchema = new Schema({
  memberId: ref('Member'),
  businessId: ref('Business'),
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  mode: { type: String, default: 'cash' },
  note: String,
});

export const Payment = model('Payment', paymentSchema);
export default Payment;

