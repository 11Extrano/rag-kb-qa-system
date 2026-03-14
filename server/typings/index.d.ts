import 'egg';

declare module 'egg' {
  interface RagEmbeddingConfig {
    provider: 'openai-compatible';
    baseUrl: string;
    apiKey: string;
    model: string;
    dimensions: number;
  }

  interface RagLLMConfig {
    provider: 'openai-compatible';
    baseUrl: string;
    apiKey: string;
    model: string;
    maxTokens: number;
  }

  interface RagChunkConfig {
    splitByHeading: boolean;
    maxLength: number;
    overlap: number;
  }

  interface RagRetrievalConfig {
    topK: number;
  }

  interface RagConfig {
    lancedbPath: string;
    embedding: RagEmbeddingConfig;
    llm: RagLLMConfig;
    chunk: RagChunkConfig;
    retrieval: RagRetrievalConfig;
  }

  interface EggAppConfig {
    rag: RagConfig;
  }
}
