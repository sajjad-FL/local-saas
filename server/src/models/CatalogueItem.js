import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Things a business sells besides memberships: personal-training packs, services and products.
// They are charged once (a one-off due on the member), unlike plans which bill every cycle.
const catalogueItemSchema = new Schema({
  businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  kind: { type: String, enum: ['pt', 'service', 'product'], required: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  price: { type: Number, required: true, min: 1 },
  detail: { type: String, trim: true, maxlength: 80 }, // e.g. "12 sessions, use within 45 days"
  trackStock: { type: Boolean, default: false }, // products only
  stock: { type: Number, default: 0, min: 0 },
  active: { type: Boolean, default: true }, // removed items stay for old sales
}, { timestamps: true });

export const CatalogueItem = model('CatalogueItem', catalogueItemSchema);
export default CatalogueItem;
