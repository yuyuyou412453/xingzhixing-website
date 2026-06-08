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
    supportsEnvironment: true,
    supportsNetwork: true,
    supportsCamera: true
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

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function hasAnyOwn(obj, keys) {
  return keys.some((key) => hasOwn(obj, key));
}

function normalizeRadar(raw, fallback) {
  const safeRaw = isObject(raw) ? raw : {};
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
  const safeRaw = isObject(raw) ? raw : {};
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

function normalizeNetwork(raw, fallback) {
  const safeRaw = isObject(raw) ? raw : {};
  const safeFallback = fallback && typeof fallback === "object" ? fallback : {};

  return {
    latency: toNumber(
      safeRaw.latency ??
        safeRaw.delay ??
        safeRaw.rtt ??
        safeRaw.ping,
      safeFallback.latency ?? null
    ),
    link: String(
      safeRaw.link ??
        safeRaw.status ??
        safeFallback.link ??
        "unknown"
    )
  };
}

function getCameraRaw(data) {
  if (isObject(data.camera)) {
    return data.camera;
  }
  if (isObject(data.traffic)) {
    return data.traffic;
  }
  return {};
}

function normalizeCameraStatus(rawStatus, alert) {
  const value = String(rawStatus || "").trim().toLowerCase();
  if (value === "0x02" || value === "2" || value === "accident" || value === "crash" || value === "alert" || value === "warning") {
    return "accident";
  }
  if (value === "0x01" || value === "1" || value === "normal" || value === "safe" || value === "ok" || value === "clear") {
    return "normal";
  }
  return alert ? "accident" : "normal";
}

function normalizeCamera(raw, fallback) {
  const safeRaw = isObject(raw) ? raw : {};
  const safeFallback = fallback && typeof fallback === "object" ? fallback : {};
  const rawAlert = safeRaw.alert ?? safeRaw.accident ?? safeRaw.crash ?? safeRaw.warning;
  const alert = toBoolean(rawAlert, safeFallback.alert ?? false);
  const status = normalizeCameraStatus(
    safeRaw.status ?? safeRaw.state ?? safeRaw.code ?? safeRaw.statusCode ?? safeFallback.status,
    alert
  );
  const imageUrl = String(
    safeRaw.imageUrl ??
      safeRaw.photoUrl ??
      safeRaw.url ??
      safeFallback.imageUrl ??
      ""
  );

  return {
    status,
    alert: status === "accident" || alert,
    imageUrl,
    updatedAt: normalizeTimestamp(safeRaw.updatedAt ?? safeRaw.timestamp ?? safeFallback.updatedAt ?? Date.now())
  };
}

function getPresence(payload) {
  const data = payload && typeof payload === "object" ? payload : {};
  const radar = isObject(data.radar) ? data.radar : {};
  const environment = isObject(data.environment) ? data.environment : {};
  const network = isObject(data.network) ? data.network : {};
  const camera = getCameraRaw(data);

  return {
    radar: {
      any: isObject(data.radar),
      targetCount: hasOwn(radar, "targetCount"),
      speed: hasOwn(radar, "speed"),
      distance: hasOwn(radar, "distance"),
      x: hasAnyOwn(radar, ["x", "posX", "targetX", "coordinateX"]),
      y: hasAnyOwn(radar, ["y", "posY", "targetY", "coordinateY"]),
      alert: hasOwn(radar, "alert")
    },
    environment: {
      any: isObject(data.environment),
      temperature: hasAnyOwn(environment, ["temperature", "temp", "temperature_c", "temperatureC", "temperature_x10"]),
      humidity: hasAnyOwn(environment, ["humidity", "humi", "humidity_x10"]),
      pressure: hasAnyOwn(environment, ["pressure", "pressure_hpa", "pressure_x10"]),
      altitude: hasAnyOwn(environment, ["altitude", "alt", "altitude_x10"])
    },
    network: {
      any: isObject(data.network),
      latency: hasAnyOwn(network, ["latency", "delay", "rtt", "ping"]),
      link: hasAnyOwn(network, ["link", "status"])
    },
    camera: {
      any: isObject(data.camera) || isObject(data.traffic),
      status: hasAnyOwn(camera, ["status", "state", "code", "statusCode", "alert", "accident", "crash", "warning"]),
      alert: hasAnyOwn(camera, ["alert", "accident", "crash", "warning"]),
      imageUrl: hasAnyOwn(camera, ["imageUrl", "photoUrl", "url"]),
      updatedAt: hasAnyOwn(camera, ["updatedAt", "timestamp"])
    }
  };
}

function normalizeTimestamp(rawTimestamp) {
  const now = Date.now();
  const ts = Number(rawTimestamp);

  if (!Number.isFinite(ts)) {
    return now;
  }

  /* 主板上报常见为开机毫秒(jiffies)，会落在 1970 年，这里自动改为服务器当前时间 */
  if (ts < 1577836800000) { /* 2020-01-01T00:00:00.000Z */
    return now;
  }

  /* 防止异常未来时间污染排序 */
  if (ts > now + 24 * 60 * 60 * 1000) {
    return now;
  }

  return ts;
}

function normalizeSnapshot(payload) {
  const data = payload && typeof payload === "object" ? payload : {};
  const deviceIdRaw = typeof data.deviceId === "string" ? data.deviceId.trim() : "";
  if (!deviceIdRaw) {
    throw new Error("deviceId is required");
  }

  const timestamp = normalizeTimestamp(data.timestamp);

  const cache = getCache();
  const previous = cache.get(deviceIdRaw) || null;

  return {
    deviceId: deviceIdRaw,
    timestamp,
    _present: getPresence(data),
    radar: normalizeRadar(data.radar, previous ? previous.radar : null),
    environment: normalizeEnvironment(data.environment, previous ? previous.environment : null),
    network: normalizeNetwork(data.network, previous ? previous.network : null),
    camera: normalizeCamera(getCameraRaw(data), previous ? previous.camera : null)
  };
}

function snapshotToLatestRow(snapshot) {
  const present = snapshot._present || {
    radar: { targetCount: true, speed: true, distance: true, x: true, y: true, alert: true },
    environment: { temperature: true, humidity: true, pressure: true, altitude: true },
    network: { latency: true, link: true },
    camera: { status: true, alert: true, imageUrl: true, updatedAt: true }
  };
  const row = {
    device_id: snapshot.deviceId,
    updated_at: new Date(snapshot.timestamp).toISOString()
  };

  if (present.radar.targetCount) {
    row.radar_target_count = snapshot.radar.targetCount;
  }
  if (present.radar.speed) {
    row.radar_speed = snapshot.radar.speed;
  }
  if (present.radar.distance) {
    row.radar_distance = snapshot.radar.distance;
  }
  if (present.radar.x) {
    row.radar_x = snapshot.radar.x;
  }
  if (present.radar.y) {
    row.radar_y = snapshot.radar.y;
  }
  if (present.radar.alert) {
    row.radar_alert = false;
  }
  if (present.environment.temperature) {
    row.env_temperature = snapshot.environment.temperature;
  }
  if (present.environment.humidity) {
    row.env_humidity = snapshot.environment.humidity;
  }
  if (present.environment.pressure) {
    row.env_pressure = snapshot.environment.pressure;
  }
  if (present.environment.altitude) {
    row.env_altitude = snapshot.environment.altitude;
  }
  if (present.network.latency) {
    row.net_latency = snapshot.network.latency;
  }
  if (present.network.link) {
    row.net_link = snapshot.network.link;
  }
  if (present.camera && (present.camera.status || present.camera.alert)) {
    row.camera_status = snapshot.camera.status;
  }
  if (present.camera && present.camera.alert) {
    row.camera_alert = snapshot.camera.alert;
  }
  if (present.camera && present.camera.imageUrl) {
    row.camera_image_url = snapshot.camera.imageUrl;
  }
  if (present.camera && (present.camera.updatedAt || present.camera.status || present.camera.alert || present.camera.imageUrl)) {
    row.camera_updated_at = new Date(snapshot.camera.updatedAt).toISOString();
  }

  return row;
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
      alert: false
    },
    environment: {
      temperature: toNumber(row.env_temperature, null),
      humidity: toNumber(row.env_humidity, null),
      pressure: toNumber(row.env_pressure, null),
      altitude: toNumber(row.env_altitude, null)
    },
    network: {
      latency: toNumber(row.net_latency, null),
      link: String(row.net_link ?? "unknown")
    },
    camera: {
      status: normalizeCameraStatus(row.camera_status, toBoolean(row.camera_alert, false)),
      alert: toBoolean(row.camera_alert, false),
      imageUrl: String(row.camera_image_url ?? ""),
      updatedAt: normalizeTimestamp(Date.parse(row.camera_updated_at || row.updated_at || ""))
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

function isMissingNetworkColumnError(err) {
  const msg = String((err && err.message) || "").toLowerCase();
  return msg.includes("net_latency") || msg.includes("net_link");
}

function isMissingCameraColumnError(err) {
  const msg = String((err && err.message) || "").toLowerCase();
  return msg.includes("camera_status") ||
    msg.includes("camera_alert") ||
    msg.includes("camera_image_url") ||
    msg.includes("camera_updated_at");
}

function dropXYFromLatestRow(row) {
  const { radar_x, radar_y, ...rest } = row;
  return rest;
}

function dropEnvironmentFromLatestRow(row) {
  const { env_temperature, env_humidity, env_pressure, env_altitude, ...rest } = row;
  return rest;
}

function dropNetworkFromLatestRow(row) {
  const { net_latency, net_link, ...rest } = row;
  return rest;
}

function dropCameraFromLatestRow(row) {
  const { camera_status, camera_alert, camera_image_url, camera_updated_at, ...rest } = row;
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
  if (!caps.supportsNetwork) {
    latestRow = dropNetworkFromLatestRow(latestRow);
  }
  if (!caps.supportsCamera) {
    latestRow = dropCameraFromLatestRow(latestRow);
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
    const missingNet = caps.supportsNetwork && isMissingNetworkColumnError(err);
    const missingCamera = caps.supportsCamera && isMissingCameraColumnError(err);
    if (!missingXY && !missingEnv && !missingNet && !missingCamera) {
      throw err;
    }
    if (missingXY) {
      caps.supportsRadarXY = false;
    }
    if (missingEnv) {
      caps.supportsEnvironment = false;
    }
    if (missingNet) {
      caps.supportsNetwork = false;
    }
    if (missingCamera) {
      caps.supportsCamera = false;
    }
    latestRow = snapshotToLatestRow(snapshot);
    if (!caps.supportsRadarXY) {
      latestRow = dropXYFromLatestRow(latestRow);
    }
    if (!caps.supportsEnvironment) {
      latestRow = dropEnvironmentFromLatestRow(latestRow);
    }
    if (!caps.supportsNetwork) {
      latestRow = dropNetworkFromLatestRow(latestRow);
    }
    if (!caps.supportsCamera) {
      latestRow = dropCameraFromLatestRow(latestRow);
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

  if (snapshot._present && !snapshot._present.radar.any) {
    return {
      storage: "supabase",
      supportsEnvironment: caps.supportsEnvironment,
      supportsNetwork: caps.supportsNetwork,
      supportsCamera: caps.supportsCamera
    };
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
          alert: false
        }
      ]),
      expectText: true
    });
  } catch (err) {
    /* optional logs table */
  }

  return {
    storage: "supabase",
    supportsEnvironment: caps.supportsEnvironment,
    supportsNetwork: caps.supportsNetwork,
    supportsCamera: caps.supportsCamera
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
    if (caps.supportsNetwork) {
      selectParts.push("net_latency", "net_link");
    }
    if (caps.supportsCamera) {
      selectParts.push("camera_status", "camera_alert", "camera_image_url", "camera_updated_at");
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
    const missingNet = caps.supportsNetwork && isMissingNetworkColumnError(err);
    const missingCamera = caps.supportsCamera && isMissingCameraColumnError(err);
    if (!missingXY && !missingEnv && !missingNet && !missingCamera) {
      throw err;
    }
    if (missingXY) {
      caps.supportsRadarXY = false;
    }
    if (missingEnv) {
      caps.supportsEnvironment = false;
    }
    if (missingNet) {
      caps.supportsNetwork = false;
    }
    if (missingCamera) {
      caps.supportsCamera = false;
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
