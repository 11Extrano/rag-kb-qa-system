# RAG 知识库问答系统

基于企业自有文档的检索增强生成（RAG）系统：文档上传 → 清洗/拆分 → 向量化存储 → 检索匹配 → 答案生成。支持管理员管理文档、用户自然语言提问并获取带引用来源的答案。

- **Node**：22（见 `.nvmrc`）
- **前后端分离**：
  - **client/**：前端，React 18 + TypeScript + Rsbuild + Ant Design
  - **server/**：后端，Egg.js + TypeScript，MySQL，LanceDB

## 目录结构

```
├── client/          # 前端（待实现，见 tasks 7.x）
├── server/          # 后端（Egg.js）
├── openspec/        # OpenSpec 变更与规格
├── docker-compose.yml
├── .env.example
└── README.md
```

## 快速开始

1. **Node 22**
   ```bash
   nvm use 22   # 或按 .nvmrc
   ```

2. **MySQL（本地开发）**
   ```bash
   docker-compose up -d
   ```
   复制 `.env.example` 为 `.env`，并设置 `MYSQL_PASSWORD=rag_kb_dev`（与 docker-compose 一致）。

3. **后端**
   ```bash
   cd server && npm install && npm run dev
   ```
   接口默认：http://127.0.0.1:7001

4. **前端**（实现后）
   ```bash
   cd client && npm install && npm run dev
   ```

根目录脚本：`npm run dev:server` / `npm run dev:client` 分别进入 server、client 开发。

## API

- 管理员：`POST/GET/DELETE /api/admin/documents`（上传、列表、删除）
- 用户：`POST /api/qa`，body `{ "question": "..." }`，返回 `answer` 与 `citations`

设计、规格与任务见 `openspec/changes/setup-rag-kb-qa-system/`。
