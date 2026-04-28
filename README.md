# 星智行网站上线与长期维护指南

本目录为纯静态站点，可通过 Git 自动部署到 Vercel 或 Netlify。

## 目录结构

- `index.html`：主页面
- `styles.css`：样式
- `script.js`：交互逻辑
- `404.html`：自定义 404 页面
- `robots.txt`：搜索引擎抓取规则
- `sitemap.xml`：站点地图
- `site.webmanifest`：PWA 基础配置
- `favicon.svg`：站点图标
- `og-cover.svg`：社交分享封面
- `vercel.json`：Vercel 生产头配置
- `netlify.toml`：Netlify 生产头配置

## 1) 推荐自动部署方式（长期维护）

### 方式 A：Vercel（推荐）

1. 将项目推送到 GitHub 仓库。
2. 登录 Vercel，点击 `Add New -> Project`。
3. 选择该仓库并导入。
4. Root Directory 选择 `website`。
5. Build Command 留空，Output Directory 留空（静态站）。
6. 点击 Deploy。
7. 之后每次 `git push` 自动触发部署。

### 方式 B：Netlify

1. 将项目推送到 GitHub 仓库。
2. 登录 Netlify，点击 `Add new site -> Import an existing project`。
3. 选择该仓库。
4. Base directory 填 `website`。
5. Build command 留空，Publish directory 填 `website`（或 `.`，视 Base directory 是否已设）。
6. 点击 Deploy。
7. 后续每次 `git push` 自动部署。

## 2) 首次上线前必须替换的内容

请把以下占位域名 `https://traffic-sign.example.com/` 改成你的真实域名：

- `index.html` 中：
  - `canonical`
  - `og:url`
  - `og:image`
- `robots.txt` 中 `Sitemap` 地址
- `sitemap.xml` 中 `loc`

## 3) 域名与 HTTPS

1. 在 Vercel 或 Netlify 后台绑定你的域名。
2. 按平台提示添加 DNS 记录（通常是 CNAME 或 A 记录）。
3. 等待证书自动签发（HTTPS 自动启用）。

## 4) 每次发布前检查清单

- 页面功能：场景切换、事故告警、语音交互、趋势图、拓扑联动可正常使用。
- 移动端：320px~768px 断点下布局不溢出。
- 元信息：title、description、OG 图、canonical 是否正确。
- 索引文件：`robots.txt` 和 `sitemap.xml` 域名是否正确。
- 404：任意错误路径是否展示 `404.html`。
- 缓存：CSS/JS 变更后是否能强刷看到最新版本。

## 5) 版本管理建议

- 分支模型：
  - `main`：生产环境
  - `dev`：日常开发
- 发布流程：
  1. 功能开发合并到 `dev`
  2. 验收后从 `dev` 合并到 `main`
  3. 平台自动部署生产版本
- 建议每次发布打 Tag：`v1.0.0`、`v1.1.0`...

## 6) 运维建议（轻量）

- 接入访问统计（如 Plausible / GA4）
- 定期检查 Lighthouse 分数
- 每月复核一次 `sitemap.xml` 与页面元信息
- 改动较大时保留上一稳定版本，便于快速回滚

## 7) 回滚方式

- Vercel/Netlify 均支持在部署历史中一键回滚到上一版本。

