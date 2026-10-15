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
  // secret for the member's read-only statement link; rotate to revoke
  shareToken: { type: String, index: { unique: true, sparse: true } },
  // hostel: security deposit and notice, shown on the statement so both sides see the same record
  deposit: {
    amount: Number,
    refundedAmount: Number,
    refundedOn: Date,
  },
  noticeGivenOn: Date,
});

export const Member = model('Member', memberSchema);
export default Member;

