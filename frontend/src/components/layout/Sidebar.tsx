"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  MessageSquare,
  BookOpen,
  Settings,
  LogOut,
  ChevronDown,
  Trash2,
  MoreHorizontal,
} from "lucide-react";

interface Conversation {
  id: string;
  title: string;
  updatedAt: Date;
  isActive?: boolean;
}

// Mock data for demonstration
const mockConversations: Conversation[] = [
  { id: "1", title: "React 性能优化讨论", updatedAt: new Date(), isActive: true },
  { id: "2", title: "TypeScript 最佳实践", updatedAt: new Date(Date.now() - 86400000) },
  { id: "3", title: "AI 模型架构设计", updatedAt: new Date(Date.now() - 172800000) },
  { id: "4", title: "数据库查询优化", updatedAt: new Date(Date.now() - 259200000) },
  { id: "5", title: "微服务架构方案", updatedAt: new Date(Date.now() - 345600000) },
];

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

export function Sidebar({ className, onClose }: SidebarProps) {
  const [conversations] = useState<Conversation[]>(mockConversations);

  const handleNewChat = () => {
    // TODO: Implement new chat creation
    console.log("Creating new chat...");
    onClose?.();
  };

  const handleSelectConversation = (id: string) => {
    // TODO: Implement conversation selection
    console.log("Selecting conversation:", id);
    onClose?.();
  };

  return (
    <div
      className={cn(
        "flex h-full w-[280px] flex-col bg-sidebar text-sidebar-foreground",
        className
      )}
    >
      {/* New Chat Button */}
      <div className="p-3">
        <Button
          onClick={handleNewChat}
          className="w-full justify-start gap-2 bg-primary hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          新对话
        </Button>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Conversations List */}
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-1 py-2">
          <p className="px-3 py-2 text-xs font-medium text-muted-foreground">
            历史对话
          </p>
          {conversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              onSelect={() => handleSelectConversation(conversation.id)}
            />
          ))}
        </div>
      </ScrollArea>

      <Separator className="bg-sidebar-border" />

      {/* Navigation Items */}
      <div className="p-2">
        <NavItem
          icon={<BookOpen className="h-4 w-4" />}
          label="知识库管理"
          onClick={() => console.log("Navigate to knowledge base")}
        />
        <NavItem
          icon={<Settings className="h-4 w-4" />}
          label="设置"
          onClick={() => console.log("Navigate to settings")}
        />
      </div>

      <Separator className="bg-sidebar-border" />

      {/* User Profile */}
      <UserProfile />
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  onSelect: () => void;
}

function ConversationItem({ conversation, onSelect }: ConversationItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent cursor-pointer",
        conversation.isActive && "bg-sidebar-accent"
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 truncate">
        <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{conversation.title}</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            删除对话
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function NavItem({ icon, label, onClick }: NavItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={onClick}
        >
          {icon}
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function UserProfile() {
  return (
    <div className="p-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 px-2 hover:bg-sidebar-accent"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src="/avatar.png" alt="User" />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                U
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 items-center justify-between">
              <div className="text-left">
                <p className="text-sm font-medium">用户名</p>
                <p className="text-xs text-muted-foreground">免费版</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            账户设置
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
