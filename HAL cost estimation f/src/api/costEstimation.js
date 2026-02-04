import api from "./client";

let cachedEndpoint = null;

const endpointsToTry = [
  "/cost-estimation/calculate/",
  "/cost-estimation/calculate",
  "/calculate-cost/",
  "/calculate-cost",
];

function isRouteMissing404(err) {
  const status = err?.response?.status;
  if (status !== 404) return false;

  const data = err?.response?.data;
  const contentType = String(err?.response?.headers?.["content-type"] || "").toLowerCase();

  // Typical FastAPI route-missing response: {"detail":"Not Found"}
  const detail = data && typeof data === "object" ? data.detail : undefined;
  if (detail === "Not Found" || detail === "Not Found.") return true;

  // Sometimes proxies/servers return HTML 404 pages.
  if (contentType.includes("text/html")) return true;

  // Some environments return an empty body on missing routes.
  if (data == null || data === "") return true;

  // Or a plain-text message.
  if (typeof data === "string" && data.toLowerCase().includes("not found")) return true;

  return false;
}

export async function calculateCostEstimation(payload) {
  const lastErrorByEndpoint = {};

  const attempt = async (endpoint) => {
    try {
      const res = await api.post(endpoint, payload);
      cachedEndpoint = endpoint;
      return res;
    } catch (err) {
      lastErrorByEndpoint[endpoint] = err;

      // Fallback across a couple of possible backend routes.
      // Only retry when the 404 represents a missing API route.
      if (isRouteMissing404(err)) return null;

      // For non-404 errors, the endpoint exists but request failed (validation, etc.)
      throw err;
    }
  };

  if (cachedEndpoint) {
    const res = await attempt(cachedEndpoint);
    if (res) return res;
    cachedEndpoint = null;
  }

  for (const endpoint of endpointsToTry) {
    const res = await attempt(endpoint);
    if (res) return res;
  }

  const err = lastErrorByEndpoint[endpointsToTry[0]];
  throw err || new Error("Cost estimation endpoint not found");
}

export async function calculateCostEstimationBatch(payload) {
  // New backend endpoint added: POST /cost-estimation/calculate-batch
  // Keep a couple of fallback variants (with/without trailing slash) to avoid route mismatch 404 loops.
  const endpoints = [
    "/cost-estimation/calculate-batch/",
    "/cost-estimation/calculate-batch",
  ];

  const lastErrorByEndpoint = {};

  for (const endpoint of endpoints) {
    try {
      return await api.post(endpoint, payload);
    } catch (err) {
      lastErrorByEndpoint[endpoint] = err;
      if (isRouteMissing404(err)) continue;
      throw err;
    }
  }

  const err = lastErrorByEndpoint[endpoints[0]];
  throw err || new Error("Cost estimation batch endpoint not found");
}
