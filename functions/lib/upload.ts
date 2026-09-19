// functions/lib/upload.ts
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_IMAGE_DIMENSION = 1920;
export const ALLOWED_IMAGE_TYPES = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif",
]);
export const ALLOWED_FILE_TYPES = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif",
  "application/pdf", "text/plain",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/json", "application/xml",
]);

export function validateUpload(file: { name: string; type?: string; size: number }): { ok: true } | { ok: false; code: string; message: string } {
  if (!file.type) return { ok: false, code: "NO_TYPE", message: "未提供文件类型" };
  if (!ALLOWED_FILE_TYPES.has(file.type)) return { ok: false, code: "BAD_TYPE", message: `不支持的文件类型: ${file.type}` };
  if (file.size <= 0) return { ok: false, code: "EMPTY", message: "文件为空" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, code: "TOO_LARGE", message: `文件超过 5MB (当前 ${(file.size / 1024 / 1024).toFixed(2)}MB)` };
  return { ok: true };
}
