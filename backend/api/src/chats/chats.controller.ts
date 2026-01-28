import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  HttpCode,
  HttpStatus,
  Res,
  Query,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChatsService } from './chats.service';
import { CreateMessageDto } from './dto';

@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  /**
   * GET /chats
   * Get all chats ordered by updatedAt descending
   */
  @Get()
  findAll() {
    return this.chatsService.findAll();
  }

  /**
   * GET /chats/:id
   * Get a specific chat with all its messages
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.chatsService.findOne(id);
  }

  /**
   * POST /chats
   * Create a new chat
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create() {
    return this.chatsService.create();
  }

  /**
   * POST /chats/:id/messages
   * Add a message to a specific chat
   * 
   * Query params:
   * - stream=true: Enable SSE streaming for AI response
   */
  @Post(':id/messages')
  async addMessage(
    @Param('id') id: string,
    @Body() createMessageDto: CreateMessageDto,
    @Query('stream') stream: string,
    @Res() res: Response,
  ) {
    // Non-streaming mode: just save the message
    if (stream !== 'true') {
      const message = await this.chatsService.addMessage(
        id,
        createMessageDto.role ?? 'user',
        createMessageDto.content,
      );
      return res.status(HttpStatus.CREATED).json(message);
    }

    // Streaming mode: SSE for AI response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    try {
      for await (const chunk of this.chatsService.streamAiResponse(
        id,
        createMessageDto.content,
      )) {
        // Send each chunk as SSE event
        const data = JSON.stringify(chunk);
        res.write(`data: ${data}\n\n`);

        // Flush the response (for compression middleware)
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }

        // Stream ends on 'complete', 'error', or when generator finishes
        // 'complete' means message was saved and we have the real ID
        if (chunk.type === 'complete' || chunk.type === 'error') {
          break;
        }
      }
    } catch (error) {
      console.error('Stream error:', error);
      const errorData = JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Stream error',
      });
      res.write(`data: ${errorData}\n\n`);
    }

    // Close the stream AFTER all chunks (including 'complete') have been sent
    res.end();
  }

  /**
   * PATCH /chats/:id
   * Update chat title
   */
  @Patch(':id')
  updateTitle(@Param('id') id: string, @Body('title') title: string) {
    return this.chatsService.updateTitle(id, title);
  }

  /**
   * DELETE /chats/:id
   * Delete a chat and all its messages
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.chatsService.remove(id);
  }
}
