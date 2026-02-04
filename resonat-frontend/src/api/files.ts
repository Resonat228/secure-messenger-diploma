// src/api/files.ts
import { apiClient } from "./client";

export type UploadedFile = {
  id: string;
  url: string;
  filename: string;
  size?: number;
  mime?: string;
};

export async function uploadFile(dialogId: string, file: File): Promise<UploadedFile> {
  const fd = new FormData();
  fd.append("dialog_id", dialogId);
  fd.append("file", file);

  const resp = await apiClient.post("/files/upload", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  const payload = resp.data;
  const f = payload.file ?? payload;

  return {
    id: f.id,
    url: f.url,
    filename: f.filename,
    size: f.size,
    mime: f.mime,
  };
}
