const appState = {
  manualAlert: false,
  snapshot: {
    timestamp: Date.now(),
    environment: {
      temperature: 23.0,
      humidity: 57.0,
      pressure: 1009.0
    },
    radar: {
      targetCount: 1,
      speed: 0,
      distance: 0.3,
      x: 0,
      y: 300,
      alert: false
    },
    gps: {
      lat: 36.057,
      lon: 103.833,
      alt: 1526
    },
    network: {
      latency: 21,
      link: "stable"
    },
    camera: {
      status: "normal",
      alert: false,
      imageUrl: "",
      updatedAt: Date.now()
    },
    cloud: {
      alarmSynced: false,
      cameraAlert: false,
      manualAlert: false,
      manualUpdatedAt: null,
      manualClearUntil: null,
      manualClearActive: false,
      finalAlert: false,
      correction: {
        active: false,
        status: "normal",
        code: 1,
        ttlMs: 0,
        expiresAt: null
      }
    }
  },
  history: {
    temperature: [],
    humidity: []
  }
};

const DEFAULT_DEVICE_ID = "xzx-a12";
const DEFAULT_HTTP_POLL_INTERVAL_MS = 2000;
const DEFAULT_HTTP_ENDPOINT = `/api/latest?deviceId=${encodeURIComponent(DEFAULT_DEVICE_ID)}`;
const CAMERA_NORMAL_IMAGE = "normal.png";
const CAMERA_ACCIDENT_IMAGE = "accident.png";

const refs = {
  systemStatus: document.getElementById("systemStatus"),
  simulateAlertBtn: document.getElementById("simulateAlertBtn"),
  clearAlertBtn: document.getElementById("clearAlertBtn"),
  roadScene: document.getElementById("roadScene"),
  sceneAlert: document.getElementById("sceneAlert"),
  sceneStatus: document.getElementById("sceneStatus"),
  lastUpdate: document.getElementById("lastUpdate"),
  tempValue: document.getElementById("tempValue"),
  humidityValue: document.getElementById("humidityValue"),
  pressureValue: document.getElementById("pressureValue"),
  altitudeValue: document.getElementById("altitudeValue"),
  radarTargetValue: document.getElementById("radarTargetValue"),
  radarSpeedValue: document.getElementById("radarSpeedValue"),
  radarCoordUnitValue: document.getElementById("radarCoordUnitValue"),
  gpsValue: document.getElementById("gpsValue"),
  latencyValue: document.getElementById("latencyValue"),
  cloudSyncValue: document.getElementById("cloudSyncValue"),
  cameraFrame: document.getElementById("cameraFrame"),
  cameraImage: document.getElementById("cameraImage"),
  cameraBadge: document.getElementById("cameraBadge"),
  cameraCaption: document.getElementById("cameraCaption"),
  trendChart: document.getElementById("trendChart"),
  sourceLabel: document.getElementById("sourceLabel"),
  sourceHint: document.getElementById("sourceHint"),
  eventList: document.getElementById("eventList")
};

if (refs.latencyValue && refs.latencyValue.previousElementSibling) {
  refs.latencyValue.previousElementSibling.textContent = "SLE网络延迟";
}
if (refs.latencyValue && refs.latencyValue.nextElementSibling) {
  refs.latencyValue.nextElementSibling.textContent = "SLE Link";
}

function syncCameraImageLayout() {
  if (!refs.cameraFrame || !refs.cameraImage) {
    return;
  }
  const { naturalWidth, naturalHeight } = refs.cameraImage;
  if (!naturalWidth || !naturalHeight) {
    return;
  }
  refs.cameraFrame.style.setProperty("--camera-aspect-ratio", `${naturalWidth} / ${naturalHeight}`);
  refs.cameraFrame.style.setProperty("--camera-display-width", `${Math.min(Math.max(naturalWidth, 760), 1040)}px`);
}

if (refs.cameraImage) {
  refs.cameraImage.addEventListener("load", syncCameraImageLayout);
  if (refs.cameraImage.complete) {
    syncCameraImageLayout();
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function nowClock() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

function formatNumber(value, digits = 1) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(digits);
}

function toFiniteNumber(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return n;
}

function firstDefined() {
  for (let i = 0; i < arguments.length; i += 1) {
    if (arguments[i] !== null && arguments[i] !== undefined) {
      return arguments[i];
    }
  }
  return undefined;
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on", "accident", "alert", "warning"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off", "normal", "safe", "ok", "clear"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function formatGps(gps) {
  return `${formatNumber(gps.lat, 4)}, ${formatNumber(gps.lon, 4)}`;
}

function formatRadarCoord(radar) {
  const x = toFiniteNumber(radar.x, NaN);
  const y = toFiniteNumber(radar.y, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return "--";
  }
  return `X:${Math.round(x)}mm Y:${Math.round(y)}mm`;
}

function renderRadarFields(radar) {
  if (refs.radarTargetValue) {
    refs.radarTargetValue.textContent = formatRadarCoord(radar);
  }
  if (refs.radarSpeedValue) {
    refs.radarSpeedValue.textContent = `${formatNumber(radar.speed, 0)} cm/s`;
  }
  if (refs.radarCoordUnitValue) {
    refs.radarCoordUnitValue.textContent = "Edge Module";
  }
}

function normalizeCameraStatus(status, alert) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "0x02" || value === "2" || value === "accident" || value === "crash" || value === "alert" || value === "warning") {
    return "accident";
  }
  if (value === "0x01" || value === "1" || value === "normal" || value === "safe" || value === "ok" || value === "clear") {
    return "normal";
  }
  return alert ? "accident" : "normal";
}

function isManualClearActiveCloud(cloud) {
  if (!cloud || !cloud.manualClearActive) {
    return false;
  }
  const clearUntil = Number(cloud.manualClearUntil || 0);
  return !clearUntil || clearUntil > Date.now();
}

function isAlertActive() {
  const cloud = appState.snapshot.cloud || {};
  if (isManualClearActiveCloud(cloud)) {
    return false;
  }
  if (typeof cloud.finalAlert === "boolean") {
    return cloud.finalAlert;
  }
  return Boolean(cloud.manualAlert || appState.snapshot.camera.alert);
}

function getAlertSource() {
  const cloud = appState.snapshot.cloud || {};
  if (isManualClearActiveCloud(cloud)) {
    return "manualClear";
  }
  if (cloud.manualAlert) {
    return "manual";
  }
  if (appState.snapshot.camera.alert) {
    return "camera";
  }
  return "none";
}

function getCameraViewState() {
  const alertActive = isAlertActive();
  const source = getAlertSource();
  const cameraImage = appState.snapshot.camera.imageUrl || "";
  const cleanImageName = cameraImage.split(/[?#]/)[0].split("/").pop();
  const hasUploadedCameraImage = Boolean(
    cameraImage &&
      cleanImageName !== CAMERA_NORMAL_IMAGE &&
      cleanImageName !== CAMERA_ACCIDENT_IMAGE
  );
  const fallbackImage = alertActive ? CAMERA_ACCIDENT_IMAGE : CAMERA_NORMAL_IMAGE;
  const imageUrl = hasUploadedCameraImage ? cameraImage : fallbackImage;

  let caption = "正常通行，未触发事故告警";
  if (source === "manualClear") {
    caption = "云端解除告警正在短时校正，图片优先使用最新交通画面";
  } else if (source === "manual") {
    caption = "云端手动告警已触发，图片优先使用最新交通画面";
  } else if (source === "camera") {
    caption = "摄像头端状态已同步云端，图片优先使用最新交通画面";
  }

  return {
    alert: alertActive,
    imageUrl,
    badge: alertActive ? "事故告警" : "正常",
    caption
  };
}

function addEvent(level, title, detail) {
  const normalizedLevel = ["info", "warn", "error"].includes(level) ? level : "info";
  const item = document.createElement("li");
  item.classList.add(`level-${normalizedLevel}`);
  item.innerHTML = `
    <div class="head">
      <strong>${title}</strong>
      <span>${normalizedLevel.toUpperCase()} | ${nowClock()}</span>
    </div>
    <p>${detail}</p>
  `;
  refs.eventList.prepend(item);
  const items = refs.eventList.querySelectorAll("li");
  if (items.length > 24) {
    items[items.length - 1].remove();
  }
}

function renderStatus() {
  const alertActive = isAlertActive();
  const alertSource = getAlertSource();
  refs.systemStatus.classList.toggle("alert", alertActive);
  refs.roadScene.classList.toggle("alert", alertActive);
  refs.systemStatus.textContent = alertActive ? "事故告警中" : "系统巡航中";
  if (alertSource === "manualClear") {
    refs.sceneStatus.textContent = "云端解除告警校正中 · 正在下发正常状态";
    refs.sceneAlert.textContent = "云端校正为正常";
  } else if (alertSource === "manual") {
    refs.sceneStatus.textContent = "云端手动告警已下发 · 等待现场确认";
    refs.sceneAlert.textContent = "云端手动告警已下发";
  } else if (alertSource === "camera") {
    refs.sceneStatus.textContent = "摄像头端事故告警已同步云端";
    refs.sceneAlert.textContent = "摄像头告警已同步云端";
  } else if (false) {
    refs.sceneStatus.textContent = "实物路牌告警已同步云端 · 雷达异常事件";
    refs.sceneAlert.textContent = "设备告警已同步云端";
  } else {
    refs.sceneStatus.textContent = "SLE 网络稳定 · 雷达与 GPS 数据在线";
    refs.sceneAlert.textContent = "事故告警已同步云端";
  }
}

function renderData() {
  const { environment, radar, gps, network } = appState.snapshot;
  const alertActive = isAlertActive();
  const alertSource = getAlertSource();
  const cloudSynced = alertActive || appState.snapshot.cloud.alarmSynced;

  refs.tempValue.textContent = `${formatNumber(environment.temperature, 1)}°C`;
  refs.humidityValue.textContent = `${formatNumber(environment.humidity, 1)}%`;
  refs.pressureValue.textContent = `${formatNumber(environment.pressure, 1)}hPa`;
  refs.altitudeValue.textContent = `${formatNumber(gps.alt, 1)}m`;
  renderRadarFields(radar);
  refs.gpsValue.textContent = formatGps(gps);
  refs.latencyValue.textContent = `${formatNumber(network.latency, 0)}ms`;
  if (alertSource === "manualClear") {
    refs.cloudSyncValue.textContent = "云端校正中";
  } else if (alertSource === "manual") {
    refs.cloudSyncValue.textContent = "手动告警";
  } else if (alertSource === "camera") {
    refs.cloudSyncValue.textContent = "摄像头告警";
  } else if (cloudSynced) {
    refs.cloudSyncValue.textContent = "设备同步";
  } else {
    refs.cloudSyncValue.textContent = "待命";
  }
  refs.lastUpdate.textContent = nowClock();
}

function renderCamera() {
  if (!refs.cameraFrame || !refs.cameraImage || !refs.cameraBadge || !refs.cameraCaption) {
    return;
  }
  const view = getCameraViewState();
  refs.cameraFrame.classList.toggle("alert", view.alert);
  if (refs.cameraImage.getAttribute("src") !== view.imageUrl) {
    refs.cameraImage.setAttribute("src", view.imageUrl);
  }
  syncCameraImageLayout();
  refs.cameraBadge.textContent = view.badge;
  refs.cameraCaption.textContent = view.caption;
}

function drawTrendChart() {
  const canvas = refs.trendChart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padX = 36;
  const padY = 28;

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(130, 190, 255, 0.16)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padY + ((height - padY * 2) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(width - padX, y);
    ctx.stroke();
  }

  const tempList = appState.history.temperature;
  const humidityList = appState.history.humidity;
  if (!tempList.length) {
    return;
  }

  function toX(index) {
    return tempList.length === 1 ? padX : padX + (index / (tempList.length - 1)) * (width - padX * 2);
  }

  function toY(value, min, max) {
    const ratio = (value - min) / (max - min || 1);
    return height - padY - ratio * (height - padY * 2);
  }

  function drawLine(list, color, min, max) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    list.forEach((value, index) => {
      const x = toX(index);
      const y = toY(value, min, max);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }

  drawLine(tempList, "#21d6ff", 0, 40);
  drawLine(humidityList, "#7aa7ff", 0, 100);

  ctx.font = "12px Space Grotesk, sans-serif";
  ctx.fillStyle = "#21d6ff";
  ctx.fillText("Temperature", padX, padY - 8);
  ctx.fillStyle = "#7aa7ff";
  ctx.fillText("Humidity", padX + 105, padY - 8);
}

function renderSnapshot() {
  renderStatus();
  renderData();
  renderCamera();
  renderRadarFields(appState.snapshot.radar);
  drawTrendChart();
}

function pushHistory(snapshot) {
  appState.history.temperature.push(snapshot.environment.temperature);
  appState.history.humidity.push(snapshot.environment.humidity);
  if (appState.history.temperature.length > 48) {
    appState.history.temperature.shift();
    appState.history.humidity.shift();
  }
}

function seedHistory() {
  appState.history.temperature = [];
  appState.history.humidity = [];
  for (let i = 0; i < 18; i += 1) {
    appState.history.temperature.push(clamp(appState.snapshot.environment.temperature + randomBetween(-1.4, 1.4), 14, 36));
    appState.history.humidity.push(clamp(appState.snapshot.environment.humidity + randomBetween(-5, 5), 35, 92));
  }
}

function normalizeSnapshot(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const previous = appState.snapshot;
  const environment = payload.environment || {};
  const radar = payload.radar || payload.traffic || {};
  const gps = payload.gps || payload.location || {};
  const network = payload.network || {};
  const camera = payload.camera || payload.traffic || {};
  const cloud = payload.cloud || {};
  const rawCameraAlert = firstDefined(camera.alert, camera.accident, camera.crash, camera.warning);
  const normalizedCameraAlert = toBoolean(rawCameraAlert, previous.camera.alert);
  const normalizedCameraStatus = normalizeCameraStatus(
    firstDefined(camera.status, camera.state, camera.code, camera.statusCode, previous.camera.status),
    normalizedCameraAlert
  );
  const cameraAlert = normalizedCameraStatus === "accident" || normalizedCameraAlert;
  const manualAlert = toBoolean(firstDefined(cloud.manualAlert, previous.cloud.manualAlert, appState.manualAlert), false);
  const manualClearUntil = firstDefined(cloud.manualClearUntil, previous.cloud.manualClearUntil, null);
  const manualClearUntilMs = Number(manualClearUntil || 0);
  const manualClearActive = toBoolean(firstDefined(cloud.manualClearActive, previous.cloud.manualClearActive), false) &&
    (!manualClearUntilMs || manualClearUntilMs > Date.now());
  const finalAlert = toBoolean(
    firstDefined(cloud.finalAlert, manualClearActive ? false : undefined, manualAlert || cameraAlert),
    manualClearActive ? false : (manualAlert || cameraAlert)
  );

  return {
    timestamp: typeof payload.timestamp === "number" ? payload.timestamp : Date.now(),
    environment: {
      temperature: Number(firstDefined(environment.temperature, previous.environment.temperature)),
      humidity: Number(firstDefined(environment.humidity, previous.environment.humidity)),
      pressure: Number(firstDefined(environment.pressure, previous.environment.pressure))
    },
    radar: (() => {
      const x = toFiniteNumber(
        firstDefined(radar.x, radar.posX, radar.targetX, radar.coordinateX, previous.radar.x),
        previous.radar.x
      );
      const y = toFiniteNumber(
        firstDefined(radar.y, radar.posY, radar.targetY, radar.coordinateY, previous.radar.y),
        previous.radar.y
      );
      const speed = toFiniteNumber(firstDefined(radar.speed, radar.v, previous.radar.speed), previous.radar.speed);
      const distance = toFiniteNumber(firstDefined(radar.distance, previous.radar.distance), previous.radar.distance);
      const targetCount = toFiniteNumber(
        firstDefined(radar.targetCount, radar.targets, Number.isFinite(x) && Number.isFinite(y) ? 1 : previous.radar.targetCount),
        previous.radar.targetCount
      );
      return {
        targetCount,
        speed,
        distance,
        x,
        y,
        alert: false
      };
    })(),
    gps: {
      lat: Number(firstDefined(gps.lat, previous.gps.lat)),
      lon: Number(firstDefined(gps.lon, previous.gps.lon)),
      alt: Number(firstDefined(gps.alt, previous.gps.alt))
    },
    network: (() => {
      const latencyRaw = toFiniteNumber(
        firstDefined(network.latency, network.sleLatency, previous.network.latency),
        previous.network.latency
      );
      return {
        latency: clamp(latencyRaw, 0, 999),
        link: String(firstDefined(network.link, network.sleLink, previous.network.link))
      };
    })(),
    camera: (() => {
      return {
        status: normalizedCameraStatus,
        alert: cameraAlert,
        imageUrl: String(firstDefined(camera.imageUrl, camera.photoUrl, camera.url, previous.camera.imageUrl, "")),
        updatedAt: Number(firstDefined(camera.updatedAt, camera.timestamp, previous.camera.updatedAt, Date.now()))
      };
    })(),
    cloud: {
      alarmSynced: toBoolean(firstDefined(cloud.alarmSynced, finalAlert, previous.cloud.alarmSynced), finalAlert),
      cameraAlert: toBoolean(firstDefined(cloud.cameraAlert, cameraAlert, previous.cloud.cameraAlert), cameraAlert),
      manualAlert,
      manualUpdatedAt: firstDefined(cloud.manualUpdatedAt, previous.cloud.manualUpdatedAt, null),
      manualClearUntil,
      manualClearActive,
      finalAlert,
      correction: cloud.correction || previous.cloud.correction || {
        active: false,
        status: "normal",
        code: 1,
        ttlMs: 0,
        expiresAt: null
      }
    }
  };
}

class DataConnector {
  constructor(onSnapshot) {
    this.onSnapshot = onSnapshot;
    this.ws = null;
    this.timer = null;
    this.pollAbort = null;
  }

  stopActive() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.pollAbort) {
      this.pollAbort.abort();
      this.pollAbort = null;
    }
  }

  setSource(label, hint) {
    refs.sourceLabel.textContent = label;
    refs.sourceHint.textContent = hint;
  }

  push(snapshot, sourceName = "bridge") {
    const normalized = normalizeSnapshot(snapshot);
    if (!normalized) {
      return false;
    }
    this.onSnapshot(normalized, sourceName);
    return true;
  }

  useMock(intervalMs = 2000) {
    this.stopActive();
    this.setSource("Mock Simulation", "当前使用本地模拟数据");
    this.timer = setInterval(() => {
      const prev = appState.snapshot;
      const next = {
        timestamp: Date.now(),
        environment: {
          temperature: clamp(prev.environment.temperature + randomBetween(-0.4, 0.4), 14, 36),
          humidity: clamp(prev.environment.humidity + randomBetween(-1.8, 1.8), 35, 92),
          pressure: clamp(prev.environment.pressure + randomBetween(-0.9, 0.9), 990, 1030)
        },
        radar: {
          targetCount: 1,
          speed: clamp(prev.radar.speed + randomBetween(-8, 8), -120, 120),
          distance: clamp(prev.radar.distance + randomBetween(-0.08, 0.08), 0.1, 9),
          x: clamp(prev.radar.x + randomBetween(-120, 120), -600, 600),
          y: clamp(prev.radar.y + randomBetween(-90, 90), 100, 1500),
          alert: false
        },
        gps: {
          lat: clamp(prev.gps.lat + randomBetween(-0.0005, 0.0005), 36.045, 36.079),
          lon: clamp(prev.gps.lon + randomBetween(-0.0005, 0.0005), 103.817, 103.853),
          alt: clamp(prev.gps.alt + randomBetween(-2, 2), 1503, 1568)
        },
        network: {
          latency: clamp(prev.network.latency + randomBetween(-2, 2), 10, 80),
          link: "stable"
        },
        camera: {
          status: prev.camera.status,
          alert: prev.camera.alert,
          imageUrl: prev.camera.imageUrl,
          updatedAt: prev.camera.updatedAt
        },
        cloud: {
          ...prev.cloud,
          alarmSynced: isAlertActive(),
          manualAlert: appState.manualAlert,
          finalAlert: isAlertActive()
        }
      };
      this.push(next, "mock");
    }, intervalMs);
  }

  useWebSocket(url) {
    this.stopActive();
    this.setSource("WebSocket", `正在连接：${url}`);
    try {
      this.ws = new WebSocket(url);
    } catch (error) {
      addEvent("error", "WebSocket 连接失败", error.message);
      this.useMock();
      return;
    }

    this.ws.addEventListener("open", () => {
      addEvent("info", "WebSocket 已连接", url);
      this.setSource("WebSocket", "已连接，等待硬件端数据");
    });

    this.ws.addEventListener("message", (event) => {
      try {
        this.push(JSON.parse(event.data), "websocket");
      } catch (error) {
        addEvent("warn", "WebSocket 数据格式错误", "消息不是有效 JSON");
      }
    });

    this.ws.addEventListener("close", () => {
      addEvent("warn", "WebSocket 已断开", "已自动切回模拟数据");
      this.useMock();
    });

    this.ws.addEventListener("error", () => {
      addEvent("error", "WebSocket 错误", "已自动切回模拟数据");
      this.useMock();
    });
  }

  useHttp(url, intervalMs = 3000) {
    this.stopActive();
    this.setSource("HTTP Polling", `轮询周期：${intervalMs}ms`);
    const fetchOnce = async () => {
      this.pollAbort = new AbortController();
      try {
        const response = await fetch(url, { signal: this.pollAbort.signal, cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        this.push(await response.json(), "http");
      } catch (error) {
        addEvent("warn", "HTTP 轮询异常", error.message);
      } finally {
        this.pollAbort = null;
      }
    };
    fetchOnce();
    this.timer = setInterval(fetchOnce, clamp(intervalMs, 1000, 60000));
  }
}

function handleIncomingSnapshot(snapshot, sourceName) {
  appState.snapshot = snapshot;
  appState.manualAlert = Boolean(snapshot.cloud && snapshot.cloud.manualAlert);
  pushHistory(snapshot);
  renderSnapshot();
  if (sourceName !== "mock") {
    addEvent("info", "数据已更新", `source=${sourceName}`);
  }
}

const connector = new DataConnector(handleIncomingSnapshot);

async function postCloudAlert(alert) {
  const response = await fetch("/api/alert", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      deviceId: DEFAULT_DEVICE_ID,
      alert
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

function bindActions() {
  refs.simulateAlertBtn.addEventListener("click", async () => {
    appState.manualAlert = true;
    appState.snapshot.cloud = {
      ...appState.snapshot.cloud,
      alarmSynced: true,
      manualAlert: true,
      manualClearActive: false,
      finalAlert: true,
      correction: {
        active: false,
        status: "normal",
        code: 1,
        ttlMs: 0,
        expiresAt: null
      }
    };
    renderSnapshot();
    addEvent("warn", "云端手动告警", "已切换事故状态，图片保留最新交通画面");
    try {
      const payload = await postCloudAlert(true);
      if (payload.cloud) {
        appState.snapshot.cloud = payload.cloud;
        appState.manualAlert = Boolean(payload.cloud.manualAlert);
        renderSnapshot();
      }
      addEvent("info", "手动告警已同步", "cloud.manualAlert=true");
    } catch (error) {
      addEvent("warn", "手动告警云端同步失败", error.message);
    }
  });

  refs.clearAlertBtn.addEventListener("click", async () => {
    const now = Date.now();
    appState.manualAlert = false;
    appState.snapshot.cloud = {
      ...appState.snapshot.cloud,
      alarmSynced: false,
      manualAlert: false,
      manualClearActive: true,
      manualClearUntil: now + 10000,
      finalAlert: false,
      correction: {
        active: true,
        status: "normal",
        code: 1,
        ttlMs: 10000,
        expiresAt: now + 10000
      }
    };
    renderSnapshot();
    addEvent("info", "告警解除", "已切换正常状态，图片保留最新交通画面");
    try {
      const payload = await postCloudAlert(false);
      if (payload.cloud) {
        appState.snapshot.cloud = payload.cloud;
        appState.manualAlert = Boolean(payload.cloud.manualAlert);
        renderSnapshot();
      }
      addEvent("info", "解除告警已同步", "cloud.manualAlert=false，短时校正下发");
    } catch (error) {
      addEvent("warn", "解除告警云端同步失败", error.message);
    }
  });
}

function exposeBridge() {
  window.XZXDataBridge = {
    pushSnapshot(payload) {
      const ok = connector.push(payload, "bridge");
      if (!ok) {
        addEvent("warn", "Bridge 数据拒绝", "格式不合法");
      }
      return ok;
    },
    useWebSocket(url) {
      connector.useWebSocket(url);
    },
    useHttp(url, intervalMs = 3000) {
      connector.useHttp(url, intervalMs);
    },
    useMock(intervalMs = 2000) {
      connector.useMock(intervalMs);
    }
  };
}

function bootstrap() {
  bindActions();
  exposeBridge();
  seedHistory();
  renderSnapshot();
  addEvent("info", "系统启动", `默认使用云端轮询: ${DEFAULT_HTTP_ENDPOINT}`);
  connector.useHttp(DEFAULT_HTTP_ENDPOINT, DEFAULT_HTTP_POLL_INTERVAL_MS);
}

bootstrap();
