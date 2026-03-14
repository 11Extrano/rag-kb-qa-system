# 后端（server）

RAG 知识库问答系统后端，Egg.js + TypeScript，提供文档管理 API 与问答 API。依赖 MySQL、LanceDB（向量库）、可选嵌入/LLM 服务。

- 运行：`npm install && npm run dev`（需先启动 MySQL，见仓库根目录 README）
- 环境变量：可复制仓库根目录 `.env.example` 为根目录 `.env`，本服务会读取上级目录的 `.env`
