import { Service } from 'egg';
import { Op } from 'sequelize';
import { ChatMessage } from './llmProvider';

export interface MatchedContent {
  chunkId: string;
  docId: string;
  text: string;
  score: number;
  filename: string;
  metadata: Record<string, unknown> | null;
}

const REWRITE_SYSTEM = `你是检索查询改写助手。根据对话历史与「本轮用户输入」，只输出一句用于知识库向量检索的完整中文问句。
要求：独立可读、无指代模糊；不要解释、不要前缀、不要 Markdown；只输出这一句检索句。`;

export default class RetrievalMatchService extends Service {

  /** 单轮：直接对 question 做 embed → top-k（与历史实现一致，仅委托 retrieveByQueryText）。 */
  async retrieve(question: string): Promise<MatchedContent[]> {
    return this.retrieveByQueryText(this.requireNonEmptyQueryText(question));
  }

  /**
   * 多轮：先按历史改写检索句，再 embed → top-k；无历史时等价于单轮 retrieve。
   */
  async retrieveForConversation(
    priorMessages: ChatMessage[],
    currentUserMessage: string,
  ): Promise<MatchedContent[]> {
    const queryText = await this.rewriteQueryForRetrieval(
      priorMessages,
      this.requireNonEmptyQueryText(currentUserMessage),
    );
    return this.retrieveByQueryText(queryText);
  }

  /** trim 后非空则返回；否则抛错，供单轮与多轮入口共用。 */
  private requireNonEmptyQueryText(raw: string): string {
    const q = raw?.trim() ?? '';
    if (!q) {
      throw new Error('question 不能为空');
    }
    return q;
  }

  /**
   * 有历史时调用 LLM 将「历史 + 本轮输入」压缩为一句独立检索问句；失败或无历史则返回已 trim 的本轮原文。
   */
  private async rewriteQueryForRetrieval(
    priorMessages: ChatMessage[],
    currentUserMessage: string,
  ): Promise<string> {
    const q = currentUserMessage;
    if (priorMessages.length === 0) {
      return q;
    }

    const historyText = priorMessages
      .map(m => `${m.role === 'user' ? '用户' : '助手'}：${m.content}`)
      .join('\n');

    const messages: ChatMessage[] = [
      { role: 'system', content: REWRITE_SYSTEM },
      {
        role: 'user',
        content: `对话历史：\n${historyText}\n\n本轮用户输入：\n${q}`,
      },
    ];

    try {
      const out = await this.service.llmProvider.chat(messages);
      const line = out.trim().split(/\r?\n/).filter(Boolean)[0]?.trim() || '';
      return line || q;
    } catch (err: any) {
      this.logger.error('[RetrievalMatch] 检索改写失败，回退用户原句:', err?.message ?? err);
      return q;
    }
  }

  /**
   * 核心检索：query 文本 → embedding → 向量 top-k → MySQL 组装，按 score 降序。
   */
  private async retrieveByQueryText(queryText: string): Promise<MatchedContent[]> {
    const queryEmbedding = await this.service.embeddingProvider.embed(queryText);

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
