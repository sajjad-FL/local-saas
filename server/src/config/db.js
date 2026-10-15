import dns from 'node:dns';
import mongoose from 'mongoose';

export async function connectDB() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error('MONGO_URL environment variable is not defined');
  }
  // Node on Windows sometimes ignores the system DNS and falls back to 127.0.0.1, which
  // breaks the SRV lookup mongodb+srv:// needs (querySrv ECONNREFUSED). Only then, use public resolvers.
  if (mongoUrl.startsWith('mongodb+srv://') && dns.getServers().every((s) => s === '127.0.0.1' || s === '::1')) {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }
  await mongoose.connect(mongoUrl);
  console.log('MongoDB connected successfully');
}
