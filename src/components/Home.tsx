// src/components/Home.tsx
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { Session } from "@supabase/supabase-js";
import Sidebar from "./Sidebar";
import ChatArea from "./ChatArea";
import MessageInput from "./MessageInput";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import sanitizeHtml from "sanitize-html";

// Define types
interface Message {
  id: number;
  content: string;
  role: "user" | "assistant";
  chat_id?: number;
  isTyping?: boolean;
}

interface Chat {
  id: number;
  title: string;
  user_id: string;
  created_at: string;
}

interface HomeProps {
  session: Session;
}

/**
 * Main chat application component
 */
export default function Home({ session }: HomeProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedChat, setSelectedChat] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [thinkMode, setThinkMode] = useState(false);

  // Fetch chats on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const data = await fetchChats();
        if (data.length === 0) {
          await startNewChat();
        } else {
          const lastChatId = data[0].id;
          setSelectedChat(lastChatId);
          await fetchMessages(lastChatId);
        }
      } catch (error) {
        console.error("Error initializing app:", error);
        toast.error("Failed to load application.");
      }
    };

    initializeApp();
  }, []);

  // Theme toggle
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  const fetchChats = async (): Promise<Chat[]> => {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load chat history.");
      return [];
    }
    setChats(data || []);
    return data || [];
  };

  const fetchMessages = async (chatId: number) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Failed to load messages.");
      return;
    }

    setSelectedChat(chatId);
    setMessages(data || []);
    setIsSidebarOpen(false);

    if (data.length === 0) {
      setMessages([
        {
          id: Date.now(),
          content: `Hello ${
            session.user.email || "User"
          }! I'm Nexora, your premium AI assistant. How can I help you today?`,
          role: "assistant",
        },
      ]);
    }
  };

  const startNewChat = async () => {
    const { data, error } = await supabase
      .from("chats")
      .insert({ user_id: session.user.id, title: "New Chat" })
      .select();

    if (error) {
      toast.error("Failed to create new chat.");
      return;
    }

    if (data?.length > 0) {
      const chatId = data[0].id;
      setSelectedChat(chatId);
      setMessages([]);
      await fetchChats();
      setMessages([
        {
          id: Date.now(),
          content: `Hello ${
            session.user.email || "User"
          }! I'm Nexora, your premium AI assistant. How can I help you today?`,
          role: "assistant",
        },
      ]);
    }
  };

  const sendMessage = useCallback(
    async (content: string) => {
      if (!selectedChat || !content.trim()) return;

      const sanitizedContent = sanitizeHtml(content, {
        allowedTags: [],
        allowedAttributes: {},
      });

      const userMessage: Message = {
        id: Date.now(),
        content: sanitizedContent,
        role: "user",
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        await supabase.from("messages").insert({
          chat_id: selectedChat,
          user_id: session.user.id,
          content: sanitizedContent,
          role: "user",
        });

        // Call Grok 3 API
        const aiResponse = await callGrok3(sanitizedContent, thinkMode);
        const aiMessage: Message = {
          id: Date.now() + 1,
          content: aiResponse,
          role: "assistant",
        };
        setMessages((prev) => [...prev, aiMessage]);
        await supabase.from("messages").insert({
          chat_id: selectedChat,
          user_id: session.user.id,
          content: aiResponse,
          role: "assistant",
        });
      } catch (error) {
        toast.error("Failed to send message.");
        setMessages((prev) => prev.filter((msg) => msg.id !== userMessage.id));
      }
    },
    [selectedChat, thinkMode]
  );

  /**
   * Call Grok 3 API (placeholder)
   */
  const callGrok3 = async (
    prompt: string,
    useThinkMode: boolean
  ): Promise<string> => {
    try {
      const response = await fetch("https://api.x.ai/grok3", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.REACT_APP_XAI_API_KEY}`,
        },
        body: JSON.stringify({
          prompt,
          thinkMode: useThinkMode,
          model: "grok-3",
        }),
      });

      if (!response.ok) throw new Error("Grok 3 API request failed");
      const data = await response.json();
      return data.response || "Sorry, I couldn't process that. Try again?";
    } catch (error) {
      console.error("Grok 3 API error:", error);
      throw error;
    }
  };

  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        chats={chats}
        selectedChat={selectedChat}
        onSelectChat={fetchMessages}
        onNewChat={startNewChat}
        onThemeToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
        session={session}
        theme={theme}
      />
      <div className="flex-1 flex flex-col">
        <ChatArea
          messages={messages}
          session={session}
          isLoading={false}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />
        <MessageInput
          onSend={sendMessage}
          thinkMode={thinkMode}
          onToggleThinkMode={() => setThinkMode(!thinkMode)}
          disabled={false}
        />
      </div>
      <ToastContainer position="bottom-right" autoClose={3000} />
    </div>
  );
}
