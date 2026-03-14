import { Service } from 'egg';
import { Op } from 'sequelize';

export interface MatchedContent {
  chunkId: string;
  docId: string;
  text: string;
  score: number;
  filename: string;
  metadata: Record<string, unknown> | null;
}

export default class RetrievalMatchService extends Service {

  /**
   * 完整检索流程：
   * 1. 校验 question（非空）
   * 2. query → embedding → 向量 top-k 检索
   * 3. 按 chunk_id 从 MySQL 取原文 & 文档元数据
   * 4. 组装匹配内容列表，按 score 降序
   */
  async retrieve(question: string): Promise<MatchedContent[]> {
    if (!question || !question.trim()) {
      throw new Error('question 不能为空');
    }

    const queryEmbedding = await this.service.embeddingProvider.embed(question);

    const searchResults = await this.service.vectorStore.search(queryEmbedding);

    if (searchResults.length === 0) {
      return [];
    }

    const chunkIds = searchResults.map((r: any) => r.chunkId);
    const chunks = await this.ctx.model.Chunk.findAll({
      where: { chunk_id: { [Op.in]: chunkIds } },
    });

    const chunkMap = new Map<string, any>();
    for (const chunk of chunks) {
      const data = chunk.get() as any;
      chunkMap.set(data.chunk_id, data);
    }

    const docIds = [...new Set(chunks.map((c: any) => (c.get() as any).doc_id as string))];
    const docs = await this.ctx.model.Document.findAll({
      where: { doc_id: { [Op.in]: docIds } },
      attributes: ['doc_id', 'filename'],
    });

    const docMap = new Map<string, string>();
    for (const doc of docs) {
      const data = doc.get() as any;
      docMap.set(data.doc_id, data.filename);
    }

    const matchedContents: MatchedContent[] = [];
    for (const result of searchResults) {
      const chunkData = chunkMap.get(result.chunkId);
      if (!chunkData) continue;

      matchedContents.push({
        chunkId: result.chunkId,
        docId: chunkData.doc_id,
        text: chunkData.text,
        score: result.score,
        filename: docMap.get(chunkData.doc_id) || '未知文档',
        metadata: chunkData.metadata,
      });
    }

    matchedContents.sort((a, b) => b.score - a.score);

    return matchedContents;
  }
}
