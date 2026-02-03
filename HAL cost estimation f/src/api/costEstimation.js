import api from "./client";

let cachedEndpoint = null;

const endpointsToTry = [
  "/cost-estimation/calculate",
  "/cost-estimation/calculate/",
  "/calculate-cost/",
  "/calculate-cost",
];

export async function calculateCostEstimation(payload) {
  const lastErrorByEndpoint = {};

  const attempt = async (endpoint) => {
    try {
      const res = await api.post(endpoint, payload);
      cachedEndpoint = endpoint;
      return res;
    } catch (err) {
      lastErrorByEndpoint[endpoint] = err;

      const status = err?.response?.status;
      if (status === 404) {
        const detail = err?.response?.data?.detail;
        // Only fall back when FastAPI router returns its generic 404 for a missing route.
        if (detail === "Not Found") return null;
        // Otherwise it's a real domain-level 404 (e.g. machine not found), so surface it.
        throw err;
      }

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
