import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  NODE_ENV: process.env.NODE_ENV ?? "development",
  // Cloudinary
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ?? "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ?? "",
} as const;