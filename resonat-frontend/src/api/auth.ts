// src/api/auth.ts
import { api } from "./client";

export interface User {
  id: string;
  email: string;
}

export interface LoginResponse {
  access_token: string;
  user: User;
}


export async function login(
  email: string,
  password: string,
  totp?: string
): Promise<LoginResponse> {
  const resp = await api.post<LoginResponse>("/auth/login", {
    email,
    password,
    totp,
  });
  return resp.data;
}

export async function register(
  email: string,
  password: string
): Promise<LoginResponse> {
  const resp = await api.post<LoginResponse>("/auth/register", {
    email,
    password,
  });
  return resp.data;
}
