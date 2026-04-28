const presets = {
  normal: {
    name: "Normal Patrol",
    temp: [19, 28],
    humidity: [42, 66],
    speed: [34, 68],
    pressure: [1003, 1015],
    solar: [72, 96],
    wireless: [8, 20],
    usb: [0, 2],
    latency: [18, 25],
    risk: 0.05
  },
  peak: {
    name: "Peak Traffic",
    temp: [24, 33],
    humidity: [35, 58],
    speed: [48, 96],
    pressure: [1000, 1012],
    solar: [52, 82],
    wireless: [12, 28],
    usb: [0, 6],
    latency: [24, 34],
    risk: 0.14
  },
  rain: {
    name: "Rain Mode",
    temp: [13, 24],
    humidity: [72, 97],
    speed: [22, 62],
    pressure: [994, 1008],
    solar: [30, 62],
    wireless: [24, 48],
    usb: [0, 8],
    latency: [28, 40],
    risk: 0.18
  },
  maintenance: {
    name: "Maintenance",
    temp: [20, 30],
    humidity: [38, 68],
    speed: [6, 34],
    pressure: [1002, 1016],
    solar: [60, 90],
    wireless: [45, 80],
    usb: [12, 36],
    latency: [22, 30],
    risk: 0.03
  }
};

const state = {
  scene: "normal",
  alertMode: false,
  voiceEnabled: true,
  speedThreshold: 60,
  signName: "\u661f\u667a\u884c\u8def\u724c A-12",
  customNotice: "\u63d0\u793a\uff1a\u524d\u65b9\u8def\u53e3\u8bf7\u51cf\u901f\u6162\u884c\u3002",
  eventFilter: "all",
  selectedNode: "master",
  lineVisible: {
    temp: true,
    humidity: true,
    speed: true
  },
  collisionTarget: null,
  lastOverspeedAt: 0,
  metrics: {
    temp: 22.4,
    humidity: 58,
    pressure: 1008,
    speed: 46,
    solar: 84,
    wirelessInput: 14,
    usbInput: 1,
    battery: 85,
    detection: 92,
    latency: 21,
    lat: 36.0593,
    lon: 103.8342,
    altitude: 1526
  },
  history: {
    temp: [],
    humidity: [],
    speed: []
  },
  events: [],
  nodes: [
    { id: "master", name: "Master WS63", role: "SLE Master + Wi-Fi gateway", status: "ok", load: 44 },
    { id: "radar", name: "Radar Node", role: "HLK-LD2450 track upload", status: "ok", load: 37 },
    { id: "env", name: "Env Node", role: "AHT20 / BMP280 sampling", status: "ok", load: 32 },
    { id: "gps", name: "GPS Node", role: "ATGM336 location sync", status: "ok", load: 35 },
    { id: "voice", name: "Voice Node", role: "ASR PRO2.0 playback", status: "ok", load: 39 },
    { id: "vision", name: "Vision Node", role: "maxiCAM + edge detection", status: "ok", load: 48 }
  ],
  targets: []
};

const refs = {
  body: document.body,
  systemBadge: document.getElementById("systemBadge"),
  healthValue: document.getElementById("healthValue"),
  healthRing: document.getElementById("healthRing"),
  healthHint: document.getElementById("healthHint"),
  linkState: document.getElementById("linkState"),
  voiceState: document.getElementById("voiceState"),
  accidentState: document.getElementById("accidentState"),
  latencyValue: document.getElementById("latencyValue"),
  tempValue: document.getElementById("tempValue"),
  humidityValue: document.getElementById("humidityValue"),
  pressureValue: document.getElementById("pressureValue"),
  speedValue: document.getElementById("speedValue"),
  solarValue: document.getElementById("solarValue"),
  detectionValue: document.getElementById("detectionValue"),
  gpsValue: document.getElementById("gpsValue"),
  radarCanvas: document.getElementById("radarCanvas"),
  targetList: document.getElementById("targetList"),
  inkScreen: document.getElementById("inkScreen"),
  inkSignName: document.getElementById("inkSignName"),
  inkDate: document.getElementById("inkDate"),
  inkLocation: document.getElementById("inkLocation"),
  inkAltitude: document.getElementById("inkAltitude"),
  inkWeather: document.getElementById("inkWeather"),
  inkAlert: document.getElementById("inkAlert"),
  inkVoice: document.getElementById("inkVoice"),
  inkNotice: document.getElementById("inkNotice"),
  solarBar: document.getElementById("solarBar"),
  wirelessBar: document.getElementById("wirelessBar"),
  usbBar: document.getElementById("usbBar"),
  solarText: document.getElementById("solarText"),
  wirelessText: document.getElementById("wirelessText"),
  usbText: document.getElementById("usbText"),
  batteryPercent: document.getElementById("batteryPercent"),
  trendCanvas: document.getElementById("trendCanvas"),
  eventTimeline: document.getElementById("eventTimeline"),
  nodeGrid: document.getElementById("nodeGrid"),
  nodeSvg: document.getElementById("nodeSvg"),
  nodeDetail: document.getElementById("nodeDetail"),
  controlForm: document.getElementById("controlForm"),
  signNameInput: document.getElementById("signNameInput"),
  noticeInput: document.getElementById("noticeInput"),
  thresholdInput: document.getElementById("thresholdInput"),
  thresholdText: document.getElementById("thresholdText"),
  voiceToggle: document.getElementById("voiceToggle"),
  assistantOutput: document.getElementById("assistantOutput"),
  voiceInput: document.getElementById("voiceInput"),
  toast: document.getElementById("toast")
};

const runtime = {
  toastTimer: null,
  tickTimer: null,
  clockTimer: null,
  sweepAngle: 0
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function nowText() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

function formatCoord(value) {
  return value.toFixed(4);
}

function drift(value, min, max, strength = 0.16) {
  const center = (min + max) / 2;
  const delta = (center - value) * strength;
  const noise = rand(-1, 1) * ((max - min) / 14);
  return clamp(value + delta + noise, min - 12, max + 12);
}

function statusLabel(status) {
  if (status === "ok") {
    return "\u5728\u7ebf";
  }
  if (status === "warn") {
    return "\u6ce2\u52a8";
  }
  return "\u544a\u8b66";
}

function nextStatus(status) {
  if (status === "ok") {
    return "warn";
  }
  if (status === "warn") {
    return "alert";
  }
  return "ok";
}

function showToast(text) {
  refs.toast.textContent = text;
  refs.toast.classList.add("show");
  clearTimeout(runtime.toastTimer);
  runtime.toastTimer = setTimeout(() => {
    refs.toast.classList.remove("show");
  }, 2200);
}

function addEvent(type, title, detail) {
  state.events.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    title,
    detail,
    time: nowText()
  });
  if (state.events.length > 70) {
    state.events.pop();
  }
  renderEvents();
}

function renderEvents() {
  refs.eventTimeline.innerHTML = "";
  const visible = state.events.filter((item) => state.eventFilter === "all" || item.type === state.eventFilter);
  if (!visible.length) {
    const li = document.createElement("li");
    li.className = "info";
    li.innerHTML = "<strong>No events in this filter</strong><p>Try another filter.</p>";
    refs.eventTimeline.appendChild(li);
    return;
  }

  visible.slice(0, 22).forEach((item) => {
    const li = document.createElement("li");
    li.className = item.type;
    li.innerHTML = `
      <span class="tag">${item.type.toUpperCase()}</span>
      <strong>${item.title}</strong>
      <p>${item.detail}</p>
      <p>${item.time}</p>
    `;
    refs.eventTimeline.appendChild(li);
  });
}

function setEventFilter(filter) {
  state.eventFilter = filter;
  document.querySelectorAll("#eventFilters .filter-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === filter);
  });
  renderEvents();
}

function appendDialogue(role, text) {
  const node = document.createElement("div");
  node.className = `dialog ${role}`;
  node.textContent = text;
  refs.assistantOutput.appendChild(node);
  const entries = refs.assistantOutput.querySelectorAll(".dialog");
  if (entries.length > 14) {
    entries[0].remove();
  }
  refs.assistantOutput.scrollTop = refs.assistantOutput.scrollHeight;
}

function speak(text) {
  if (!state.voiceEnabled || !window.speechSynthesis) {
    return;
  }
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    // noop
  }
}

function answerQuery(query, withUserBubble = true) {
  const raw = query.trim();
  if (!raw) {
    showToast("Please input a question");
    return;
  }
  if (withUserBubble) {
    appendDialogue("user", raw);
  }

  const normalized = raw.toLowerCase();
  let response = "Try weather, traffic, energy, location, or node status.";

  if (/weather|temp|humidity|pressure|temperature/.test(normalized)) {
    response = `Temp ${state.metrics.temp.toFixed(1)}C, humidity ${state.metrics.humidity.toFixed(0)}%, pressure ${state.metrics.pressure.toFixed(0)} hPa.`;
  } else if (/traffic|accident|speed|status|road/.test(normalized)) {
    response = state.alertMode
      ? `Alert mode active. Target speed ${state.metrics.speed.toFixed(0)} km/h.`
      : `Road condition stable. Target speed ${state.metrics.speed.toFixed(0)} km/h.`;
  } else if (/power|energy|solar|wireless|usb|battery/.test(normalized)) {
    response = `Solar ${state.metrics.solar.toFixed(0)}%, wireless ${state.metrics.wirelessInput.toFixed(0)}%, USB ${state.metrics.usbInput.toFixed(0)}%, battery ${state.metrics.battery.toFixed(0)}%.`;
  } else if (/node|device|topology/.test(normalized)) {
    const abnormal = state.nodes.filter((node) => node.status !== "ok");
    response = abnormal.length
      ? `${abnormal.length} nodes abnormal: ${abnormal.map((node) => node.name).join(", ")}.`
      : "All nodes are online.";
  } else if (/location|coordinate|gps/.test(normalized)) {
    response = `Location ${formatCoord(state.metrics.lat)}, ${formatCoord(state.metrics.lon)}, altitude ${state.metrics.altitude.toFixed(0)}m.`;
  }

  appendDialogue("bot", response);
  speak(response);
  addEvent("info", "Voice QA", `Question processed: ${raw}`);
}

function animateInk() {
  refs.inkScreen.classList.remove("refresh");
  void refs.inkScreen.offsetWidth;
  refs.inkScreen.classList.add("refresh");
}

function setScene(sceneId, fromUser = true) {
  if (!presets[sceneId]) {
    return;
  }
  state.scene = sceneId;
  refs.body.dataset.scene = sceneId;
  document.querySelectorAll("#sceneSwitch .scene-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.scene === sceneId);
  });
  if (!state.alertMode) {
    applySceneNodeBias();
  }
  if (fromUser) {
    addEvent("info", "Scene Changed", `Switched to ${presets[sceneId].name}.`);
    showToast(`Scene: ${presets[sceneId].name}`);
  }
  updateStatusViews();
}

function updateThresholdText() {
  refs.thresholdText.textContent = `${state.speedThreshold} km/h`;
}

function applySceneNodeBias() {
  state.nodes.forEach((node) => {
    node.status = "ok";
    node.load = clamp(node.load + rand(-4, 4), 26, 70);
  });

  if (state.scene === "peak") {
    const radar = state.nodes.find((node) => node.id === "radar");
    const vision = state.nodes.find((node) => node.id === "vision");
    if (radar) {
      radar.status = "warn";
      radar.load = 72;
    }
    if (vision) {
      vision.status = "warn";
      vision.load = 75;
    }
  }

  if (state.scene === "rain") {
    const env = state.nodes.find((node) => node.id === "env");
    const gps = state.nodes.find((node) => node.id === "gps");
    if (env) {
      env.status = "warn";
      env.load = 69;
    }
    if (gps) {
      gps.status = "warn";
      gps.load = 65;
    }
  }

  if (state.scene === "maintenance") {
    const master = state.nodes.find((node) => node.id === "master");
    const voice = state.nodes.find((node) => node.id === "voice");
    if (master) {
      master.status = "warn";
      master.load = 64;
    }
    if (voice) {
      voice.status = "warn";
      voice.load = 59;
    }
  }

  syncNodeGraphics();
  renderNodes();
}

function setAlertNodeProfile(enabled) {
  if (!enabled) {
    applySceneNodeBias();
    return;
  }

  state.nodes.forEach((node) => {
    if (node.id === "radar" || node.id === "vision") {
      node.status = "alert";
      node.load = 92;
      return;
    }
    if (node.id === "master" || node.id === "voice") {
      node.status = "warn";
      node.load = 82;
      return;
    }
    node.status = "ok";
    node.load = clamp(node.load + rand(6, 14), 44, 86);
  });

  syncNodeGraphics();
  renderNodes();
}

function triggerAlert(source) {
  if (state.alertMode) {
    showToast("Already in alert mode");
    return;
  }
  state.alertMode = true;
  setAlertNodeProfile(true);
  const risky = [...state.targets].sort((a, b) => b.speed - a.speed)[0];
  state.collisionTarget = risky ? risky.id : null;

  animateInk();
  updateStatusViews();
  addEvent("alert", "Accident Alert", `Triggered by ${source}. Alert workflow started.`);
  appendDialogue("bot", "Alert mode enabled. Safety voice broadcast dispatched.");
  speak("Accident warning triggered. Please slow down.");
  showToast("Alert mode enabled");
}

function resetAlert() {
  if (!state.alertMode) {
    showToast("Already in patrol mode");
    return;
  }
  state.alertMode = false;
  state.collisionTarget = null;
  applySceneNodeBias();
  animateInk();
  updateStatusViews();
  addEvent("info", "Alert Cleared", "System returned to patrol mode.");
  appendDialogue("bot", "Alert cleared. System back to normal patrol.");
  showToast("Patrol mode restored");
}

function runSmartPatrol() {
  addEvent("info", "Smart Patrol", "Running node and link diagnostics.");
  showToast("Smart patrol running...");
  appendDialogue("bot", "Smart patrol started. ETA 2 seconds.");

  setTimeout(() => {
    const unstableNodes = state.nodes.filter((node) => node.status !== "ok");
    if (unstableNodes.length) {
      addEvent("warn", "Patrol Result", `Found ${unstableNodes.length} unstable nodes.`);
      appendDialogue("bot", `Patrol complete. ${unstableNodes.length} unstable nodes found.`);
    } else {
      addEvent("info", "Patrol Result", "All nodes stable.");
      appendDialogue("bot", "Patrol complete. All nodes are stable.");
    }
  }, 2000);
}

function updateSystemBadge() {
  refs.systemBadge.className = "system-badge";

  if (state.alertMode) {
    refs.systemBadge.textContent = "\u4e8b\u6545\u6a21\u5f0f\u8fd0\u884c\u4e2d";
    refs.systemBadge.classList.add("alert");
    return;
  }

  if (state.scene === "peak" || state.scene === "rain") {
    refs.systemBadge.textContent = `${presets[state.scene].name} | \u9884\u8b66\u5de1\u822a`;
    refs.systemBadge.classList.add("warn");
    return;
  }

  refs.systemBadge.textContent = "\u7cfb\u7edf\u5de1\u822a\u4e2d";
}

function updateQuickStatus() {
  if (state.alertMode) {
    refs.linkState.textContent = "\u91cd\u4f20\u4e2d";
    refs.accidentState.textContent = "\u5df2\u89e6\u53d1\u544a\u8b66";
  } else if (state.scene === "rain") {
    refs.linkState.textContent = "\u96e8\u8870\u8865\u507f";
    refs.accidentState.textContent = "\u98ce\u9669\u5347\u9ad8";
  } else {
    refs.linkState.textContent = state.scene === "maintenance" ? "\u7ef4\u62a4\u94fe\u8def" : "\u7a33\u5b9a";
    refs.accidentState.textContent = "\u6b63\u5e38";
  }
  refs.voiceState.textContent = state.voiceEnabled ? "\u5728\u7ebf" : "\u9759\u97f3";
  refs.latencyValue.textContent = `${state.metrics.latency.toFixed(0)} ms`;
}

function updateMetricsView() {
  refs.tempValue.textContent = state.metrics.temp.toFixed(1);
  refs.humidityValue.textContent = state.metrics.humidity.toFixed(0);
  refs.pressureValue.textContent = state.metrics.pressure.toFixed(0);
  refs.speedValue.textContent = state.metrics.speed.toFixed(0);
  refs.solarValue.textContent = state.metrics.solar.toFixed(0);
  refs.detectionValue.textContent = state.metrics.detection.toFixed(0);
  refs.gpsValue.textContent = `${formatCoord(state.metrics.lat)}, ${formatCoord(state.metrics.lon)}`;

  refs.inkSignName.textContent = state.signName;
  refs.inkLocation.textContent = `${formatCoord(state.metrics.lat)}, ${formatCoord(state.metrics.lon)}`;
  refs.inkAltitude.textContent = `${state.metrics.altitude.toFixed(0)} m`;
  refs.inkWeather.textContent = `${state.metrics.temp.toFixed(1)}C / ${state.metrics.humidity.toFixed(0)}%`;
  refs.inkNotice.textContent = state.customNotice;
  refs.inkAlert.textContent = state.alertMode ? "\u7591\u4f3c\u8f66\u7978\uff0c\u5df2\u544a\u8b66" : "\u901a\u884c\u6b63\u5e38";
  refs.inkAlert.style.color = state.alertMode ? "#9e2a24" : "#215236";
  refs.inkVoice.textContent = state.voiceEnabled ? "\u8bed\u97f3\u5728\u7ebf" : "\u8bed\u97f3\u9759\u97f3";
}

function updatePowerView() {
  refs.solarBar.style.width = `${state.metrics.solar.toFixed(0)}%`;
  refs.wirelessBar.style.width = `${state.metrics.wirelessInput.toFixed(0)}%`;
  refs.usbBar.style.width = `${state.metrics.usbInput.toFixed(0)}%`;
  refs.solarText.textContent = `${state.metrics.solar.toFixed(0)}%`;
  refs.wirelessText.textContent = `${state.metrics.wirelessInput.toFixed(0)}%`;
  refs.usbText.textContent = `${state.metrics.usbInput.toFixed(0)}%`;
  refs.batteryPercent.textContent = `${state.metrics.battery.toFixed(0)}%`;
}

function setHealthRing(score) {
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  refs.healthRing.style.strokeDasharray = circumference.toFixed(2);
  refs.healthRing.style.strokeDashoffset = offset.toFixed(2);
}

function updateHealthView() {
  let penalty = 0;
  state.nodes.forEach((node) => {
    if (node.status === "warn") {
      penalty += 7;
    }
    if (node.status === "alert") {
      penalty += 18;
    }
    penalty += Math.max(0, node.load - 76) * 0.18;
  });

  if (state.alertMode) {
    penalty += 22;
  }
  if (state.metrics.solar < 36) {
    penalty += 10;
  }
  if (state.metrics.speed > state.speedThreshold) {
    penalty += 6;
  }

  const score = clamp(100 - penalty, 18, 99);
  refs.healthValue.textContent = score.toFixed(0);
  setHealthRing(score);

  if (state.alertMode) {
    refs.healthHint.textContent = "\u544a\u8b66\u7b56\u7565\u8fd0\u884c\u4e2d\uff0c\u5efa\u8bae\u7acb\u5373\u6267\u884c\u4eba\u5de5\u590d\u6838\u3002";
  } else if (score < 70) {
    refs.healthHint.textContent = "\u68c0\u6d4b\u5230\u94fe\u8def\u6216\u8d1f\u8f7d\u6ce2\u52a8\uff0c\u5efa\u8bae\u5f00\u542f\u7ef4\u62a4\u8865\u80fd\u6a21\u5f0f\u3002";
  } else {
    refs.healthHint.textContent = "\u8282\u70b9\u8fd0\u884c\u5e73\u7a33\uff0c\u94fe\u8def\u4e0e\u7b56\u7565\u5f15\u64ce\u72b6\u6001\u6b63\u5e38\u3002";
  }
}

function updateClock() {
  refs.inkDate.textContent = new Date().toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function drawTrend() {
  const canvas = refs.trendCanvas;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padX = 38;
  const padY = 24;

  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(126, 176, 214, 0.2)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i += 1) {
    const y = padY + ((height - padY * 2) / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(width - padX, y);
    ctx.stroke();
  }

  const lines = {
    temp: { list: state.history.temp, min: 0, max: 40, color: "#5be9d7", label: "temp" },
    humidity: { list: state.history.humidity, min: 0, max: 100, color: "#78b7ff", label: "humidity" },
    speed: { list: state.history.speed, min: 0, max: 120, color: "#ffb06f", label: "speed" }
  };

  const count = state.history.temp.length;
  if (!count) {
    return;
  }

  const toX = (index) => {
    if (count === 1) {
      return padX;
    }
    return padX + (index / (count - 1)) * (width - padX * 2);
  };

  const toY = (value, min, max) => {
    const ratio = (value - min) / (max - min || 1);
    return height - padY - ratio * (height - padY * 2);
  };

  Object.keys(lines).forEach((key) => {
    if (!state.lineVisible[key]) {
      return;
    }

    const item = lines[key];
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    item.list.forEach((value, index) => {
      const x = toX(index);
      const y = toY(value, item.min, item.max);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    const last = item.list[item.list.length - 1];
    const lx = toX(item.list.length - 1);
    const ly = toY(last, item.min, item.max);
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.font = "12px Sora, Noto Sans SC, sans-serif";
  let textX = padX;
  Object.keys(lines).forEach((key) => {
    if (!state.lineVisible[key]) {
      return;
    }
    const item = lines[key];
    ctx.fillStyle = item.color;
    ctx.fillText(item.label, textX, padY - 7);
    textX += 70;
  });
}

function initTargets() {
  state.targets = Array.from({ length: 8 }).map((_, index) => ({
    id: `T${index + 1}`,
    x: rand(-0.78, 0.78),
    y: rand(-0.66, 0.66),
    vx: rand(-0.012, 0.012),
    vy: rand(-0.011, 0.011),
    speed: rand(25, 84)
  }));
}

function updateTargets() {
  state.targets.forEach((target) => {
    target.x += target.vx;
    target.y += target.vy;
    if (Math.abs(target.x) > 0.92) {
      target.vx *= -1;
      target.x = clamp(target.x, -0.92, 0.92);
    }
    if (Math.abs(target.y) > 0.86) {
      target.vy *= -1;
      target.y = clamp(target.y, -0.86, 0.86);
    }

    target.vx = clamp(target.vx + rand(-0.0012, 0.0012), -0.02, 0.02);
    target.vy = clamp(target.vy + rand(-0.0012, 0.0012), -0.018, 0.018);

    const approxSpeed = Math.hypot(target.vx, target.vy) * 4200;
    target.speed = clamp(approxSpeed + rand(-4, 4), 4, 122);
  });
}

function drawRadar() {
  const canvas = refs.radarCanvas;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.39;

  ctx.clearRect(0, 0, width, height);
  const bg = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius * 1.05);
  bg.addColorStop(0, "rgba(25, 56, 73, 0.3)");
  bg.addColorStop(1, "rgba(8, 17, 29, 0.94)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(113, 170, 212, 0.28)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i += 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, (radius / 4) * i, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx + radius, cy);
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx, cy + radius);
  ctx.stroke();

  runtime.sweepAngle += 0.05;
  const sweepX = cx + Math.cos(runtime.sweepAngle) * radius;
  const sweepY = cy + Math.sin(runtime.sweepAngle) * radius;
  const sweepGradient = ctx.createLinearGradient(cx, cy, sweepX, sweepY);
  sweepGradient.addColorStop(0, "rgba(102, 210, 199, 0.07)");
  sweepGradient.addColorStop(1, "rgba(102, 210, 199, 0.9)");
  ctx.strokeStyle = sweepGradient;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(sweepX, sweepY);
  ctx.stroke();

  state.targets.forEach((target) => {
    const x = cx + target.x * radius;
    const y = cy + target.y * (radius * 0.82);
    const isHot = target.speed > state.speedThreshold;

    ctx.fillStyle = state.alertMode && state.collisionTarget === target.id
      ? "#ff7468"
      : isHot
        ? "#f4b56d"
        : "#5ee7d6";
    ctx.beginPath();
    ctx.arc(x, y, isHot ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();

    if (state.alertMode && state.collisionTarget === target.id) {
      const pulse = 8 + Math.sin(Date.now() / 130) * 2.5;
      ctx.strokeStyle = "rgba(255, 116, 104, 0.58)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(214, 238, 255, 0.84)";
    ctx.font = "11px Sora, Noto Sans SC, sans-serif";
    ctx.fillText(target.id, x + 6, y - 5);
  });

  ctx.fillStyle = "rgba(186, 214, 236, 0.86)";
  ctx.font = "12px Sora, Noto Sans SC, sans-serif";
  ctx.fillText(`Scene: ${presets[state.scene].name}`, 18, 24);
  ctx.fillText(`Threshold: ${state.speedThreshold} km/h`, 18, 42);
}

function renderTargetsList() {
  refs.targetList.innerHTML = "";
  const topTargets = [...state.targets].sort((a, b) => b.speed - a.speed).slice(0, 4);
  topTargets.forEach((target) => {
    const li = document.createElement("li");
    const distance = Math.hypot(target.x, target.y);
    const zone = distance < 0.35 ? "\u8fd1\u573a" : distance < 0.7 ? "\u4e2d\u573a" : "\u8fdc\u573a";
    li.textContent = `${target.id} | ${target.speed.toFixed(0)}km/h | ${zone}`;
    refs.targetList.appendChild(li);
  });
}

function updateNodeDetail() {
  const node = state.nodes.find((item) => item.id === state.selectedNode);
  if (!node) {
    refs.nodeDetail.textContent = "\u70b9\u51fb\u4efb\u610f\u8282\u70b9\u67e5\u770b\u72b6\u6001\u8be6\u60c5\u3002";
    return;
  }
  refs.nodeDetail.textContent = `${node.name} | ${node.role} | \u72b6\u6001: ${statusLabel(node.status)} | \u8d1f\u8f7d: ${node.load.toFixed(0)}%`;
}

function syncNodeGraphics() {
  refs.nodeSvg.querySelectorAll(".node-point").forEach((point) => {
    point.classList.remove("ok", "warn", "alert", "active");
    const id = point.getAttribute("data-node");
    const node = state.nodes.find((item) => item.id === id);
    if (!node) {
      return;
    }
    point.classList.add(node.status);
    if (state.selectedNode === node.id) {
      point.classList.add("active");
    }
  });
}

function renderNodes() {
  refs.nodeGrid.innerHTML = "";
  state.nodes.forEach((node) => {
    const card = document.createElement("article");
    card.className = "node-card";
    if (node.id === state.selectedNode) {
      card.classList.add("active");
    }

    card.innerHTML = `
      <strong>${node.name}</strong>
      <p>${node.role}</p>
      <span class="node-state ${node.status}">${statusLabel(node.status)} | \u8d1f\u8f7d ${node.load.toFixed(0)}%</span>
    `;

    card.addEventListener("click", () => {
      const target = state.nodes.find((item) => item.id === node.id);
      if (!target) {
        return;
      }
      target.status = nextStatus(target.status);
      target.load = clamp(target.load + rand(-10, 10), 20, 95);
      state.selectedNode = target.id;
      syncNodeGraphics();
      renderNodes();
      updateNodeDetail();
      updateHealthView();
      const level = target.status === "alert" ? "alert" : target.status === "warn" ? "warn" : "info";
      addEvent(level, "Node Status Changed", `${target.name} -> ${statusLabel(target.status)}`);
    });

    refs.nodeGrid.appendChild(card);
  });
}

function updateStatusViews() {
  updateSystemBadge();
  updateQuickStatus();
  updateMetricsView();
  updatePowerView();
  updateHealthView();
  updateNodeDetail();
}

function pushHistory() {
  state.history.temp.push(state.metrics.temp);
  state.history.humidity.push(state.metrics.humidity);
  state.history.speed.push(state.metrics.speed);
  if (state.history.temp.length > 60) {
    state.history.temp.shift();
    state.history.humidity.shift();
    state.history.speed.shift();
  }
}

function simulateMetrics() {
  const preset = presets[state.scene];

  if (state.alertMode) {
    state.metrics.speed = clamp(drift(state.metrics.speed, state.speedThreshold + 18, 122, 0.24), state.speedThreshold + 10, 124);
    state.metrics.detection = clamp(drift(state.metrics.detection, 94, 99, 0.3), 90, 99.8);
    state.metrics.latency = clamp(drift(state.metrics.latency, 33, 48, 0.25), 26, 56);
  } else {
    state.metrics.speed = clamp(drift(state.metrics.speed, preset.speed[0], preset.speed[1], 0.18), 0, 124);
    state.metrics.detection = clamp(drift(state.metrics.detection, 74, 98, 0.18), 62, 99);
    state.metrics.latency = clamp(drift(state.metrics.latency, preset.latency[0], preset.latency[1], 0.22), 14, 55);
  }

  state.metrics.temp = clamp(drift(state.metrics.temp, preset.temp[0], preset.temp[1], 0.14), -8, 46);
  state.metrics.humidity = clamp(drift(state.metrics.humidity, preset.humidity[0], preset.humidity[1], 0.16), 0, 100);
  state.metrics.pressure = clamp(drift(state.metrics.pressure, preset.pressure[0], preset.pressure[1], 0.18), 980, 1040);
  state.metrics.solar = clamp(drift(state.metrics.solar, preset.solar[0], preset.solar[1], 0.2), 8, 100);
  state.metrics.wirelessInput = clamp(drift(state.metrics.wirelessInput, preset.wireless[0], preset.wireless[1], 0.2), 0, 100);
  state.metrics.usbInput = clamp(drift(state.metrics.usbInput, preset.usb[0], preset.usb[1], 0.2), 0, 100);

  if (state.metrics.solar < 38) {
    state.metrics.wirelessInput = clamp(state.metrics.wirelessInput + rand(2, 8), 0, 100);
  }

  state.metrics.battery = clamp(
    state.metrics.solar * 0.67 + state.metrics.wirelessInput * 0.23 + state.metrics.usbInput * 0.1 - (state.alertMode ? 6 : 0),
    10,
    100
  );
  state.metrics.lat = clamp(state.metrics.lat + rand(-0.00055, 0.00055), 36.045, 36.0788);
  state.metrics.lon = clamp(state.metrics.lon + rand(-0.00055, 0.00055), 103.817, 103.8538);
  state.metrics.altitude = clamp(state.metrics.altitude + rand(-3, 3), 1502, 1568);
}

function maybeGenerateEvents() {
  const preset = presets[state.scene];
  const now = Date.now();

  if (!state.alertMode && state.metrics.speed > state.speedThreshold && now - state.lastOverspeedAt > 10500) {
    state.lastOverspeedAt = now;
    addEvent("warn", "Overspeed", `Target speed ${state.metrics.speed.toFixed(0)} km/h > threshold ${state.speedThreshold} km/h.`);
    appendDialogue("bot", "Overspeed target detected. Recommend active voice warning.");
    speak("Please slow down and keep safe distance.");
  }

  if (!state.alertMode && Math.random() < preset.risk * 0.26) {
    addEvent("info", "Vision Event", "Short stall target detected and tracked.");
  }

  if (!state.alertMode && Math.random() < preset.risk * 0.14) {
    addEvent("warn", "Link Fluctuation", "EMI increased. Retransmission strategy enabled.");
  }

  if (!state.alertMode && Math.random() < preset.risk * 0.09 && state.metrics.detection > 95 && state.metrics.speed > state.speedThreshold + 12) {
    triggerAlert("AI Vision");
  }
}

function tick() {
  simulateMetrics();
  updateTargets();
  maybeGenerateEvents();
  pushHistory();
  updateStatusViews();
  drawRadar();
  drawTrend();
  renderTargetsList();
  syncNodeGraphics();
}

function bindSceneSwitch() {
  document.querySelectorAll("#sceneSwitch .scene-btn").forEach((button) => {
    button.addEventListener("click", () => {
      setScene(button.dataset.scene);
    });
  });
}

function bindLineToggle() {
  document.querySelectorAll("#lineToggle .line-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const line = button.dataset.line;
      const currentlyVisible = state.lineVisible[line];
      const visibleCount = Object.values(state.lineVisible).filter(Boolean).length;
      if (currentlyVisible && visibleCount === 1) {
        showToast("Keep at least one line visible");
        return;
      }
      state.lineVisible[line] = !currentlyVisible;
      button.classList.toggle("active", state.lineVisible[line]);
      drawTrend();
    });
  });
}

function bindEventFilter() {
  document.querySelectorAll("#eventFilters .filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      setEventFilter(button.dataset.filter);
    });
  });
}

function bindNodeSvg() {
  refs.nodeSvg.querySelectorAll(".node-point").forEach((point) => {
    point.addEventListener("click", () => {
      state.selectedNode = point.dataset.node;
      syncNodeGraphics();
      renderNodes();
      updateNodeDetail();
    });
  });
}

function bindControls() {
  document.getElementById("simulateAlertBtn").addEventListener("click", () => {
    triggerAlert("manual");
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    resetAlert();
  });

  document.getElementById("smartPatrolBtn").addEventListener("click", () => {
    runSmartPatrol();
  });

  refs.thresholdInput.addEventListener("input", (event) => {
    state.speedThreshold = Number(event.target.value);
    updateThresholdText();
  });

  refs.controlForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.signName = refs.signNameInput.value.trim() || "\u661f\u667a\u884c\u8def\u724c A-12";
    state.customNotice = refs.noticeInput.value.trim() || "\u63d0\u793a\uff1a\u524d\u65b9\u8def\u53e3\u8bf7\u51cf\u901f\u6162\u884c\u3002";
    updateStatusViews();
    animateInk();
    addEvent("info", "Config Applied", "Sign name, notice, and threshold updated.");
    showToast("Config applied");
  });

  document.getElementById("broadcastBtn").addEventListener("click", () => {
    const text = refs.noticeInput.value.trim() || "Please drive safely and keep distance.";
    appendDialogue("bot", `Voice broadcast: ${text}`);
    speak(text);
    addEvent("info", "Broadcast", `Voice broadcast sent: ${text}`);
    showToast("Broadcast sent");
  });

  refs.voiceToggle.addEventListener("click", () => {
    state.voiceEnabled = !state.voiceEnabled;
    refs.voiceToggle.classList.toggle("on", state.voiceEnabled);
    refs.voiceToggle.textContent = state.voiceEnabled ? "\u5df2\u542f\u7528" : "\u5df2\u9759\u97f3";
    refs.voiceToggle.setAttribute("aria-pressed", String(state.voiceEnabled));
    updateQuickStatus();
    updateMetricsView();
    addEvent("info", "Voice Status", state.voiceEnabled ? "Voice enabled." : "Voice muted.");
  });
}

function bindVoice() {
  document.querySelectorAll("[data-query]").forEach((button) => {
    button.addEventListener("click", () => {
      const query = button.dataset.query;
      if (query === "wake") {
        answerQuery("are you online", false);
      }
      if (query === "weather") {
        answerQuery("weather", false);
      }
      if (query === "status") {
        answerQuery("road status", false);
      }
      if (query === "energy") {
        answerQuery("energy", false);
      }
    });
  });

  document.getElementById("voiceAskBtn").addEventListener("click", () => {
    answerQuery(refs.voiceInput.value);
    refs.voiceInput.value = "";
  });

  refs.voiceInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      answerQuery(refs.voiceInput.value);
      refs.voiceInput.value = "";
    }
  });
}

function bindKeyboardShortcuts() {
  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement) {
      return;
    }
    if (event.key.toLowerCase() === "a") {
      triggerAlert("shortcut");
    }
    if (event.key.toLowerCase() === "r") {
      resetAlert();
    }
    if (event.key.toLowerCase() === "v") {
      refs.voiceToggle.click();
    }
  });
}

function initReveal() {
  document.querySelectorAll(".reveal").forEach((element) => {
    const delay = Number(element.dataset.delay || 0);
    element.style.setProperty("--delay", `${delay}s`);
  });
}

function bootstrapHistory() {
  for (let i = 0; i < 36; i += 1) {
    simulateMetrics();
    pushHistory();
  }
}

function bootstrap() {
  initReveal();
  initTargets();
  bootstrapHistory();
  bindSceneSwitch();
  bindLineToggle();
  bindEventFilter();
  bindNodeSvg();
  bindControls();
  bindVoice();
  bindKeyboardShortcuts();

  setScene("normal", false);
  updateThresholdText();
  updateClock();
  syncNodeGraphics();
  renderNodes();
  updateStatusViews();
  drawRadar();
  drawTrend();
  renderTargetsList();

  addEvent("info", "System Startup", "Master node online. SLE network connected.");
  addEvent("info", "Sampling", "Sensor and vision data collection started.");
  appendDialogue("bot", "Voice engine online. Ask for weather, traffic, energy, or node status.");

  runtime.tickTimer = setInterval(tick, 1600);
  runtime.clockTimer = setInterval(updateClock, 1000);
}

bootstrap();
