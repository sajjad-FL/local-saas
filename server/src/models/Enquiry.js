import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, index: true });

export const ENQUIRY_STATUSES = ['new', 'follow_up', 'joined', 'lost'];
export const ENQUIRY_SOURCES = ['walk_in', 'call', 'whatsapp', 'instagram', 'referral', 'other'];

// someone who asked about joining but isn't a member yet; the owner follows up until
// they join (then they become a Member) or the owner marks them lost
const enquirySchema = new Schema({
  businessId: ref('Business'),
  name: { type: String, required: true, trim: true, maxlength: 80 },
  phone: { type: String, trim: true, maxlength: 20 },
  planId: ref('Plan'), // what they asked about; empty = not sure yet
  source: { type: String, enum: ENQUIRY_SOURCES, default: 'walk_in' },
  status: { type: String, enum: ENQUIRY_STATUSES, default: 'new', index: true },
  followUpOn: { type: Date, index: true }, // next time to call them
  note: { type: String, trim: true, maxlength: 500 },
  memberId: ref('Member'), // set when they join
  createdBy: ref('User'),
}, { timestamps: true });

export const Enquiry = model('Enquiry', enquirySchema);
export default Enquiry;
