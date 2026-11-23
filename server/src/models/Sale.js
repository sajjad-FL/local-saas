import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// One sale of catalogue items to a member: the charge (a Due) and, when paid on the spot, the Payment.
const saleSchema = new Schema({
  businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
  items: [{
    itemId: { type: Schema.Types.ObjectId, ref: 'CatalogueItem' },
    kind: String,
    name: String,
    price: Number,
    qty: Number,
  }],
  total: { type: Number, required: true },
  dueId: { type: Schema.Types.ObjectId, ref: 'Due' },
  paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
  soldBy: { type: Schema.Types.ObjectId, ref: 'User' },
  at: { type: Date, default: Date.now, index: true },
});

export const Sale = model('Sale', saleSchema);
export default Sale;
