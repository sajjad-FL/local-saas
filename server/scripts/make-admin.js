// Grant or remove platform-admin access. Run on the server, never from the app:
//   npm run make-admin -- 9876543210
//   npm run make-admin -- 9876543210 --remove
// The person must have registered in the app first.
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/index.js';

const [phone, flag] = process.argv.slice(2);
if (!phone) {
  console.error('usage: npm run make-admin -- <phone> [--remove]');
  process.exit(1);
}
await connectDB();
const user = await User.findOne({ phone });
if (!user) {
  console.error(`no account with phone ${phone}: register in the app first`);
  await mongoose.disconnect();
  process.exit(1);
}
user.role = flag === '--remove' ? 'user' : 'admin';
await user.save();
console.log(`${user.name || user.phone} is now ${user.role === 'admin' ? 'a platform admin' : 'a regular user'}`);
await mongoose.disconnect();
