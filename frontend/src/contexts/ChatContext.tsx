"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import {
  Chat,
  Message,
  fetchChats,
  fetchChat,
  createChat as apiCreateChat,
  sendMessageStream,
  deleteChat as apiDeleteChat,
} from "@/lib/api-client";

// Temporary ID prefix for optimistic updates
const TEMP_ID_PREFIX = "temp_";

interface ChatContextType {
  // State
  chats: Chat[];
  currentChat: Chat | null;
  currentChatId: string | null;
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  isStreaming: boolean;
  error: string | null;
  lastFailedMessage: { content: string; chatId: string } | null;

  // Actions
  loadChats: () => Promise<void>;
  selectChat: (chatId: string) => Promise<void>;
  createChat: () => Promise<Chat | null>;
  sendMessage: (content: string) => Promise<void>;
  retryLastMessage: () => Promise<void>;
  stopStreaming: () => void;
  deleteChat: (chatId: string) => Promise<void>;
  clearError: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<{ content: string; chatId: string } | null>(null);

  // AbortController for cancelling streaming requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load all chats
  const loadChats = useCallback(async () => {
    setIsLoadingChats(true);
    setError(null);
    try {
      const data = await fetchChats();
      setChats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chats");
      console.error("Failed to load chats:", err);
    } finally {
      setIsLoadingChats(false);
    }
  }, []);

  // Select and load a specific chat
  const selectChat = useCallback(async (chatId: string) => {
    setCurrentChatId(chatId);
    setIsLoadingMessages(true);
    setError(null);
    try {
      const data = await fetchChat(chatId);
      
      // Merge strategy: preserve local messages with content over empty DB messages
      setCurrentChat((prev) => {
        // If no previous chat or different chat, just use fetched data
        if (!prev || prev.id !== chatId) {
          return data;
        }
        
        // Merge: keep local messages that have content, use DB messages for missing ones
        const localMessages = prev.messages || [];
        const dbMessages = data.messages || [];
        
        // Create a map of DB messages by ID for quick lookup
        const dbMessageMap = new Map(dbMessages.map((msg) => [msg.id, msg]));
        
        // Create a map of local messages by ID (including temp messages)
        const localMessageMap = new Map<string, Message>();
        localMessages.forEach((msg) => {
          localMessageMap.set(msg.id, msg);
        });
        
        // Build merged messages list
        const mergedMessages: Message[] = [];
        const processedLocalIds = new Set<string>();
        
        // First pass: process DB messages, prefer local version if it has content
        dbMessages.forEach((dbMsg) => {
          const localMsg = localMessageMap.get(dbMsg.id);
          if (localMsg && localMsg.content && (!dbMsg.content || dbMsg.content.length === 0)) {
            // Local message has content but DB doesn't - use local
            mergedMessages.push(localMsg);
          } else if (dbMsg.content && dbMsg.content.length > 0) {
            // DB message has content - use it
            mergedMessages.push(dbMsg);
          } else if (localMsg) {
            // Both empty, prefer local to preserve temp IDs
            mergedMessages.push(localMsg);
          } else {
            // Only DB exists
            mergedMessages.push(dbMsg);
          }
          processedLocalIds.add(dbMsg.id);
        });
        
        // Second pass: add local temp messages that aren't in DB yet
        localMessages.forEach((localMsg) => {
          // Skip if already processed
          if (processedLocalIds.has(localMsg.id)) {
            return;
          }
          
          // Add temp messages or local messages with content
          if (
            localMsg.id.startsWith(TEMP_ID_PREFIX) ||
            (localMsg.content && localMsg.content.length > 0)
          ) {
            mergedMessages.push(localMsg);
          }
        });
        
        // Sort by createdAt to maintain chronological order
        mergedMessages.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        return {
          ...data,
          messages: mergedMessages,
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chat");
      console.error("Failed to load chat:", err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // Create a new chat
  const createChat = useCallback(async () => {
    setError(null);
    try {
      const newChat = await apiCreateChat();
      // Add to list and select it
      setChats((prev) => [newChat, ...prev]);
      setCurrentChatId(newChat.id);
      setCurrentChat({ ...newChat, messages: [] });
      return newChat;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create chat");
      console.error("Failed to create chat:", err);
      return null;
    }
  }, []);

  // Send a message with streaming AI response
  const sendMessage = useCallback(
    async (content: string) => {
      if (!currentChatId) {
        setError("No chat selected");
        return;
      }

      setError(null);
      setIsStreaming(true);

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      // 1. Optimistically add user message
      const userMessage: Message = {
        id: `${TEMP_ID_PREFIX}user_${Date.now()}`,
        content,
        role: "user",
        createdAt: new Date().toISOString(),
        chatId: currentChatId,
      };

      // 2. Create AI message placeholder
      const aiMessageId = `${TEMP_ID_PREFIX}ai_${Date.now()}`;
      const aiMessage: Message = {
        id: aiMessageId,
        content: "",
        role: "assistant",
        createdAt: new Date().toISOString(),
        chatId: currentChatId,
      };

      // Add both messages to current chat
      setCurrentChat((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...(prev.messages || []), userMessage, aiMessage],
        };
      });

      // Update chat list
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === currentChatId
            ? { ...chat, updatedAt: new Date().toISOString() }
            : chat
        )
      );

      // Track if callbacks were called to ensure state is properly reset
      let hasCompleted = false;
      let hasErrored = false;

      try {
        // 3. Stream AI response
        await sendMessageStream(
          currentChatId,
          content,
          {
            onContent: (chunk) => {
              // Update AI message content incrementally
              setCurrentChat((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  messages: prev.messages?.map((msg) =>
                    msg.id === aiMessageId
                      ? { ...msg, content: msg.content + chunk }
                      : msg
                  ),
                };
              });
            },
            onComplete: (messageId) => {
              // Message saved successfully - update temporary message ID to real ID
              hasCompleted = true;
              setIsStreaming(false);
              setCurrentChat((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  messages: prev.messages?.map((msg) =>
                    msg.id === aiMessageId
                      ? { ...msg, id: messageId } // Replace temp ID with real ID
                      : msg
                  ),
                };
              });
              // Refresh chat list to update title (but don't reload messages)
              loadChats();
            },
            onError: (errorMsg) => {
              hasErrored = true;
              setError(errorMsg);
              setIsStreaming(false);
              // Save failed message for retry
              setLastFailedMessage({ content, chatId: currentChatId });
              // Remove the empty AI placeholder on error
              setCurrentChat((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  messages: prev.messages?.filter(
                    (msg) => msg.id !== aiMessageId || msg.content !== ""
                  ),
                };
              });
            },
          },
          abortControllerRef.current.signal
        );

        // Safety check: if stream ended normally but no callback was called,
        // ensure streaming state is reset (shouldn't happen with proper backend, but handle gracefully)
        if (!hasCompleted && !hasErrored) {
          console.warn('Stream ended without complete or error callback');
          setIsStreaming(false);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to send message";
        setError(errorMsg);
        setIsStreaming(false);
        // Save failed message for retry
        setLastFailedMessage({ content, chatId: currentChatId });
      }
    },
    [currentChatId, loadChats]
  );

  // Retry last failed message
  const retryLastMessage = useCallback(async () => {
    if (!lastFailedMessage) return;
    setError(null);
    setLastFailedMessage(null);
    await sendMessage(lastFailedMessage.content);
  }, [lastFailedMessage, sendMessage]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Delete a chat
  const deleteChat = useCallback(
    async (chatId: string) => {
      setError(null);
      try {
        await apiDeleteChat(chatId);
        setChats((prev) => prev.filter((chat) => chat.id !== chatId));

        // If deleted chat was selected, clear selection
        if (currentChatId === chatId) {
          setCurrentChatId(null);
          setCurrentChat(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete chat");
        console.error("Failed to delete chat:", err);
      }
    },
    [currentChatId]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load chats on mount
  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <ChatContext.Provider
      value={{
        chats,
        currentChat,
        currentChatId,
        isLoadingChats,
        isLoadingMessages,
        isStreaming,
        error,
        lastFailedMessage,
        loadChats,
        selectChat,
        createChat,
        sendMessage,
        retryLastMessage,
        stopStreaming,
        deleteChat,
        clearError,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
