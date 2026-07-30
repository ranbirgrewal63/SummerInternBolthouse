const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL =
  fromEnv && fromEnv.length > 0 ? fromEnv : "http://127.0.0.1:5050";
