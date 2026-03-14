import { Service } from 'egg';
import OpenAI from 'openai';

const MAX_RETRIES = 2;
const TIMEOUT_MS = 60_000;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export default class LlmProviderService extends Service {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      const { baseUrl, apiKey } = this.config.rag.llm;
      this.client = new OpenAI({
        baseURL: baseUrl,
        apiKey,
        timeout: TIMEOUT_MS,
        maxRetries: MAX_RETRIES,
      });
    }
    return this.client;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const { model, maxTokens } = this.config.rag.llm;
    const client = this.getClient();

    const response = await client.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('LLM 返回内容为空');
    }

    return content;
  }
}
