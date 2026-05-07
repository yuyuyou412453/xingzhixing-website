"use strict";

const CACHE_KEY = "__xzxRadarLatestCache";

function getCache() {
  if (!globalThis[CACHE_KEY]) {
    globalThis[CACHE_KEY] = new Map();
  }
  return globalThis[CACHE_KEY];
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return {
    url: url.trim().replace(/\/+$/, ""),
    key: key.trim()
  };
}

function hasSupabase() {
  const cfg = getSupabaseConfig();
  return Boolean(cfg.url && cfg.key);
}

function toNumber(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return n;
}

function toInteger(value, fallback) {
  return Math.round(toNumber(value, fallback));
}

function toBoolean(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes" || v === "on") {
      return true;
    }
    if (v === "false" || v === "0" || v === "no" || v === "off") {
      return false;
    }
  }
  return fallback;
}

function normalizeRadar(raw, fallback) {
  const safeRaw = raw && typeof raw === "object" ? raw : {};
  const safeFallback = fallback && typeof fallback === "object" ? fallback : {};
  return {
    targetCount: Math.max(0, toInteger(safeRaw.targetCount, safeFallback.targetCount ?? 0)),
    speed: toNumber(safeRaw.speed, safeFallback.speed ?? 0),
    distance: Math.max(0, toNumber(safeRaw.distance, safeFallback.distance ?? 0)),
    alert: toBoolean(safeRaw.alert, safeFallback.alert ?? false)
  };
}

function normalizeSnapshot(payload) {
  const data = payload && typeof payload === "object" ? payload : {};
  const deviceIdRaw = typeof data.deviceId === "string" ? data.deviceId.trim() : "";
  if (!deviceIdRaw) {
    throw new Error("deviceId is required");
  }

  const timestamp = Number.isFinite(Number(data.timestamp))
    ? Number(data.timestamp)
    : Date.now();

  return {
    deviceId: deviceIdRaw,
    timestamp,
    radar: normalizeRadar(data.radar, null)
  };
}

function snapshotToLatestRow(snapshot) {
  return {
    device_id: snapshot.deviceId,
    updated_at: new Date(snapshot.timestamp).toISOString(),
    radar_target_count: snapshot.radar.targetCount,
    radar_speed: snapshot.radar.speed,
    radar_distance: snapshot.radar.distance,
    radar_alert: snapshot.radar.alert
  };
}

function latestRowToSnapshot(row) {
  const ts = Date.parse(row.updated_at || "");
  return {
    deviceId: row.device_id,
    timestamp: Number.isFinite(ts) ? ts : Date.now(),
    radar: {
      targetCount: Math.max(0, toInteger(row.radar_target_count, 0)),
      speed: toNumber(row.radar_speed, 0),
      distance: Math.max(0, toNumber(row.radar_distance, 0)),
      alert: toBoolean(row.radar_alert, false)
    }
  };
}

async function supabaseRequest(path, init) {
  const cfg = getSupabaseConfig();
  const url = `${cfg.url}${path}`;
  const res = await fetch(url, {
    method: init.method || "GET",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    body: init.body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text.slice(0, 400)}`);
  }

  if (init.expectText) {
    return res.text();
  }
  return res.json();
}

function getMemoryLatest(deviceId) {
  const cache = getCache();
  if (deviceId) {
    return cache.get(deviceId) || null;
  }
  let latest = null;
  cache.forEach((item) => {
    if (!latest || item.timestamp > latest.timestamp) {
      latest = item;
    }
  });
  return latest;
}

async function upsertRadarSnapshot(snapshot) {
  const cache = getCache();
  cache.set(snapshot.deviceId, snapshot);

  if (!hasSupabase()) {
    return { storage: "memory" };
  }

  const latestRow = snapshotToLatestRow(snapshot);
  await supabaseRequest("/rest/v1/telemetry_latest?on_conflict=device_id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify([latestRow]),
    expectText: true
  });

  try {
    await supabaseRequest("/rest/v1/radar_logs", {
      method: "POST",
      headers: {
        Prefer: "return=minimal"
      },
      body: JSON.stringify([
        {
          device_id: snapshot.deviceId,
          target_count: snapshot.radar.targetCount,
          speed: snapshot.radar.speed,
          distance: snapshot.radar.distance,
          alert: snapshot.radar.alert
        }
      ]),
      expectText: true
    });
  } catch (err) {
    /* radar_logs 是可选表，缺失时不影响主流程 */
  }

  return { storage: "supabase" };
}

async function readLatestSnapshot(deviceId) {
  if (!hasSupabase()) {
    return getMemoryLatest(deviceId);
  }

  const params = new URLSearchParams();
  params.set(
    "select",
    "device_id,updated_at,radar_target_count,radar_speed,radar_distance,radar_alert"
  );
  params.set("order", "updated_at.desc");
  params.set("limit", "1");
  if (deviceId) {
    params.set("device_id", `eq.${deviceId}`);
  }

  const rows = await supabaseRequest(`/rest/v1/telemetry_latest?${params.toString()}`, {
    method: "GET"
  });

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const snapshot = latestRowToSnapshot(rows[0]);
  getCache().set(snapshot.deviceId, snapshot);
  return snapshot;
}

module.exports = {
  hasSupabase,
  normalizeSnapshot,
  readLatestSnapshot,
  upsertRadarSnapshot
};

