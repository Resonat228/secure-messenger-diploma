// src/api/client.ts
import axios from "axios";
import { useAuthStore } from "../store/authStore";

export const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
});


api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;

    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export const apiClient = api;