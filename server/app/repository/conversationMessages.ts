/**
 * 会话消息持久化（基础设施 / 仓储），不挂 Egg Service，避免与「检索 / 生成」等领域服务并列膨胀。
 */
import { Context } from 'egg';
import { ChatMessage } from '../service/llmProvider';

/** 确保 `conversations` 表存在该会话行，便于外键写入消息。 */
async function ensureConversation(ctx: Context, conversationId: string): Promise<void> {
  await ctx.model.Conversation.findOrCreate({
    where: { conversation_id: conversationId },
    defaults: { conversation_id: conversationId },
  });
}

/**
 * 拉取用于「检索改写 / 生成上下文」的历史：按 id 升序，最多保留配置中的最近 N 轮（user+assistant 各算一条）。
 */
export async function listMessagesForRewrite(ctx: Context, conversationId: string): Promise<ChatMessage[]> {
  const maxRounds = ctx.app.config.rag.conversation.maxHistoryRounds;
  const maxRows = maxRounds * 2;

  const rows = await ctx.model.ConversationMessage.findAll({
    where: { conversation_id: conversationId },
    order: [['id', 'ASC']],
  });

  const sliced = rows.length > maxRows ? rows.slice(-maxRows) : rows;
  return sliced.map(r => {
    const data = r.get() as { role: 'user' | 'assistant'; content: string };
    return { role: data.role, content: data.content };
  });
}

/**
 * 追加一轮对话：先 user 再 assistant 两条记录；若会话不存在则先创建会话行。
 */
export async function appendTurn(
  ctx: Context,
  conversationId: string,
  userContent: string,
  assistantContent: string,
): Promise<void> {
  await ensureConversation(ctx, conversationId);
  await ctx.model.ConversationMessage.bulkCreate([
    { conversation_id: conversationId, role: 'user', content: userContent },
    { conversation_id: conversationId, role: 'assistant', content: assistantContent },
  ]);
}

/** 列出该会话全部消息（含 id、时间），供 HTTP 查询；不做轮数截断。 */
export async function listMessagesAll(ctx: Context, conversationId: string) {
  const rows = await ctx.model.ConversationMessage.findAll({
    where: { conversation_id: conversationId },
    order: [['id', 'ASC']],
    attributes: ['id', 'role', 'content', 'created_at'],
  });
  return rows.map(r => {
    const data = r.get() as { id: number; role: string; content: string; created_at: Date };
    return {
      id: data.id,
      role: data.role,
      content: data.content,
      created_at: data.created_at,
    };
  });
}
