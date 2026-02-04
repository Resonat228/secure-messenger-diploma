// src/api/messages.ts
import { api } from "./client";

export interface Message {
  id: string;
  dialog_id: string;
  sender_id: string;
  ciphertext: string;
  nonce: string;
  has_links: boolean;
  has_files: boolean;
  created_at: string;

  is_own?: boolean;
  text?: string;
}

export async function listMessages(dialogId: string): Promise<Message[]> {
  const res = await api.get<Message[]>(`/dialogs/${dialogId}/messages`);
  return res.data;
}

export async function sendMessage() {
  throw new Error("sendMessage should not be used, use WebSocket instead");
}
