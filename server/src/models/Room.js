import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, index: true });

// occupancy is computed (active members with this roomId), never stored
const roomSchema = new Schema({
  businessId: ref('Business'),
  groupId: ref('Group'), // the building
  floorId: { type: Schema.Types.ObjectId, index: true }, // one of the building's floors
  roomNo: { type: String, required: true },
  capacity: { type: Number, required: true },
  bedRent: { type: Number, min: 0 }, // optional asking rent per bed, shown on free beds
});

export const Room = model('Room', roomSchema);
export default Room;

