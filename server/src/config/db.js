import mongoose from 'mongoose';

export async function connectDB() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error('MONGO_URL environment variable is not defined');
  }
  await mongoose.connect(mongoUrl);
  console.log('MongoDB connected successfully');
}

