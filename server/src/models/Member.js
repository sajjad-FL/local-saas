import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, index: true });

const memberSchema = new Schema({
  businessId: ref('Business'),
  groupId: ref('Group'),
  roomId: ref('Room'),
  name: { type: String, required: true },
  phone: String,
  joinDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'left'], default: 'active' },
});

export const Member = model('Member', memberSchema);
export default Member;

