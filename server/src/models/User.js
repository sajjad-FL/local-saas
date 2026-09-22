import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const userSchema = new Schema({
  name: String,
  phone: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
});

export const User = model('User', userSchema);
export default User;

