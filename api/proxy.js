// unibridge-landing/api/proxy.js

import crypto from "crypto";

const API_BASE = process.env.UNIBRIDGE_API_BASE;
const SECRET = process.env.SURFACE_HMAC_SECRET;

const ALLOWED = new Set([
  "session/register",
  "session/resolve",
  "session/quote",
  "settlement/create",
  "settlement/confirm",
  "funding/session",
  "settlement/status",

  /*
  --------------------------------------------------
  Surface payout options
  --------------------------------------------------
  */

  "surface/options/coinsph/ph-payout-channels",

  "ramp/auth/start",
  "ramp/auth/verify",
  "ramp/user",
  "ramp/kyc/requirement",
  "ramp/kyc/user",
  "ramp/order/create",
  "ramp/order/confirm-payment",
  "ramp/order/status"
]);

function normalizeEndpoint(value) {
  return String(value || "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function buildUpstreamUrl(endpoint, query = {}) {
  const url = new URL(`${API_BASE}/${endpoint}`);

  Object.entries(query || {}).forEach(([key, value]) => {
    if (
      key === "endpoint" ||
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

function buildSignature(payload) {
  return crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("hex");
}

function parseUpstreamText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function getAllowedMethod(endpoint) {
  if (
    endpoint === "settlement/status" ||
    endpoint === "ramp/user" ||
    endpoint === "ramp/kyc/requirement" ||
    endpoint === "ramp/order/status" ||
    endpoint === "surface/options/coinsph/ph-payout-channels"
  ) {
    return "GET";
  }

  if (endpoint === "ramp/kyc/user") {
    return "PATCH";
  }

  return "POST";
}

function normalizeForwardedFor(value) {
  if (Array.isArray(value)) {
    return value.join(",");
  }

  return value || "";
}

export default async function handler(req, res) {
  try {
    if (!API_BASE || !SECRET) {
      return res.status(500).json({
        error: "server_misconfigured"
      });
    }

    const endpoint = normalizeEndpoint(req.query.endpoint);

    if (!endpoint) {
      return res.status(400).json({
        error: "missing_endpoint"
      });
    }

    if (!ALLOWED.has(endpoint)) {
      return res.status(403).json({
        error: "endpoint_not_allowed"
      });
    }

    const expectedMethod = getAllowedMethod(endpoint);
    const incomingMethod = String(req.method || "").toUpperCase();

    if (incomingMethod !== expectedMethod) {
      return res.status(405).json({
        error: "method_not_allowed"
      });
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 15000);

    let upstream;

    try {
      const headers = {
        "x-ub-partner-id": "surface",
        "x-forwarded-host": req.headers.host || "",
        "x-forwarded-for": normalizeForwardedFor(
          req.headers["x-forwarded-for"]
        )
      };

      if (incomingMethod === "GET") {
        upstream = await fetch(
          buildUpstreamUrl(endpoint, req.query),
          {
            method: "GET",
            headers,
            signal: controller.signal
          }
        );
      } else {
        const payload = JSON.stringify(req.body || {});

        if (payload.length > 10000) {
          return res.status(413).json({
            error: "payload_too_large"
          });
        }

        headers["content-type"] = "application/json";
        headers["x-ub-signature"] = buildSignature(payload);

        upstream = await fetch(
          buildUpstreamUrl(endpoint),
          {
            method: incomingMethod,
            headers,
            body: payload,
            signal: controller.signal
          }
        );
      }
    } finally {
      clearTimeout(timeout);
    }

    const text = await upstream.text();
    const data = parseUpstreamText(text);

    return res.status(upstream.status).json(data);
  } catch (err) {
    console.error("PROXY_ERROR", err);

    if (err?.name === "AbortError") {
      return res.status(504).json({
        error: "upstream_timeout"
      });
    }

    return res.status(500).json({
      error: "surface_proxy_error"
    });
  }
}
