import mongoose from "mongoose";

export const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error("❌ MONGO_URI is undefined");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log("MongoDB Connected 🚀");
  } catch (err) {
    console.error("DB Connection Failed ❌", err);
    process.exit(1);
  }
};
