import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const userSchema = new Schema({
  name: String,
  phone: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' }, // admin = platform admin, granted with `npm run make-admin`
});

export const User = model('User', userSchema);
export default User;

