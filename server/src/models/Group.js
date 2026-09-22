import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, index: true });

// batch (tuition) / group (mess, gym) / property (hostel)
const groupSchema = new Schema({
  businessId: ref('Business'),
  name: { type: String, required: true },
});

export const Group = model('Group', groupSchema);
export default Group;

