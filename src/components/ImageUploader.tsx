import { Box, Button, Stack, ImageList, ImageListItem, ImageListItemBar, Alert, LinearProgress } from "@mui/material";
import ImageIcon from "@mui/icons-material/Image";
import { useState, useRef } from "react";
import imageCompression from "browser-image-compression";
import { uploadFile } from "@/lib/api";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

interface Props {
  bugId: number;
}

export default function ImageUploader({ bugId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);

  // 简单的"列出现有附件"懒实现: 通过 fetch 获取
  // 这里做最小完整 - 实际上应该复用 bug detail 返回的 attachments,简化先放附件列表直接读 props
  // 为了让组件独立,我们手动 GET 一次
  const refreshList = async () => {
    try {
      const r = await fetch(`/api/bugs/${bugId}/attachments`, { credentials: "same-origin" });
      if (r.ok) {
        const d: any = await r.json();
        setItems(d.items ?? []);
      }
    } catch {}
  };
  // 触发起一次
  useState(() => { refreshList(); /* eslint-disable-next-line */ });

  const handleFile = async (file: File) => {
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(`不支持的图片类型: ${file.type}`);
      return;
    }

    let toUpload: File | Blob = file;
    if (file.size > MAX_BYTES) {
      // 客户端压缩到 <= 4MB,保留原始 < 5MB
      try {
        setProgress(10);
        toUpload = await imageCompression(file, {
          maxSizeMB: 4,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          initialQuality: 0.85,
          onProgress: (p) => setProgress(10 + Math.floor(p * 70)),
        });
        setProgress(85);
      } catch (e: any) {
        setError(`压缩失败: ${e.message}`);
        return;
      }
    }

    if (toUpload.size > MAX_BYTES) {
      setError("压缩后仍然超过 5MB,请手动缩放后再上传");
      return;
    }

    try {
      setBusy(true);
      const outFile = toUpload instanceof File ? toUpload : new File([toUpload], file.name, { type: file.type });
      await uploadFile(`/api/bugs/${bugId}/attachments`, outFile);
      setProgress(100);
      await refreshList();
    } catch (e: any) {
      setError(`上传失败: ${e.message}`);
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(0), 800);
    }
  };

  return (
    <Box sx={{ mt: 2, p: 2, border: "1px dashed #ccc", borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" gap={2}>
        <Button
          variant="outlined"
          startIcon={<ImageIcon />}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "压缩/上传中…" : "上传图片"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <Box sx={{ color: "text.secondary", fontSize: 13 }}>支持 PNG/JPEG/WebP/GIF,自动压缩到 ≤ 5MB</Box>
      </Stack>
      {progress > 0 && <LinearProgress variant="determinate" value={progress} sx={{ mt: 1 }} />}
      {error && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>{error}</Alert>}
      {items.length > 0 && (
        <ImageList cols={3} rowHeight={120} sx={{ mt: 2, maxWidth: 480 }}>
          {items.map((a) => (
            <ImageListItem key={a.id}>
              <img src={`/api/attachments/${a.id}/image`} alt={a.filename} loading="lazy" />
              <ImageListItemBar title={a.filename} subtitle={`${(a.size / 1024).toFixed(0)} KB`} />
            </ImageListItem>
          ))}
        </ImageList>
      )}
    </Box>
  );
}
