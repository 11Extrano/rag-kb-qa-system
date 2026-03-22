import { Controller } from 'egg';
import * as conversationMessages from '../repository/conversationMessages';

export default class ConversationController extends Controller {

  /**
   * GET /api/conversations/:conversationId/messages
   * 仅返回该会话下有序消息，不枚举全部会话。
   */
  async messages() {
    const { ctx } = this;
    const { conversationId } = ctx.params;
    if (!conversationId?.trim()) {
      ctx.status = 400;
      ctx.body = { success: false, message: 'conversationId 无效' };
      return;
    }

    const data = await conversationMessages.listMessagesAll(ctx, conversationId.trim());
    ctx.body = { success: true, data };
  }
}
