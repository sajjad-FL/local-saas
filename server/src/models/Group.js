import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, index: true });

// batch (tuition) / group (mess, gym) / building (hostel)
const groupSchema = new Schema({
  businessId: ref('Business'),
  name: { type: String, required: true },
  // hostel buildings: their floors, in the order added (Ground, 1st, 2nd…); rooms point at a floor
  floors: [{ name: { type: String, required: true, trim: true, maxlength: 40 } }],
});

export const Group = model('Group', groupSchema);
export default Group;

