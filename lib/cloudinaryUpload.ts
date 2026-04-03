import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "@/lib/cloudinary";

export async function uploadImageFileToCloudinary(
  file: File,
  opts?: { folder?: string; tag?: string; signal?: AbortSignal },
) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const form = new FormData();
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  if (opts?.folder) form.append("folder", opts.folder);
  if (opts?.tag) form.append("tags", opts.tag);
  form.append("file", file);

  const res = await fetch(url, {
    method: "POST",
    body: form,
    signal: opts?.signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String((data as any)?.error?.message || "Cloudinary upload failed"));
  }

  return {
    secureUrl: String((data as any).secure_url || ""),
    publicId: String((data as any).public_id || ""),
    width: Number((data as any).width || 0),
    height: Number((data as any).height || 0),
  };
}

