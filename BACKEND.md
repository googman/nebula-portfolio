# 后端接入说明

当前项目支持两种后端：

- 本地开发：Node API + `data/works.json`
- 线上部署：Vercel Serverless API + Supabase

## 启动

最简单方式：双击项目根目录的 `start.bat`。

命令行方式：

```bash
npm start
```

前端地址：

```text
http://127.0.0.1:5173/
```

API 地址：

```text
http://127.0.0.1:8787/api
```

## 数据

本地开发时，作品数据保存在：

```text
data/works.json
```

前端通过 `src/services/worksService.js` 访问 API。如果 API 不可用，会自动降级到浏览器 `localStorage`，避免页面不可用。

线上部署时，作品数据保存在 Supabase 的 `works` 表。

## 本地 API

```text
GET    /api/health
GET    /api/works
POST   /api/works
PUT    /api/works/:id
DELETE /api/works/:id
```

## 以后换成正式后端

项目已经准备好 Vercel + Supabase 部署：

1. 在 Supabase SQL Editor 运行 `supabase.schema.sql`。
2. 在 Vercel 项目环境变量里设置：

```text
SUPABASE_URL=你的 Supabase Project URL
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service_role key
```

3. 部署到 Vercel。

线上 API 文件在 `api/` 目录，前端仍然请求 `/api/works`，银河时间轴界面不需要改。
