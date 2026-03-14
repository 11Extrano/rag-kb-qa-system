import { Controller } from 'egg';

export default class QaController extends Controller {

  /**
   * POST /api/qa
   * 用户问答接口：接收 question，返回 answer + 引用片段
   */
  async ask() {
    const { ctx } = this;
    const { question } = ctx.request.body as { question?: string };

    if (!question || !question.trim()) {
      ctx.status = 400;
      ctx.body = { success: false, message: 'question 不能为空' };
      return;
    }

    try {
      const matchedContents = await ctx.service.retrievalMatch.retrieve(question);

      const result = await ctx.service.answerGeneration.generateAnswer(question, matchedContents);

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
}
