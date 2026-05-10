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

    sendJson(res, 200, {
      timestamp: snapshot.timestamp,
      radar: snapshot.radar,
      environment: snapshot.environment || null,
      gps: {
        alt: snapshot.environment && Number.isFinite(Number(snapshot.environment.altitude))
          ? Number(snapshot.environment.altitude)
          : null
      },
      cloud: {
        alarmSynced: Boolean(snapshot.radar && snapshot.radar.alert)
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
