"use strict";

const { assembleImageChunk, updateCameraImage } = require("./_lib/radar_store");

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
  if (!expected) return true;
  const actual = String(req.headers["x-device-token"] || "").trim();
  return actual === expected;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.length > 0) return JSON.parse(req.body);

  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 8 * 1024 * 1024) reject(new Error("payload too large"));
    });
    req.on("end", () => {
      if (!raw) { resolve({}); return; }
      try { resolve(JSON.parse(raw)); } catch (_) { reject(new Error("invalid json")); }
    });
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") { sendJson(res, 200, { ok: true }); return; }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  if (!isTokenValid(req)) {
    sendJson(res, 401, { ok: false, error: "invalid token" });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, { ok: false, error: err && err.message ? err.message : "bad request" });
    return;
  }

  const deviceId = String(body.deviceId || body.device_id || "").trim();
  const cam = body.camera || {};
  const seq = Number(cam.seq ?? 0);
  const total = Number(cam.total ?? 0);
  const offset = Number(cam.offset ?? 0);
  const dataHex = String(cam.dataHex || "").trim();
  const mime = String(cam.mime || "image/jpeg").trim();
  const status = String(cam.status || "normal");
  const alert = Boolean(cam.alert);

  if (!deviceId || !dataHex || total <= 0) {
    sendJson(res, 400, { ok: false, error: "missing required fields" });
    return;
  }

  try {
    const result = assembleImageChunk({ deviceId, seq, total, offset, dataHex, mime, status, alert });

    if (!result.done) {
      sendJson(res, 200, { ok: true, done: false });
      return;
    }

    if (!result.imageUrl) {
      sendJson(res, 200, { ok: true, done: true, warning: "assembly failed" });
      return;
    }

    const storeResult = await updateCameraImage(deviceId, result.imageUrl, status, alert);
    sendJson(res, 200, { ok: true, done: true, storage: storeResult.storage });
  } catch (err) {
    sendJson(res, 500, {
      ok: false,
      error: err && err.message ? err.message : "internal error"
    });
  }
};
