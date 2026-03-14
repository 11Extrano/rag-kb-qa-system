import { Controller } from 'egg';

export default class DocumentController extends Controller {

  /**
   * POST /api/admin/documents
   * 上传文档 → 自动清洗/拆分/写入 MySQL → 向量化写入 LanceDB
   */
  async upload() {
    const { ctx } = this;

    const file = ctx.request.files?.[0];
    if (!file) {
      ctx.status = 400;
      ctx.body = { success: false, message: '请上传文件' };
      return;
    }

    try {
      const docId = await ctx.service.documentProcessing.uploadDocument(file);
      const chunks = await ctx.service.documentProcessing.processDocument(docId);

      try {
        await ctx.service.vectorStore.indexChunks(
          chunks.map((c: any) => ({ chunkId: c.chunkId, text: c.text })),
        );
      } catch (vecErr: any) {
        const doc = await ctx.model.Document.findOne({ where: { doc_id: docId } });
        if (doc) {
          await doc.update({ status: 'failed' });
        }
        throw vecErr;
      }

      ctx.body = {
        success: true,
        data: {
          docId,
          filename: file.filename,
          chunksCount: chunks.length,
        },
      };
    } catch (err: any) {
      ctx.logger.error('[DocumentUpload] 上传失败:', err);
      ctx.status = 500;
      ctx.body = { success: false, message: err.message };
    }
  }

  /**
   * GET /api/admin/documents
   * 文档列表
   */
  async list() {
    const { ctx } = this;

    try {
      const docs = await ctx.model.Document.findAll({
        attributes: ['doc_id', 'filename', 'status', 'created_at', 'updated_at'],
        order: [['created_at', 'DESC']],
      });

      ctx.body = {
        success: true,
        data: docs.map(d => d.get()),
      };
    } catch (err: any) {
      ctx.logger.error('[DocumentList] 查询失败:', err);
      ctx.status = 500;
      ctx.body = { success: false, message: err.message };
    }
  }

  /**
   * DELETE /api/admin/documents/:docId
   * 删除文档及其所有片段和向量
   */
  async destroy() {
    const { ctx } = this;
    const { docId } = ctx.params;

    try {
      const doc = await ctx.model.Document.findOne({ where: { doc_id: docId } });
      if (!doc) {
        ctx.status = 404;
        ctx.body = { success: false, message: '文档不存在' };
        return;
      }

      const chunks = await ctx.model.Chunk.findAll({
        where: { doc_id: docId },
        attributes: ['chunk_id'],
      });
      const chunkIds = chunks.map((c: any) => (c.get() as any).chunk_id as string);

      if (chunkIds.length > 0) {
        await ctx.service.vectorStore.deleteByChunkIds(chunkIds);
      }

      await ctx.model.Chunk.destroy({ where: { doc_id: docId } });
      await doc.destroy();

      ctx.body = { success: true, message: '文档已删除' };
    } catch (err: any) {
      ctx.logger.error('[DocumentDelete] 删除失败:', err);
      ctx.status = 500;
      ctx.body = { success: false, message: err.message };
    }
  }
}
