"use strict";

const { hasSupabase, normalizeSnapshot, upsertRadarSnapshot } = require("./_lib/radar_store");

function setHeaders(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Device-Token");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function sendJson(res, statusCode, payload) {
  setHeaders(res);
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}

function isTokenValid(req) {
  const expected = (
    process.env.XZX_DEVICE_TOKEN ||
    process.env.DEVICE_TOKEN ||
    ""
  ).trim();
  if (!expected) {
    return true;
  }

  const actual = String(req.headers["x-device-token"] || "").trim();
  return actual === expected;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  if (typeof req.body === "string" && req.body.length > 0) {
    return JSON.parse(req.body);
  }

  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("payload too large"));
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error("invalid json"));
      }
    });
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  if (!isTokenValid(req)) {
    sendJson(res, 401, { ok: false, error: "invalid token" });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const snapshot = normalizeSnapshot(body);
    const result = await upsertRadarSnapshot(snapshot);

    sendJson(res, 200, {
      ok: true,
      storage: result.storage,
      supabase: hasSupabase(),
      data: snapshot
    });
  } catch (err) {
    sendJson(res, 400, {
      ok: false,
      error: err && err.message ? err.message : "bad request"
    });
  }
};

