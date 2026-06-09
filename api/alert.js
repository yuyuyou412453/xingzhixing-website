"use strict";

const { hasSupabase, updateManualAlert } = require("./_lib/radar_store");

const DEFAULT_DEVICE_ID = "xzx-a12";

function setHeaders(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function sendJson(res, statusCode, payload) {
  setHeaders(res);
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
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
      if (raw.length > 64 * 1024) {
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

  try {
    const body = await readJsonBody(req);
    const alert = Boolean(body.alert);
    const deviceId = String(body.deviceId || DEFAULT_DEVICE_ID).trim() || DEFAULT_DEVICE_ID;
    const snapshot = await updateManualAlert(deviceId, alert);

    sendJson(res, 200, {
      ok: true,
      storage: hasSupabase() ? "supabase" : "memory",
      supabase: hasSupabase(),
      cloud: snapshot.cloud,
      camera: snapshot.camera,
      deviceId
    });
  } catch (err) {
    sendJson(res, 400, {
      ok: false,
      error: err && err.message ? err.message : "bad request"
    });
  }
};
