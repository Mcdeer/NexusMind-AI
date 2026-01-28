/**
 * API Client for NexusMind Backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const errorMessage = error.message || error.error || `API Error: ${response.status}`;
      throw new Error(errorMessage);
    }

  // Handle 204 No Content
  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

// ============================================
// Types
// ============================================

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  createdAt: string;
  chatId: string;
}

export interface CreateMessagePayload {
  content: string;
  role?: 'user' | 'assistant' | 'system';
}

export interface StreamChunk {
  type: 'content' | 'done' | 'error' | 'complete';
  content?: string;
  error?: string;
  messageId?: string; // For 'complete' event: the real message ID from database
}

export interface StreamCallbacks {
  onContent: (content: string) => void;
  onComplete: (messageId: string) => void; // Called when message is saved with real ID
  onError: (error: string) => void;
}

// ============================================
// Chat API
// ============================================

/**
 * Fetch all chats ordered by updatedAt descending
 */
export async function fetchChats(): Promise<Chat[]> {
  return fetchAPI<Chat[]>('/chats');
}

/**
 * Fetch a specific chat with all its messages
 */
export async function fetchChat(chatId: string): Promise<Chat> {
  return fetchAPI<Chat>(`/chats/${chatId}`);
}

/**
 * Alias for fetchChat - fetch messages for a specific chat
 */
export async function fetchMessages(chatId: string): Promise<Chat> {
  return fetchChat(chatId);
}

/**
 * Create a new chat
 */
export async function createChat(): Promise<Chat> {
  return fetchAPI<Chat>('/chats', {
    method: 'POST',
  });
}

/**
 * Add a message to a specific chat (non-streaming)
 */
export async function sendMessage(
  chatId: string,
  payload: CreateMessagePayload
): Promise<Message> {
  return fetchAPI<Message>(`/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Send a message and receive streaming AI response via SSE
 */
export async function sendMessageStream(
  chatId: string,
  content: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const url = `${API_BASE_URL}/chats/${chatId}/messages?stream=true`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content, role: 'user' }),
      signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const errorMessage = error.message || error.error || `API Error: ${response.status}`;
      throw new Error(errorMessage);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6); // Remove 'data: ' prefix
          
          if (!data) continue;

          try {
            const chunk: StreamChunk = JSON.parse(data);

            switch (chunk.type) {
              case 'content':
                if (chunk.content) {
                  callbacks.onContent(chunk.content);
                }
                break;
              case 'complete':
                // Message saved successfully, provide real ID
                if (chunk.messageId) {
                  callbacks.onComplete(chunk.messageId);
                }
                return;
              case 'error':
                callbacks.onError(chunk.error || 'Unknown error');
                return;
            }
          } catch (parseError) {
            console.error('Failed to parse SSE data:', data, parseError);
          }
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.startsWith('data: ')) {
      const data = buffer.slice(6);
      if (data) {
        try {
          const chunk: StreamChunk = JSON.parse(data);
          if (chunk.type === 'content' && chunk.content) {
            callbacks.onContent(chunk.content);
          } else if (chunk.type === 'complete' && chunk.messageId) {
            callbacks.onComplete(chunk.messageId);
          } else if (chunk.type === 'error') {
            callbacks.onError(chunk.error || 'Unknown error');
          }
        } catch {
          // Ignore parse errors for final chunk
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Request was cancelled
      return;
    }
    callbacks.onError(error instanceof Error ? error.message : 'Stream error');
  }
}

/**
 * Update chat title
 */
export async function updateChatTitle(
  chatId: string,
  title: string
): Promise<Chat> {
  return fetchAPI<Chat>(`/chats/${chatId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
}

/**
 * Delete a chat
 */
export async function deleteChat(chatId: string): Promise<void> {
  return fetchAPI<void>(`/chats/${chatId}`, {
    method: 'DELETE',
  });
}
