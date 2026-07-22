"use strict";

const { hasSupabase, readLatestSnapshot } = require("./_lib/radar_store");

function setHeaders(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Device-Token");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
}

function sendJson(res, statusCode, payload) {
  setHeaders(res);
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}

function getDeviceId(req) {
  const host = req.headers.host || "localhost";
  const url = new URL(req.url || "/api/latest", `http://${host}`);
  const raw = (url.searchParams.get("deviceId") || "").trim();
  return raw || null;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  try {
    const deviceId = getDeviceId(req);
    const snapshot = await readLatestSnapshot(deviceId);
    if (!snapshot) {
      sendJson(res, 404, {
        ok: false,
        error: "no data",
        supabase: hasSupabase()
      });
      return;
    }

    const radar = snapshot.radar
      ? { ...snapshot.radar, alert: false }
      : null;

    sendJson(res, 200, {
      timestamp: snapshot.timestamp,
      radar,
      environment: snapshot.environment || null,
      network: snapshot.network || {
        latency: null,
        radarLatency: null,
        wetLatency: null,
        link: "unknown"
      },
      camera: snapshot.camera || {
        status: "normal",
        alert: false,
        imageUrl: "",
        updatedAt: snapshot.timestamp
      },
      gps: snapshot.gps || {
        lat: null,
        lon: null,
        alt: null,
        fixQuality: 0,
        satellites: 0
      },
      cloud: snapshot.cloud || {
        alarmSynced: Boolean(snapshot.camera && snapshot.camera.alert),
        cameraAlert: Boolean(snapshot.camera && snapshot.camera.alert),
        manualAlert: false,
        manualUpdatedAt: null,
        manualClearUntil: null,
        manualClearActive: false,
        finalAlert: Boolean(snapshot.camera && snapshot.camera.alert),
        correction: {
          active: false,
          status: "normal",
          code: 1,
          ttlMs: 0,
          expiresAt: null
        }
      },
      deviceId: snapshot.deviceId
    });
  } catch (err) {
    sendJson(res, 500, {
      ok: false,
      error: err && err.message ? err.message : "internal error"
    });
  }
};
