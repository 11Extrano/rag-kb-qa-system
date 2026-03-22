import { Service } from 'egg';
import { MatchedContent } from './retrievalMatch';
import { ChatMessage } from './llmProvider';

export interface Citation {
  chunkId: string;
  docId: string;
  filename: string;
  text: string;
  score: number;
}

export interface AnswerResult {
  answer: string;
  citations: Citation[];
}

const SYSTEM_PROMPT = `你是一个知识库助手。请仅根据下面【参考内容】回答用户问题。
如果参考内容中无法得到答案，请如实说明"根据现有知识库内容，无法回答该问题"，不要编造信息。
回答时请尽量引用来源（如文档名、片段编号），以便用户核实。`;

/** 粗估 token：与 buildMessagesWithinBudget 预算逻辑一致（约每 3 字符 1 token）。 */
function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 3));
}

/** 将多段消息内容 token 粗估相加，用于判断是否超出 maxInputTokens。 */
function totalMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}

export interface GenerateAnswerOptions {
  /** 当前会话内、本轮之前的 user/assistant 消息 */
  history?: ChatMessage[];
}

export default class AnswerGenerationService extends Service {

  /** 从配置读取本轮可送入模型的最大输入 token 预算（含 system / 历史 / 参考 / 问题）。 */
  private getMaxInputTokens(): number {
    return this.config.rag.conversation.maxInputTokens;
  }

  /** 将命中的片段格式化为「参考1/2…」文本块，嵌入 user 尾条。 */
  private formatReferences(contents: MatchedContent[]): string {
    return contents.map((mc, index) => {
      const source = `[来源: ${mc.filename}, 片段: ${mc.chunkId.slice(0, 8)}]`;
      return `参考${index + 1} ${source}:\n${mc.text}`;
    }).join('\n\n---\n\n');
  }

  /**
   * 按设计：先裁 RAG 低分条 → 再裁历史成对 → 再截短本轮问题 → 最后缩短 system。
   * effectiveRefs 与最终进入 prompt 的参考条一致，用于 citations。
   */
  private buildMessagesWithinBudget(
    question: string,
    matchedContents: MatchedContent[],
    history: ChatMessage[],
  ): { messages: ChatMessage[]; effectiveRefs: MatchedContent[] } {
    const maxTokens = this.getMaxInputTokens();
    let refs = [...matchedContents].sort((a, b) => b.score - a.score);
    let hist = [...history];
    let q = question;
    let systemContent = SYSTEM_PROMPT;

    const assemble = (): ChatMessage[] => {
      const refText = this.formatReferences(refs);
      const tail: ChatMessage = {
        role: 'user',
        content: `【参考内容】\n${refText}\n\n【用户问题】\n${q}`,
      };
      return [{ role: 'system', content: systemContent }, ...hist, tail];
    };

    let guard = 0;
    while (guard++ < 64) {
      const messages = assemble();
      if (totalMessagesTokens(messages) <= maxTokens) {
        return { messages, effectiveRefs: refs };
      }
      if (refs.length > 1) {
        refs = refs.slice(0, -1);
        continue;
      }
      if (hist.length >= 2) {
        hist = hist.slice(2);
        continue;
      }
      if (q.length > 20) {
        q = q.slice(0, Math.floor(q.length * 0.75));
        continue;
      }
      systemContent = systemContent.slice(0, Math.floor(systemContent.length * 0.85));
      if (systemContent.length < 80) {
        const messages = assemble();
        return { messages, effectiveRefs: refs };
      }
    }
    const messages = assemble();
    return { messages, effectiveRefs: refs };
  }

  /** 非流式：组装预算内消息 → LLM 一次返回全文；citations 与最终进 prompt 的参考条一致。 */
  async generateAnswer(
    question: string,
    matchedContents: MatchedContent[],
    options?: GenerateAnswerOptions,
  ): Promise<AnswerResult> {
    if (matchedContents.length === 0) {
      return {
        answer: '当前知识库中暂无相关内容，无法回答您的问题。请确认知识库中已上传相关文档。',
        citations: [],
      };
    }

    const history = options?.history ?? [];
    const { messages, effectiveRefs } = this.buildMessagesWithinBudget(question, matchedContents, history);

    let answer: string;
    try {
      answer = await this.service.llmProvider.chat(messages);
    } catch (err: any) {
      this.logger.error('[AnswerGeneration] LLM 调用失败:', err.message);
      answer = this.buildFallbackAnswer(matchedContents);
    }

    const citations: Citation[] = effectiveRefs.map(mc => ({
      chunkId: mc.chunkId,
      docId: mc.docId,
      filename: mc.filename,
      text: mc.text.length > 200 ? mc.text.slice(0, 200) + '...' : mc.text,
      score: mc.score,
    }));

    return { answer, citations };
  }

  /** LLM 不可用时返回的兜底文案：摘录若干片段原文供用户自行查看。 */
  private buildFallbackAnswer(contents: MatchedContent[]): string {
    const snippets = contents.slice(0, 3).map((mc, i) =>
      `${i + 1}. [${mc.filename}] ${mc.text.slice(0, 300)}${mc.text.length > 300 ? '...' : ''}`,
    ).join('\n\n');

    return `抱歉，答案生成服务暂时不可用。以下是与您问题最相关的知识库片段，供参考：\n\n${snippets}`;
  }

  /**
   * 流式：先逐段 yield chunk，最后 yield citations（与 prompt 内有效参考一致），供 SSE 封装。
   */
  async *generateAnswerStream(
    question: string,
    matchedContents: MatchedContent[],
    options?: GenerateAnswerOptions,
  ): AsyncGenerator<{ type: 'chunk'; text: string } | { type: 'citations'; citations: Citation[] }, void, undefined> {
    if (matchedContents.length === 0) {
      yield { type: 'chunk', text: '当前知识库中暂无相关内容，无法回答您的问题。请确认知识库中已上传相关文档。' };
      yield { type: 'citations', citations: [] };
      return;
    }

    const history = options?.history ?? [];
    const { messages, effectiveRefs } = this.buildMessagesWithinBudget(question, matchedContents, history);
    const citations: Citation[] = effectiveRefs.map(mc => ({
      chunkId: mc.chunkId,
      docId: mc.docId,
      filename: mc.filename,
      text: mc.text.length > 200 ? mc.text.slice(0, 200) + '...' : mc.text,
      score: mc.score,
    }));

    try {
      for await (const text of this.service.llmProvider.chatStream(messages)) {
        yield { type: 'chunk', text };
      }
    } catch (err: any) {
      this.logger.error('[AnswerGeneration] 流式 LLM 调用失败:', err.message);
      yield { type: 'chunk', text: this.buildFallbackAnswer(matchedContents) };
    }

    yield { type: 'citations', citations };
  }
}
