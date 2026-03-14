import { Service } from 'egg';
import * as lancedb from 'vectordb';
import * as path from 'path';

interface VectorRecord {
  chunk_id: string;
  vector: number[];
}

export interface SearchResult {
  chunkId: string;
  score: number;
}

const TABLE_NAME = 'chunks_vectors';

export default class VectorStoreService extends Service {
  private db: lancedb.Connection | null = null;

  private async getDb(): Promise<lancedb.Connection> {
    if (!this.db) {
      const dbPath = path.resolve(this.config.rag.lancedbPath);
      this.db = await lancedb.connect(dbPath);
    }
    return this.db;
  }

  private async getOrCreateTable(sampleVector: number[]): Promise<lancedb.Table> {
    const db = await this.getDb();
    const tableNames = await db.tableNames();
    if (tableNames.includes(TABLE_NAME)) {
      return db.openTable(TABLE_NAME);
    }
    return db.createTable(TABLE_NAME, [
      { chunk_id: '__init__', vector: sampleVector },
    ]);
  }

  /**
   * 写入向量与 chunk_id 到 LanceDB。仅追加；业务保证不重复 chunk_id，故不实现 upsert。
   */
  async addVectors(records: VectorRecord[]): Promise<void> {
    if (records.length === 0) return;

    const table = await this.getOrCreateTable(records[0].vector);

    const data = records.map(r => ({
      chunk_id: r.chunk_id,
      vector: r.vector,
    }));

    await table.add(data);
  }

  /**
   * 按 query 向量做 top-k 相似度检索，返回 [{ chunkId, score }]。
   */
  async search(queryVector: number[], topK?: number): Promise<SearchResult[]> {
    const k = topK || this.config.rag.retrieval.topK;
    const db = await this.getDb();
    const tableNames = await db.tableNames();

    if (!tableNames.includes(TABLE_NAME)) {
      return [];
    }

    const table = await db.openTable(TABLE_NAME);
    const results = await table
      .search(queryVector)
      .limit(k)
      .execute();

    return results
      .filter((r: any) => r.chunk_id !== '__init__')
      .map((r: any) => ({
        chunkId: r.chunk_id as string,
        score: r._distance != null ? (1 / (1 + r._distance)) : 0,
      }));
  }

  /**
   * 消费文档处理产出的 chunk，调用 EmbeddingProvider 生成向量，写入 LanceDB。
   */
  async indexChunks(chunks: Array<{ chunkId: string; text: string }>): Promise<void> {
    if (chunks.length === 0) return;

    const texts = chunks.map(c => c.text);
    const embeddings = await this.service.embeddingProvider.embedBatch(texts);

    const records: VectorRecord[] = chunks.map((c, i) => ({
      chunk_id: c.chunkId,
      vector: embeddings[i],
    }));

    await this.addVectors(records);
  }

  /**
   * 删除某文档的所有向量（按 chunk_id 列表）。
   */
  async deleteByChunkIds(chunkIds: string[]): Promise<void> {
    if (chunkIds.length === 0) return;

    const db = await this.getDb();
    const tableNames = await db.tableNames();
    if (!tableNames.includes(TABLE_NAME)) return;

    const table = await db.openTable(TABLE_NAME);
    const filter = chunkIds.map(id => `chunk_id = '${id}'`).join(' OR ');
    await table.delete(filter);
  }
}
