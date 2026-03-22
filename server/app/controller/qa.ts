import { Controller } from 'egg';
import { ChatMessage } from '../service/llmProvider';
import * as conversationMessages from '../repository/conversationMessages';

/** 构造一条 SSE 帧：`event` + 多行 `data:`，与浏览器 EventSource 解析约定一致。 */
function sseEvent(event: string, data: string): string {
  const dataLines = data.split('\n').map(line => `data: ${line}`).join('\n');
  return `event: ${event}\n${dataLines || 'data: '}\n\n`;
}

export default class QaController extends Controller {

  /**
   * POST /api/qa
   * body: { question, stream?, conversationId? }
   */
  async ask() {
    const { ctx } = this;
    const body = ctx.request.body as {
      question?: string;
      stream?: boolean;
      conversationId?: string;
    };
    const { question, stream: wantStream, conversationId: rawCid } = body;

    if (!question || !question.trim()) {
      ctx.status = 400;
      ctx.body = { success: false, message: 'question 不能为空' };
      return;
    }

    const conversationId = rawCid?.trim() || '';

    let priorHistory: ChatMessage[] = [];
    if (conversationId) {
      priorHistory = await conversationMessages.listMessagesForRewrite(ctx, conversationId);
    }

    let matchedContents: Awaited<ReturnType<typeof ctx.service.retrievalMatch.retrieveForConversation>>;
    try {
      matchedContents = await ctx.service.retrievalMatch.retrieveForConversation(priorHistory, question);
    } catch (err: any) {
      ctx.logger.error('[QA] 检索失败:', err);
      ctx.status = 500;
      ctx.body = { success: false, message: err?.message ?? '检索失败' };
      return;
    }

    if (wantStream === true) {
      await this.askStream(ctx, question, matchedContents, priorHistory, conversationId);
      return;
    }

    try {
      const result = await ctx.service.answerGeneration.generateAnswer(question, matchedContents, {
        history: priorHistory,
      });
      if (conversationId) {
        await conversationMessages.appendTurn(ctx, conversationId, question, result.answer);
      }
      ctx.body = {
        success: true,
        data: {
          question,
          answer: result.answer,
          citations: result.citations,
        },
      };
    } catch (err: any) {
      ctx.logger.error('[QA] 问答失败:', err);
      ctx.status = 500;
      ctx.body = { success: false, message: err.message };
    }
  }

  /**
   * 流式问答：写 SSE 头后消费 generateAnswerStream，转发 chunk / citations / done；可选在结束后 appendTurn。
   */
  private async askStream(
    ctx: any,
    question: string,
    matchedContents: Awaited<ReturnType<typeof ctx.service.retrievalMatch.retrieve>>,
    priorHistory: ChatMessage[],
    conversationId: string,
  ) {
    const writeErrorAndClose = (message: string) => {
      try {
        ctx.res.write(sseEvent('error', message));
      } catch (_) { /* ignore */ }
      try {
        ctx.res.end();
      } catch (_) { /* ignore */ }
    };

    ctx.set('Content-Type', 'text/event-stream');
    ctx.set('Cache-Control', 'no-cache');
    ctx.set('Connection', 'keep-alive');
    ctx.status = 200;
    (ctx as any).respond = false;
    ctx.res.flushHeaders();

    let fullAnswer = '';

    try {
      const stream = ctx.service.answerGeneration.generateAnswerStream(question, matchedContents, {
        history: priorHistory,
      });

      for await (const item of stream) {
        if (item.type === 'chunk') {
          fullAnswer += item.text;
          ctx.res.write(sseEvent('chunk', item.text));
        } else if (item.type === 'citations') {
          ctx.res.write(sseEvent('citations', JSON.stringify(item.citations)));
          ctx.res.write(sseEvent('done', '{}'));
        }
      }

      if (conversationId && fullAnswer) {
        try {
          await conversationMessages.appendTurn(ctx, conversationId, question, fullAnswer);
        } catch (e: any) {
          ctx.logger.error('[QA] 写入会话消息失败:', e?.message ?? e);
        }
      }
    } catch (err: any) {
      ctx.logger.error('[QA] 流式问答失败:', err);
      writeErrorAndClose(err?.message ?? String(err));
      return;
    }

    try {
      ctx.res.end();
    } catch (_) { /* ignore */ }
  }
}
