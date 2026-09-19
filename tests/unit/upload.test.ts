// tests/unit/upload.test.ts
import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, validateUpload } from "../../functions/lib/upload";

describe("上传校验", () => {
  it("PNG 在限额内 OK", () => {
    expect(validateUpload({ name: "a.png", type: "image/png", size: 1024 })).toEqual({ ok: true });
  });

  it("超过 5MB 拒绝", () => {
    const res = validateUpload({ name: "a.png", type: "image/png", size: MAX_UPLOAD_BYTES + 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("TOO_LARGE");
    }
  });

  it("0 字节拒绝", () => {
    const res = validateUpload({ name: "a.png", type: "image/png", size: 0 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("EMPTY");
  });

  it("未提供 type 拒绝", () => {
    const res = validateUpload({ name: "a", size: 100 });
    expect(res.ok).toBe(false);
  });

  it("非法类型拒绝 (exe)", () => {
    const res = validateUpload({ name: "a.exe", type: "application/x-msdownload", size: 100 });
    expect(res.ok).toBe(false);
  });

  it("PDF 类型允许", () => {
    expect(validateUpload({ name: "a.pdf", type: "application/pdf", size: 1024 }).ok).toBe(true);
  });

  it("常见压缩包允许", () => {
    expect(validateUpload({ name: "a.zip", type: "application/zip", size: 1024 }).ok).toBe(true);
  });
});
