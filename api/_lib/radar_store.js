"use strict";

const CACHE_KEY = "__xzxRadarLatestCache";

function getCache() {
  if (!globalThis[CACHE_KEY]) {
    globalThis[CACHE_KEY] = new Map();
  }
  return globalThis[CACHE_KEY];
}

function getSchemaCaps() {
  /* 不持久缓存 schema 能力，避免“已加列但进程仍沿用旧能力”导致环境字段长期被丢弃 */
  return {
    supportsRadarXY: true,
    supportsEnvironment: true
  };
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
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
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
  const x = toNumber(
    safeRaw.x ?? safeRaw.posX ?? safeRaw.targetX ?? safeRaw.coordinateX,
    safeFallback.x ?? null
  );
  const y = toNumber(
    safeRaw.y ?? safeRaw.posY ?? safeRaw.targetY ?? safeRaw.coordinateY,
    safeFallback.y ?? null
  );
  const hasXY = Number.isFinite(x) && Number.isFinite(y);
  return {
    targetCount: Math.max(0, toInteger(safeRaw.targetCount, safeFallback.targetCount ?? (hasXY ? 1 : 0))),
    speed: toNumber(safeRaw.speed, safeFallback.speed ?? 0),
    distance: Math.max(0, toNumber(safeRaw.distance, safeFallback.distance ?? 0)),
    x,
    y,
    alert: toBoolean(safeRaw.alert, safeFallback.alert ?? false)
  };
}

function normalizeEnvironment(raw, fallback) {
  const safeRaw = raw && typeof raw === "object" ? raw : {};
  const safeFallback = fallback && typeof fallback === "object" ? fallback : {};

  const temperature = toNumber(
    safeRaw.temperature ??
      safeRaw.temp ??
      safeRaw.temperature_c ??
      safeRaw.temperatureC ??
      (safeRaw.temperature_x10 !== undefined ? Number(safeRaw.temperature_x10) / 10 : undefined),
    safeFallback.temperature ?? null
  );
  const humidity = toNumber(
    safeRaw.humidity ??
      safeRaw.humi ??
      (safeRaw.humidity_x10 !== undefined ? Number(safeRaw.humidity_x10) / 10 : undefined),
    safeFallback.humidity ?? null
  );
  const pressure = toNumber(
    safeRaw.pressure ??
      safeRaw.pressure_hpa ??
      (safeRaw.pressure_x10 !== undefined ? Number(safeRaw.pressure_x10) / 10 : undefined),
    safeFallback.pressure ?? null
  );
  const altitude = toNumber(
    safeRaw.altitude ??
      safeRaw.alt ??
      (safeRaw.altitude_x10 !== undefined ? Number(safeRaw.altitude_x10) / 10 : undefined),
    safeFallback.altitude ?? null
  );

  return {
    temperature,
    humidity,
    pressure,
    altitude
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

  const cache = getCache();
  const previous = cache.get(deviceIdRaw) || null;

  return {
    deviceId: deviceIdRaw,
    timestamp,
    radar: normalizeRadar(data.radar, previous ? previous.radar : null),
    environment: normalizeEnvironment(data.environment, previous ? previous.environment : null)
  };
}

function snapshotToLatestRow(snapshot) {
  return {
    device_id: snapshot.deviceId,
    updated_at: new Date(snapshot.timestamp).toISOString(),
    radar_target_count: snapshot.radar.targetCount,
    radar_speed: snapshot.radar.speed,
    radar_distance: snapshot.radar.distance,
    radar_x: snapshot.radar.x,
    radar_y: snapshot.radar.y,
    radar_alert: snapshot.radar.alert,
    env_temperature: snapshot.environment.temperature,
    env_humidity: snapshot.environment.humidity,
    env_pressure: snapshot.environment.pressure,
    env_altitude: snapshot.environment.altitude
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
      x: toNumber(row.radar_x, null),
      y: toNumber(row.radar_y, null),
      alert: toBoolean(row.radar_alert, false)
    },
    environment: {
      temperature: toNumber(row.env_temperature, null),
      humidity: toNumber(row.env_humidity, null),
      pressure: toNumber(row.env_pressure, null),
      altitude: toNumber(row.env_altitude, null)
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

function isMissingRadarXYColumnError(err) {
  const msg = String((err && err.message) || "").toLowerCase();
  return msg.includes("radar_x") || msg.includes("radar_y");
}

function isMissingEnvironmentColumnError(err) {
  const msg = String((err && err.message) || "").toLowerCase();
  return msg.includes("env_temperature") ||
    msg.includes("env_humidity") ||
    msg.includes("env_pressure") ||
    msg.includes("env_altitude");
}

function dropXYFromLatestRow(row) {
  const { radar_x, radar_y, ...rest } = row;
  return rest;
}

function dropEnvironmentFromLatestRow(row) {
  const { env_temperature, env_humidity, env_pressure, env_altitude, ...rest } = row;
  return rest;
}

async function upsertRadarSnapshot(snapshot) {
  const cache = getCache();
  const caps = getSchemaCaps();
  cache.set(snapshot.deviceId, snapshot);

  if (!hasSupabase()) {
    return { storage: "memory" };
  }

  let latestRow = snapshotToLatestRow(snapshot);
  if (!caps.supportsRadarXY) {
    latestRow = dropXYFromLatestRow(latestRow);
  }
  if (!caps.supportsEnvironment) {
    latestRow = dropEnvironmentFromLatestRow(latestRow);
  }

  try {
    await supabaseRequest("/rest/v1/telemetry_latest?on_conflict=device_id", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify([latestRow]),
      expectText: true
    });
  } catch (err) {
    const missingXY = caps.supportsRadarXY && isMissingRadarXYColumnError(err);
    const missingEnv = caps.supportsEnvironment && isMissingEnvironmentColumnError(err);
    if (!missingXY && !missingEnv) {
      throw err;
    }
    if (missingXY) {
      caps.supportsRadarXY = false;
    }
    if (missingEnv) {
      caps.supportsEnvironment = false;
    }
    latestRow = snapshotToLatestRow(snapshot);
    if (!caps.supportsRadarXY) {
      latestRow = dropXYFromLatestRow(latestRow);
    }
    if (!caps.supportsEnvironment) {
      latestRow = dropEnvironmentFromLatestRow(latestRow);
    }
    await supabaseRequest("/rest/v1/telemetry_latest?on_conflict=device_id", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify([latestRow]),
      expectText: true
    });
  }

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
          x: snapshot.radar.x,
          y: snapshot.radar.y,
          alert: snapshot.radar.alert
        }
      ]),
      expectText: true
    });
  } catch (err) {
    /* optional logs table */
  }

  return {
    storage: "supabase",
    supportsEnvironment: caps.supportsEnvironment
  };
}

async function readLatestSnapshot(deviceId) {
  if (!hasSupabase()) {
    return getMemoryLatest(deviceId);
  }

  const caps = getSchemaCaps();

  const buildQuery = () => {
    const selectParts = [
      "device_id",
      "updated_at",
      "radar_target_count",
      "radar_speed",
      "radar_distance",
      "radar_alert"
    ];
    if (caps.supportsRadarXY) {
      selectParts.push("radar_x", "radar_y");
    }
    if (caps.supportsEnvironment) {
      selectParts.push("env_temperature", "env_humidity", "env_pressure", "env_altitude");
    }

    const params = new URLSearchParams();
    params.set("select", selectParts.join(","));
    params.set("order", "updated_at.desc");
    params.set("limit", "1");
    if (deviceId) {
      params.set("device_id", `eq.${deviceId}`);
    }
    return params.toString();
  };

  let rows;
  try {
    rows = await supabaseRequest(`/rest/v1/telemetry_latest?${buildQuery()}`, {
      method: "GET"
    });
  } catch (err) {
    const missingXY = caps.supportsRadarXY && isMissingRadarXYColumnError(err);
    const missingEnv = caps.supportsEnvironment && isMissingEnvironmentColumnError(err);
    if (!missingXY && !missingEnv) {
      throw err;
    }
    if (missingXY) {
      caps.supportsRadarXY = false;
    }
    if (missingEnv) {
      caps.supportsEnvironment = false;
    }
    rows = await supabaseRequest(`/rest/v1/telemetry_latest?${buildQuery()}`, {
      method: "GET"
    });
  }

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
