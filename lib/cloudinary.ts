import { v2 as cloudinary } from "cloudinary";

function getClient() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
}

export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  resourceType: "image" | "video" = "image"
): Promise<{ publicId: string; url: string }> {
  const client = getClient();
  return new Promise((resolve, reject) => {
    client.uploader
      .upload_stream(
        {
          folder: `boxboss/${folder}`,
          resource_type: resourceType,
          ...(resourceType === "image" ? { transformation: [{ quality: "auto", fetch_format: "auto" }] } : {}),
        },
        (error, result) => {
          if (error || !result) {
            reject(error || new Error("Upload failed"));
          } else {
            resolve({
              publicId: result.public_id,
              url: result.secure_url,
            });
          }
        }
      )
      .end(buffer);
  });
}

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  const client = getClient();
  await client.uploader.destroy(publicId);
}
