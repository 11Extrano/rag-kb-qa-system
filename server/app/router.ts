import { Application } from 'egg';

export default (app: Application) => {
  const { controller, router } = app;

  // 管理员接口 - 文档管理
  router.post('/api/admin/documents', controller.document.upload);
  router.get('/api/admin/documents', controller.document.list);
  router.delete('/api/admin/documents/:docId', controller.document.destroy);

  // 用户接口 - 问答
  router.post('/api/qa', controller.qa.ask);
};
