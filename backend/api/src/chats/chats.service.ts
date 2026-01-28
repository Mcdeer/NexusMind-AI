import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { AiService, ChatMessage, StreamChunk } from '../ai';
import { MessageRole } from '@prisma/client';

@Injectable()
export class ChatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Get all chats ordered by updatedAt descending
   */
  async findAll() {
    return this.prisma.chat.findMany({
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        messages: {
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  /**
   * Get a specific chat with all its messages
   */
  async findOne(id: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!chat) {
      throw new NotFoundException(`Chat with ID "${id}" not found`);
    }

    return chat;
  }

  /**
   * Create a new chat with default title
   */
  async create() {
    return this.prisma.chat.create({
      data: {
        title: '新对话',
      },
    });
  }

  /**
   * Add a message to a specific chat
   */
  async addMessage(chatId: string, role: MessageRole, content: string) {
    // Verify chat exists
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new NotFoundException(`Chat with ID "${chatId}" not found`);
    }

    // Create message and update chat's updatedAt
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          chatId,
          role,
          content,
        },
      }),
      this.prisma.chat.update({
        where: { id: chatId },
        data: {
          // Auto-generate title from first user message if still default
          ...(chat.title === '新对话' && role === 'user'
            ? { title: content.slice(0, 50) + (content.length > 50 ? '...' : '') }
            : {}),
          updatedAt: new Date(),
        },
      }),
    ]);

    return message;
  }

  /**
   * Get chat history formatted for AI
   */
  async getChatHistory(chatId: string): Promise<ChatMessage[]> {
    const chat = await this.findOne(chatId);
    
    return chat.messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    }));
  }

  /**
   * Stream AI response for a chat
   */
  async *streamAiResponse(
    chatId: string,
    userMessage: string,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    // 1. Save user message
    await this.addMessage(chatId, 'user', userMessage);

    // 2. Get chat history
    const history = await this.getChatHistory(chatId);

    // 3. Stream AI response
    let fullResponse = '';
    let streamError: StreamChunk | null = null;
    
    try {
      for await (const chunk of this.aiService.streamChat(history)) {
        if (chunk.type === 'content' && chunk.content) {
          fullResponse += chunk.content;
          yield chunk;
        } else if (chunk.type === 'error') {
          streamError = chunk;
          yield chunk;
          break;
        } else if (chunk.type === 'done') {
          // Don't yield 'done' immediately - we need to save first
          break;
        } else {
          yield chunk;
        }
      }
    } catch (error) {
      console.error('Error during streaming:', error);
      streamError = {
        type: 'error',
        error: error instanceof Error ? error.message : 'Stream error',
      };
      yield streamError;
      return; // Exit early on error
    }

    // 4. Save AI response to database BEFORE closing the stream
    // This ensures the message is persisted before we send the complete event
    if (fullResponse && !streamError) {
      try {
        const savedMessage = await this.addMessage(chatId, 'assistant', fullResponse);
        console.log(`Saved AI message to chat ${chatId}, id: ${savedMessage.id}, length: ${fullResponse.length}`);
        
        // Send 'complete' event with the real message ID
        // This must be sent BEFORE the stream closes
        yield {
          type: 'complete',
          messageId: savedMessage.id,
        };
      } catch (error) {
        console.error('Failed to save AI message:', error);
        // Even if save fails, yield error so frontend knows
        yield {
          type: 'error',
          error: 'Failed to save message to database',
        };
      }
    } else if (fullResponse && streamError) {
      console.warn(`Stream had error but collected ${fullResponse.length} chars, not saving`);
    }
  }

  /**
   * Delete a chat and all its messages
   */
  async remove(id: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id },
    });

    if (!chat) {
      throw new NotFoundException(`Chat with ID "${id}" not found`);
    }

    return this.prisma.chat.delete({
      where: { id },
    });
  }

  /**
   * Update chat title
   */
  async updateTitle(id: string, title: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id },
    });

    if (!chat) {
      throw new NotFoundException(`Chat with ID "${id}" not found`);
    }

    return this.prisma.chat.update({
      where: { id },
      data: { title },
    });
  }
}
