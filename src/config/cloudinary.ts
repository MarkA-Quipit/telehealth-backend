import { v2 as cloudinary } from "cloudinary";
import { env } from "./env";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

/**
 * Upload an image buffer to Cloudinary and return the secure URL.
 * public_id: telehealth/avatars/{userId} — overwrites existing avatar.
 */
export async function uploadAvatarBuffer(
  userId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: `telehealth/avatars/${userId}`,
        overwrite: true,
        resource_type: "image",
        format: mimeType.split("/")[1] ?? "jpg",
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Cloudinary returned no result"));
        resolve(result.secure_url);
      },
    );
    uploadStream.end(buffer);
  });
}

export async function uploadDocumentBuffer(
  patientId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const safeFileName = fileName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: `telehealth/documents/${patientId}/${Date.now()}-${safeFileName}`,
        resource_type: "auto",
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Cloudinary returned no result"));
        resolve(result.secure_url);
      },
    );
    uploadStream.end(buffer);
  });
}

export default cloudinary;