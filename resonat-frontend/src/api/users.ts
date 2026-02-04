import { apiClient } from "./client";

export interface UserShort {
  id: string;
  email: string;
}

export async function searchUsers(query: string) {
    const resp = await apiClient.get(`/users/search`, {
        params: { q: query },
    });
    return resp.data;
}

export async function getMe(): Promise<UserShort> {
  const resp = await apiClient.get("/users/me");
  return resp.data;
}

export async function setMyPublicKey(public_key: string) {
  await apiClient.put("/users/me/public-key", { public_key });
}
