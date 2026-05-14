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
    cloud: {
      alarmSynced: false
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
  trendChart: document.getElementById("trendChart"),
  sourceLabel: document.getElementById("sourceLabel"),
  sourceHint: document.getElementById("sourceHint"),
  eventList: document.getElementById("eventList")
};

if (refs.latencyValue && refs.latencyValue.previousElementSibling) {
  refs.latencyValue.previousElementSibling.textContent = "SLE网页延迟";
}
if (refs.latencyValue && refs.latencyValue.nextElementSibling) {
  refs.latencyValue.nextElementSibling.textContent = "SLE Link";
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

function isAlertActive() {
  return appState.manualAlert || appState.snapshot.radar.alert;
}

function getAlertSource() {
  if (appState.manualAlert) {
    return "manual";
  }
  if (appState.snapshot.radar.alert) {
    return "device";
  }
  return "none";
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
  if (alertSource === "manual") {
    refs.sceneStatus.textContent = "云端手动告警已下发 · 等待现场确认";
    refs.sceneAlert.textContent = "云端手动告警已下发";
  } else if (alertSource === "device") {
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
  refs.altitudeValue.textContent = `${formatNumber(gps.alt, 0)}m`;
  refs.radarTargetValue.textContent = `${formatNumber(radar.targetCount, 0)} 个`;
  refs.gpsValue.textContent = formatGps(gps);
  refs.latencyValue.textContent = `${formatNumber(network.latency, 0)}ms`;
  if (alertSource === "manual") {
    refs.cloudSyncValue.textContent = "手动告警";
  } else if (alertSource === "device" || cloudSynced) {
    refs.cloudSyncValue.textContent = "设备同步";
  } else {
    refs.cloudSyncValue.textContent = "待命";
  }
  refs.lastUpdate.textContent = nowClock();
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
  const cloud = payload.cloud || {};

  return {
    timestamp: typeof payload.timestamp === "number" ? payload.timestamp : Date.now(),
    environment: {
      temperature: Number(environment.temperature ?? previous.environment.temperature),
      humidity: Number(environment.humidity ?? previous.environment.humidity),
      pressure: Number(environment.pressure ?? previous.environment.pressure)
    },
    radar: (() => {
      const x = toFiniteNumber(
        radar.x ?? radar.posX ?? radar.targetX ?? radar.coordinateX ?? previous.radar.x,
        previous.radar.x
      );
      const y = toFiniteNumber(
        radar.y ?? radar.posY ?? radar.targetY ?? radar.coordinateY ?? previous.radar.y,
        previous.radar.y
      );
      const speed = toFiniteNumber(radar.speed ?? radar.v ?? previous.radar.speed, previous.radar.speed);
      const distance = toFiniteNumber(radar.distance ?? previous.radar.distance, previous.radar.distance);
      const targetCount = toFiniteNumber(
        radar.targetCount ?? radar.targets ?? (Number.isFinite(x) && Number.isFinite(y) ? 1 : previous.radar.targetCount),
        previous.radar.targetCount
      );
      return {
        targetCount,
        speed,
        distance,
        x,
        y,
        alert: Boolean(radar.alert ?? previous.radar.alert)
      };
    })(),
    gps: {
      lat: Number(gps.lat ?? previous.gps.lat),
      lon: Number(gps.lon ?? previous.gps.lon),
      alt: Number(gps.alt ?? previous.gps.alt)
    },
    network: (() => {
      const latencyRaw = toFiniteNumber(
        network.latency ?? network.sleLatency ?? previous.network.latency,
        previous.network.latency
      );
      return {
        latency: clamp(latencyRaw, 0, 999),
        link: String(network.link ?? network.sleLink ?? previous.network.link)
      };
    })(),
    cloud: {
      alarmSynced: Boolean(cloud.alarmSynced ?? previous.cloud.alarmSynced)
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
        cloud: {
          alarmSynced: appState.manualAlert
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
  pushHistory(snapshot);
  renderSnapshot();
  if (sourceName !== "mock") {
    addEvent("info", "数据已更新", `source=${sourceName}`);
  }
}

const connector = new DataConnector(handleIncomingSnapshot);

function bindActions() {
  refs.simulateAlertBtn.addEventListener("click", () => {
    appState.manualAlert = true;
    appState.snapshot.cloud.alarmSynced = true;
    renderSnapshot();
    addEvent("warn", "云端手动告警", "网站端已手动下发告警状态");
  });

  refs.clearAlertBtn.addEventListener("click", () => {
    appState.manualAlert = false;
    appState.snapshot.radar.alert = false;
    appState.snapshot.cloud.alarmSynced = false;
    renderSnapshot();
    addEvent("info", "告警解除", "系统恢复巡航");
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
