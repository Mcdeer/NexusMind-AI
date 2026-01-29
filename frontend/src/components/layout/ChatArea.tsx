"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatInput } from "./ChatInput";
import { useChatContext } from "@/contexts/ChatContext";
import { Message } from "@/lib/api-client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  MoreHorizontal,
  Share2,
  Pencil,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Sparkles,
  Loader2,
  Square,
  AlertCircle,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatAreaProps {
  className?: string;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export function ChatArea({
  className,
  onMenuClick,
  showMenuButton = false,
}: ChatAreaProps) {
  const {
    currentChat,
    currentChatId,
    isLoadingMessages,
    isStreaming,
    error,
    lastFailedMessage,
    sendMessage,
    retryLastMessage,
    stopStreaming,
    createChat,
    clearError,
  } = useChatContext();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const messages = currentChat?.messages || [];
  const title = currentChat?.title || "NexusMind AI";

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async (content: string) => {
    // If no chat selected, create one first
    if (!currentChatId) {
      const newChat = await createChat();
      if (!newChat) return;
    }

    await sendMessage(content);
  };

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          {showMenuButton && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={onMenuClick}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold truncate max-w-[200px] md:max-w-none">
              {title}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon">
                <Share2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>分享对话</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Pencil className="mr-2 h-4 w-4" />
                重命名
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Share2 className="mr-2 h-4 w-4" />
                导出对话
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollAreaRef}>
        <div className="mx-auto max-w-3xl px-4 py-6">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-6">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isStreaming={
                    isStreaming &&
                    message.role === "assistant" &&
                    message.id.startsWith("temp_")
                  }
                />
              ))}
              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Error Alert */}
      {error && (
        <div className="mx-auto max-w-3xl px-4 py-2">
          <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <div className="flex-1">{error}</div>
            {lastFailedMessage && (
              <Button
                variant="outline"
                size="sm"
                onClick={retryLastMessage}
                className="h-7 gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/20"
              >
                <RefreshCw className="h-3 w-3" />
                重试
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={clearError}
              className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/20"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Stop Button */}
      {isStreaming && (
        <div className="flex justify-center py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={stopStreaming}
            className="gap-2"
          >
            <Square className="h-3 w-3 fill-current" />
            停止生成
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-3xl p-4">
          <ChatInput onSend={handleSend} isLoading={isStreaming} />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  const { createChat } = useChatContext();

  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-full bg-primary/10 p-4">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <h2 className="mb-2 text-xl font-semibold">开始新对话</h2>
      <p className="max-w-sm text-muted-foreground mb-4">
        向 NexusMind AI 提问任何问题，获取智能解答、代码帮助或创意灵感。
      </p>
      <Button onClick={() => createChat()}>
        <Sparkles className="mr-2 h-4 w-4" />
        开始对话
      </Button>
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isEmpty = !message.content;
  
  // 更精确的错误判断：只检查明确的错误标识，避免误判正常内容
  // 错误消息通常以特定格式开头，或者包含明确的错误提示
  const isError = !isUser && message.content && (
    // 明确的错误格式
    message.content.startsWith("[Error:") ||
    message.content.startsWith("Error:") ||
    // AI 服务错误提示（通常出现在错误消息的开头）
    (message.content.startsWith("AI 服务") && (
      message.content.includes("暂时不可用") ||
      message.content.includes("认证失败") ||
      message.content.includes("访问被拒绝") ||
      message.content.includes("内部错误")
    )) ||
    // 数据库错误
    message.content.includes("Failed to save message to database") ||
    message.content.includes("数据库错误")
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
  };

  return (
    <div
      className={cn(
        "group flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        {isUser ? (
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            U
          </AvatarFallback>
        ) : (
          <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs">
            AI
          </AvatarFallback>
        )}
      </Avatar>
      <div
        className={cn(
          "flex flex-col gap-1 max-w-[85%] min-w-0",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : isError
              ? "bg-destructive/10 border border-destructive/30 rounded-tl-sm"
              : "bg-muted rounded-tl-sm"
          )}
        >
          {isEmpty && isStreaming ? (
            // Loading indicator for empty streaming message
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" />
            </div>
          ) : (
            <div
              className={cn(
                "[overflow-wrap:break-word] [word-break:break-word]",
                isError && "text-destructive font-medium"
              )}
            >
              {isError && (
                <div className="mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-semibold">错误</span>
                </div>
              )}
              {!isUser && !isError ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                    // 自定义代码块样式
                    code: ({ node, inline, className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <div className="relative my-2">
                          <pre className="overflow-x-auto rounded-lg bg-muted p-4">
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        </div>
                      ) : (
                        <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono" {...props}>
                          {children}
                        </code>
                      );
                    },
                    // 自定义段落样式
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    // 自定义标题样式
                    h1: ({ children }) => <h1 className="mb-2 mt-4 text-lg font-bold first:mt-0">{children}</h1>,
                    h2: ({ children }) => <h2 className="mb-2 mt-3 text-base font-bold first:mt-0">{children}</h2>,
                    h3: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h3>,
                    // 自定义列表样式
                    ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                    // 自定义引用样式
                    blockquote: ({ children }) => (
                      <blockquote className="my-2 border-l-4 border-muted-foreground/30 pl-4 italic">
                        {children}
                      </blockquote>
                    ),
                    // 自定义链接样式
                    a: ({ children, href }) => (
                      <a href={href} className="text-primary underline hover:text-primary/80" target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    ),
                    // 自定义表格样式
                    table: ({ children }) => (
                      <div className="my-2 overflow-x-auto">
                        <table className="min-w-full border-collapse border border-border">
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="border border-border bg-muted px-3 py-2 text-left font-semibold">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border border-border px-3 py-2">
                        {children}
                      </td>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{message.content}</div>
              )}
              {/* Streaming cursor */}
              {isStreaming && !isError && (
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-current animate-pulse rounded-sm" />
              )}
            </div>
          )}
        </div>
        {/* Message Actions - only show for completed AI messages */}
        {!isUser && !isStreaming && message.content && (
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleCopy}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>复制</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>重新生成</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>有帮助</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ThumbsDown className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>没帮助</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}
