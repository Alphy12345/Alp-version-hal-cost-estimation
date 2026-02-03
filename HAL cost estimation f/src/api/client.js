import axios from "axios";

const normalizeBaseUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  // Prevent accidental HTTPS when running local FastAPI without TLS.
  if (raw.startsWith("https://127.0.0.1") || raw.startsWith("https://localhost")) {
    return `http://${raw.slice("https://".length)}`;
  }
  return raw;
};

const api = axios.create({
  baseURL: normalizeBaseUrl(import.meta?.env?.VITE_API_BASE_URL) || "http://127.0.0.1:8000",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

export default api;
