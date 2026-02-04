// src/api/dialogs.ts
import { api } from "./client";

export interface Dialog {
  id: string;
  is_group: boolean;
  created_at: string;

  other_user_id?: string;
  other_user_email?: string;
  other_user_public_key?: string;
}

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
  author_id?: string;
  text?: string;
}

export async function createDialog(target_user_id: string): Promise<Dialog> {
  const res = await api.post("/dialogs", { target_user_id });
  return res.data;
}

export async function listDialogs(): Promise<Dialog[]> {
  const res = await api.get("/dialogs");
  return res.data;
}

export async function listMessages(dialogId: string) {
  const res = await api.get<Message[]>(`/dialogs/${dialogId}/messages`);
  return res.data;
}

export async function sendMessage(payload: {
  dialog_id: string;
  ciphertext: string;
  nonce: string;
  has_links: boolean;
  has_files: boolean;
}) {
  const res = await api.post<Message>("/messages", payload);
  return res.data;
}
