import { Application } from 'egg';

export default (app: Application) => {
  const { controller, router } = app;

  // 管理员接口 - 文档管理
  router.post('/api/admin/documents', controller.document.upload);
  router.get('/api/admin/documents', controller.document.list);
  router.delete('/api/admin/documents/:docId', controller.document.destroy);

  // 用户接口 - 问答
  router.post('/api/qa', controller.qa.ask);

  // 当前会话消息（只读，不列举全部会话）
  router.get('/api/conversations/:conversationId/messages', controller.conversation.messages);
};
