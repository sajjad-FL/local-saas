import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// One row per person an owner has given access to. It decides which of the owner's
// outlets they can open and what they can do there. Business.staffIds is kept in
// step with these rows (see staffService.syncStaff) so the "can open" checks stay fast.
//
// level: 0 = see only, 1 = add (members, payments, attendance), 2 = add & edit, 3 = full (delete too)
const staffSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  phone: { type: String, required: true }, // 10 digits; how they sign in
  name: { type: String, trim: true, maxlength: 60 },
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true }, // empty until they sign up with that phone
  allOutlets: { type: Boolean, default: false }, // includes outlets added later
  businessIds: [{ type: Schema.Types.ObjectId, ref: 'Business' }],
  level: { type: Number, enum: [0, 1, 2, 3], default: 1 },
}, { timestamps: true });

staffSchema.index({ ownerId: 1, phone: 1 }, { unique: true });

export const Staff = model('Staff', staffSchema);
export default Staff;
