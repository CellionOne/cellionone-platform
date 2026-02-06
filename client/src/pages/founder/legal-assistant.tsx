import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Plus, Trash2, Bot, User, Sparkles, PanelLeftClose, PanelLeft } from "lucide-react";
import type { LegalChatConversation, LegalChatMessage } from "@shared/schema";

const STARTER_QUESTIONS = [
  "What are the steps to incorporate a company in Nigeria?",
  "What documents do I need for CAC registration?",
  "What's the difference between LTD and PLC?",
  "What are my post-incorporation obligations?",
  "How do annual returns work for Nigerian companies?",
  "What are the penalties for late annual returns?",
];

export default function LegalAssistant() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<LegalChatConversation[]>({
    queryKey: ["/api/legal-chat/conversations"],
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<LegalChatMessage[]>({
    queryKey: ["/api/legal-chat/conversations", selectedConversationId, "messages"],
    enabled: !!selectedConversationId,
  });

  const createConversation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/legal-chat/conversations");
      return res.json();
    },
    onSuccess: (data: LegalChatConversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/legal-chat/conversations"] });
      setSelectedConversationId(data.id);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const sendMessage = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: number; content: string }) => {
      const res = await apiRequest("POST", `/api/legal-chat/conversations/${conversationId}/messages`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/legal-chat/conversations", selectedConversationId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/legal-chat/conversations"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteConversation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/legal-chat/conversations/${id}`);
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/legal-chat/conversations"] });
      if (selectedConversationId === deletedId) {
        setSelectedConversationId(null);
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || sendMessage.isPending) return;

    let convId = selectedConversationId;
    if (!convId) {
      const newConv = await createConversation.mutateAsync();
      convId = newConv.id;
    }

    const content = inputValue.trim();
    setInputValue("");
    sendMessage.mutate({ conversationId: convId, content });
  };

  const handleStarterClick = async (question: string) => {
    setInputValue(question);
    let convId = selectedConversationId;
    if (!convId) {
      const newConv = await createConversation.mutateAsync();
      convId = newConv.id;
    }
    sendMessage.mutate({ conversationId: convId, content: question });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
  };

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "Legal AI Assistant" }]}>
      <div className="flex h-[calc(100vh-8rem)] gap-4">
        {showSidebar && (
          <Card className="w-72 shrink-0 flex flex-col overflow-hidden" data-testid="conversation-panel">
            <div className="p-3 border-b flex items-center justify-between gap-2">
              <h2 className="font-semibold text-sm">Conversations</h2>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    createConversation.mutate();
                  }}
                  disabled={createConversation.isPending}
                  data-testid="button-new-chat"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowSidebar(false)}
                  className="md:hidden"
                  data-testid="button-close-sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {conversationsLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
                ) : conversations.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No conversations yet
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`group flex items-center gap-2 rounded-md p-2 cursor-pointer hover-elevate ${
                        selectedConversationId === conv.id ? "bg-accent" : ""
                      }`}
                      onClick={() => setSelectedConversationId(conv.id)}
                      data-testid={`conversation-item-${conv.id}`}
                    >
                      <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{conv.title || "New Conversation"}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(conv.updatedAt)}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation.mutate(conv.id);
                        }}
                        data-testid={`button-delete-conversation-${conv.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          {!showSidebar && (
            <div className="mb-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowSidebar(true)}
                data-testid="button-open-sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Card className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold text-sm">Celion Legal AI</h2>
                <p className="text-xs text-muted-foreground">Nigerian Corporate Law Assistant</p>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-3xl mx-auto">
                {!selectedConversationId || (messages.length === 0 && !messagesLoading) ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-6">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-8 w-8 text-primary" />
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="text-lg font-semibold">Ask Celion Legal AI</h3>
                      <p className="text-sm text-muted-foreground max-w-md">
                        Get guidance on Nigerian company incorporation, CAC procedures, and compliance requirements.
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 w-full max-w-lg">
                      {STARTER_QUESTIONS.map((question) => (
                        <Button
                          key={question}
                          variant="outline"
                          className="text-left h-auto whitespace-normal text-sm justify-start"
                          onClick={() => handleStarterClick(question)}
                          disabled={sendMessage.isPending || createConversation.isPending}
                          data-testid={`starter-question-${question.substring(0, 20).replace(/\s+/g, "-").toLowerCase()}`}
                        >
                          {question}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messagesLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="text-sm text-muted-foreground">Loading messages...</div>
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                          data-testid={`message-${msg.id}`}
                        >
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className={msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}>
                              {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={`rounded-lg px-4 py-2.5 max-w-[80%] text-sm ${
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                          </div>
                        </div>
                      ))
                    )}
                    {sendMessage.isPending && (
                      <div className="flex gap-3" data-testid="ai-loading-indicator">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-muted">
                            <Bot className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="rounded-lg px-4 py-2.5 bg-muted">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="flex gap-1">
                              <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                              <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                              <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                            </div>
                            Thinking...
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
            </ScrollArea>

            <div className="p-3 border-t">
              <div className="flex gap-2 max-w-3xl mx-auto">
                <Textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about Nigerian corporate law..."
                  className="resize-none min-h-[44px] max-h-32"
                  rows={1}
                  disabled={sendMessage.isPending}
                  data-testid="input-message"
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || sendMessage.isPending}
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                AI assistant for informational purposes only. Consult a qualified lawyer for legal advice.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
