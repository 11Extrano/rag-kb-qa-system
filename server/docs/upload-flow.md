# 文档上传与 doc_id / chunk_id 完整流程

## 概念

| 概念 | 含义 | 生成时机 | 存储位置 |
|------|------|----------|----------|
| **doc_id** | 一个上传文件对应一个文档，其唯一标识 | 上传时用 UUID v4 生成，**一个文件 = 一个 doc_id** | MySQL `documents.doc_id` |
| **chunk_id** | 文档被拆成多段文本后，每一段的唯一标识 | 在「拆分」阶段，每写一条片段时用 UUID v4 生成，**一个片段 = 一个 chunk_id** | MySQL `chunks.chunk_id`，LanceDB 表里也存（只存 id + 向量，不存原文） |

关系：**1 个 doc_id → 多条 chunks（每条有 1 个 chunk_id）**。同一文档的所有 chunk 的 `doc_id` 都相同。

---

## 端到端上传流程（POST /api/admin/documents）

```
用户上传文件
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. uploadDocument(file)  [documentProcessing.ts]                          │
│    • 生成 doc_id = uuidv4()                                              │
│    • 读文件内容，校验扩展名 (.txt / .md / .html)                          │
│    • 写入 MySQL documents 表：doc_id, filename, original_content,        │
│      status='uploaded'                                                   │
│    • 返回 doc_id                                                         │
└─────────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. processDocument(docId)  [documentProcessing.ts]                       │
│    • 从 MySQL 按 doc_id 取出文档                                         │
│    • status → 'cleaning' → cleanText(original_content) → 清洗后全文       │
│    • 若清洗后为空 → status='failed'，抛错                                 │
│    • status → 'cleaned' → 'splitting'                                    │
│    • splitText(清洗后全文) → 得到多段文本（每段可有 metadata，如标题）    │
│    • 对每一段：                                                          │
│        - chunk_id = uuidv4()                                             │
│        - 写入 MySQL chunks 表：chunk_id, doc_id, text, metadata          │
│        - 收集到 chunkResults[]                                           │
│    • status → 'completed'                                                 │
│    • 返回 chunkResults（含 chunkId, docId, text, metadata）               │
└─────────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. indexChunks(chunks)  [vectorStore.ts]                                  │
│    • 入参：[{ chunkId, text }, ...]（来自上一步的 chunkResults）          │
│    • embedBatch(texts) → 得到每条 text 的向量                            │
│    • 组装 [{ chunk_id, vector }, ...]                                    │
│    • addVectors() → 写入 LanceDB（只存 chunk_id + vector，不存原文）      │
│    • 若此处失败：controller 把该 doc 的 status 改为 'failed'，再抛错。     │
│      MySQL 中该 doc 的 chunks 不删，仅通过 doc 状态表示本次上传失败。      │
└─────────────────────────────────────────────────────────────────────────┘
      │
      ▼
  返回 200：{ docId, filename, chunksCount }
```

---

## 数据落在哪里

- **MySQL documents**：doc_id、filename、original_content、status、时间戳。  
  - 一份上传文件 = 一条 document 记录，用 **doc_id** 唯一标识。

- **MySQL chunks**：chunk_id、doc_id、text、metadata、时间戳。  
  - 一条记录 = 文档中的一段文本，用 **chunk_id** 唯一标识；**doc_id** 指向所属文档。

- **LanceDB**：表里每行 = **chunk_id** + **vector**。  
  - 不存原文、不存 doc_id；检索时只用到 chunk_id，再用 chunk_id 回查 MySQL 拿原文和 doc 信息。

---

## 问答时如何用 doc_id / chunk_id

1. 用户提问 → query 转成向量 → 在 LanceDB 里做 top-k 检索 → 得到 **chunk_id** 和 score。
2. 用这些 **chunk_id** 在 MySQL **chunks** 里查原文、**doc_id**。
3. 用 **doc_id** 在 MySQL **documents** 里查 **filename** 等。
4. 把「原文 + 文档名 + chunk_id」作为参考内容给 LLM，并作为引用（citations）返回给前端。

所以：**doc_id** 标识「哪个上传文件」，**chunk_id** 标识「该文件下的哪一段」；上传流程里先有 doc_id，再在拆分时对每一段生成 chunk_id，并同时写入 MySQL 和 LanceDB。
