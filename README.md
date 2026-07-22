# 星智行 Web 看板

本目录包含星智行的 Web 可视化页面和 Serverless API。页面用于展示设备上传的雷达、环境、GPS、网络、摄像头和告警状态；API 用于接收设备遥测、读取最新快照、可选上传摄像头图片分片和处理手动告警。

## 目录结构

```text
website/
├── index.html
├── styles.css
├── script.js
├── normal.png
├── accident.png
├── api/
│   ├── radar.js
│   ├── latest.js
│   ├── camera-image-chunk.js
│   ├── alert.js
│   └── _lib/radar_store.js
├── sql/radar_tables.sql
├── .env.example
├── vercel.json
└── netlify.toml
```

## 本地预览

静态页面可直接打开：

```text
index.html
```

如果需要本地调试 API，建议使用 Vercel CLI 或其他兼容 Node.js Serverless Function 的运行环境。

## 部署

### Vercel

1. 导入仓库。
2. Root Directory 选择 `website`。
3. Build Command 留空。
4. Output Directory 留空。
5. 配置环境变量后部署。

### Netlify

静态页面可以部署到 Netlify。当前 API 采用 Vercel Serverless Function 风格，如需在 Netlify 上运行 API，需要按 Netlify Functions 的入口规范做适配。

## 环境变量

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
XZX_DEVICE_TOKEN=
```

- `SUPABASE_URL`：Supabase 项目地址。
- `SUPABASE_SERVICE_ROLE_KEY`：Supabase 服务端密钥。
- `XZX_DEVICE_TOKEN`：设备上传鉴权 Token，需要与固件中的 `CLOUD_DEVICE_TOKEN` 保持一致。

没有配置 Supabase 时，API 会退化为内存缓存，适合临时演示和调试。

## Supabase 数据表

在 Supabase SQL Editor 中执行：

```text
sql/radar_tables.sql
```

该脚本会创建 `telemetry_latest` 和 `radar_logs`，用于保存设备最新快照和雷达日志。已有数据库升级时，还应执行：

```text
sql/20260719_add_gps_columns.sql
```

遥测采用增量更新：本次请求只覆盖实际携带的字段，未携带字段保留数据库中的上一次有效值，不会写入伪造值或自动清零。

## API

### 上传设备快照

```http
POST /api/radar
Content-Type: application/json
X-Device-Token: <token>
```

```json
{
  "deviceId": "xzx-a12",
  "timestamp": 1714900000000,
  "radar": {
    "targetCount": 1,
    "speed": -20,
    "distance": 800,
    "x": 120,
    "y": 800
  },
  "environment": {
    "temperature": 26.3,
    "humidity": 61.8,
    "pressure": 1004.2,
    "altitude": 80.5
  },
  "gps": {
    "lat": 36.057,
    "lon": 103.833,
    "alt": 1518.6,
    "fixQuality": 1,
    "satellites": 6
  },
  "camera": {
    "status": "normal",
    "code": 1,
    "alert": false,
    "imageLen": 0
  }
}
```

当前主板固件默认关闭 JPEG 数据流上传以避免阻塞普通遥测，但仍会真实上传摄像头的 `normal/accident` 状态。`/api/camera-image-chunk` 接口保留为可选能力。

### 读取最新快照

```http
GET /api/latest?deviceId=xzx-a12
```

### 上传摄像头图片分片

```http
POST /api/camera-image-chunk
Content-Type: application/json
X-Device-Token: <token>
```

```json
{
  "deviceId": "xzx-a12",
  "camera": {
    "seq": 1,
    "total": 4096,
    "offset": 0,
    "dataHex": "ffd8...",
    "mime": "image/jpeg",
    "status": "accident",
    "alert": true
  }
}
```

### 手动告警

```http
POST /api/alert
Content-Type: application/json
```

```json
{
  "deviceId": "xzx-a12",
  "alert": true
}
```

## 域名配置

`robots.txt` 和 `sitemap.xml` 中使用的是示例域名。部署到正式域名后，将其中的 URL 改为实际站点地址即可。
