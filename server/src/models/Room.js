import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, index: true });

// occupancy is computed (active members with this roomId), never stored
const roomSchema = new Schema({
  businessId: ref('Business'),
  groupId: ref('Group'), // the property (hostel1, hostel2, …)
  roomNo: { type: String, required: true },
  capacity: { type: Number, required: true },
});

export const Room = model('Room', roomSchema);
export default Room;

