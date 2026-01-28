import { Injectable, OnModuleInit } from '@nestjs/common';
import OpenAI from 'openai';
import { Stream } from 'openai/streaming';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  type: 'content' | 'done' | 'error' | 'complete';
  content?: string;
  error?: string;
  messageId?: string; // For 'complete' event: the real message ID from database
}

@Injectable()
export class AiService implements OnModuleInit {
  private openai: OpenAI;
  private model: string;

  onModuleInit() {
    this.openai = new OpenAI({
      apiKey: process.env.AI_API_KEY || 'sk-placeholder',
      baseURL: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
      timeout: 60000, // 60 seconds timeout
      maxRetries: 2,
    });
    this.model = process.env.AI_MODEL || 'gpt-3.5-turbo';
  }

  /**
   * Create a streaming chat completion
   */
  async *streamChat(
    messages: ChatMessage[],
  ): AsyncGenerator<StreamChunk, void, unknown> {
    try {
      // Add system prompt if not present
      const systemPrompt: ChatMessage = {
        role: 'system',
        content: `你是 NexusMind AI，一个智能、友好且专业的 AI 助手。
你擅长回答各类问题，包括编程、写作、分析和创意任务。
请用简洁清晰的中文回答，必要时使用 Markdown 格式。
如果用户问题不清楚，请礼貌地请求更多信息。`,
      };

      const allMessages = messages[0]?.role === 'system' 
        ? messages 
        : [systemPrompt, ...messages];

      const stream = await this.openai.chat.completions.create({
        model: this.model,
        messages: allMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 4096,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield { type: 'content', content };
        }
      }

      yield { type: 'done' };
    } catch (error: any) {
      console.error('AI Stream Error:', error);
      
      // 处理 API 错误，返回友好的错误消息
      let friendlyError = 'AI 服务暂时不可用，请稍后重试';
      
      if (error?.status === 401 || error?.statusCode === 401) {
        friendlyError = 'AI 服务认证失败，请检查 API Key 配置';
      } else if (error?.status === 402 || error?.statusCode === 402) {
        friendlyError = 'AI 服务暂时不可用，请检查余额或配置';
      } else if (error?.status === 403 || error?.statusCode === 403) {
        friendlyError = 'AI 服务访问被拒绝，请检查 API 权限配置';
      } else if (error?.status === 429 || error?.statusCode === 429) {
        friendlyError = 'AI 服务请求过于频繁，请稍后再试';
      } else if (error?.status === 500 || error?.statusCode === 500) {
        friendlyError = 'AI 服务内部错误，请稍后重试';
      } else if (error?.status === 503 || error?.statusCode === 503) {
        friendlyError = 'AI 服务暂时不可用，请稍后重试';
      } else if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND') {
        friendlyError = '无法连接到 AI 服务，请检查网络连接和 BASE_URL 配置';
      } else if (error?.message?.includes('timeout')) {
        friendlyError = 'AI 服务响应超时，请稍后重试';
      } else if (error instanceof Error) {
        // 检查是否是 OpenAI API 错误
        if (error.message.includes('insufficient_quota') || error.message.includes('quota')) {
          friendlyError = 'AI 服务暂时不可用，请检查余额或配置';
        } else if (error.message.includes('invalid_api_key')) {
          friendlyError = 'AI 服务认证失败，请检查 API Key 配置';
        } else if (error.message.includes('model_not_found')) {
          friendlyError = 'AI 模型不存在，请检查 MODEL 配置';
        } else {
          friendlyError = `AI 服务错误: ${error.message}`;
        }
      }
      
      yield {
        type: 'error',
        error: friendlyError,
      };
    }
  }

  /**
   * Non-streaming chat completion (for testing/fallback)
   */
  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      const systemPrompt: ChatMessage = {
        role: 'system',
        content: `你是 NexusMind AI，一个智能、友好且专业的 AI 助手。`,
      };

      const allMessages = messages[0]?.role === 'system' 
        ? messages 
        : [systemPrompt, ...messages];

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: allMessages,
        temperature: 0.7,
        max_tokens: 4096,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error: any) {
      // 使用相同的错误处理逻辑
      if (error?.status === 402 || error?.statusCode === 402) {
        throw new Error('AI 服务暂时不可用，请检查余额或配置');
      } else if (error?.status === 401 || error?.statusCode === 401) {
        throw new Error('AI 服务认证失败，请检查 API Key 配置');
      } else if (error?.message?.includes('insufficient_quota')) {
        throw new Error('AI 服务暂时不可用，请检查余额或配置');
      }
      throw error;
    }
  }
}
