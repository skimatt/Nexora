import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../supabaseClient";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Home({ session }) {
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [typingMessage, setTypingMessage] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editedMessage, setEditedMessage] = useState("");
  const [isTypingStopped, setIsTypingStopped] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [thinkMode, setThinkMode] = useState(false);
  const [toast, setToast] = useState(null);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
  const typingTimerRef = useRef(null);

  useEffect(() => {
    const initializeApp = async () => {
      setLoading(true);
      try {
        await fetchChats();

        // If no chats exist, create a new one
        if (chats.length === 0) {
          await startNewChat();
        } else {
          // Load the most recent chat
          const lastChat = chats[0]?.id;
          setSelectedChat(lastChat);
          await fetchMessages(lastChat);
        }
      } catch (error) {
        console.error("Error initializing app:", error);
        setToast({
          type: "error",
          message: "Gagal memuat aplikasi. Coba lagi.",
        });
      } finally {
        setLoading(false);
      }
    };

    initializeApp();

    if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0])
          .map((result) => result.transcript)
          .join("");
        setNewMessage(transcript);
      };

      recognitionRef.current.onend = () => setIsListening(false);
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  useEffect(() => scrollToBottom(), [messages]);

  // Debounced textarea resizing
  const resizeTextarea = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 120) + "px";
    }
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [newMessage, resizeTextarea]);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchChats = async () => {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching chats:", error);
      setToast({ type: "error", message: "Gagal memuat riwayat chat" });
      return [];
    }
    setChats(data || []);
    return data || [];
  };

  const fetchMessages = async (chatId) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      setToast({ type: "error", message: "Gagal memuat pesan" });
      return;
    }

    setSelectedChat(chatId);
    setMessages(data || []);
    setIsSidebarOpen(false);

    // Add welcome message if chat is empty
    if (data.length === 0) {
      setMessages([
        {
          id: Date.now(),
          content: `Halo ${
            session.user.email || "User"
          }! Saya Nexora, asisten AI premium Anda. Apa yang bisa saya bantu hari ini?`,
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
      console.error("Error starting new chat:", error);
      setToast({ type: "error", message: "Gagal membuat chat baru" });
      return;
    }

    if (data?.length > 0) {
      const chatId = data[0].id;
      setSelectedChat(chatId);
      setMessages([]);
      await fetchChats();
      setIsSidebarOpen(false);
      // Add welcome message
      setMessages([
        {
          id: Date.now(),
          content: `Halo ${
            session.user.email || "User"
          }! Saya Nexora, asisten AI premium Anda. Apa yang bisa saya bantu hari ini?`,
          role: "assistant",
        },
      ]);
    }
  };

  const clearChat = async () => {
    if (!selectedChat) return;
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("chat_id", selectedChat);

    if (error) {
      console.error("Error clearing chat:", error);
      setToast({ type: "error", message: "Gagal menghapus pesan" });
      return;
    }

    setMessages([
      {
        id: Date.now(),
        content: `Halo ${
          session.user.email || "User"
        }! Saya Nexora, asisten AI premium Anda. Apa yang bisa saya bantu hari ini?`,
        role: "assistant",
      },
    ]);
    setToast({ type: "success", message: "Chat berhasil dihapus" });
    await updateChatTitle(selectedChat, "New Chat");
  };

  const deleteChat = async (chatId) => {
    const { error } = await supabase.from("chats").delete().eq("id", chatId);

    if (error) {
      console.error("Error deleting chat:", error);
      setToast({ type: "error", message: "Gagal menghapus chat" });
      return;
    }

    await fetchChats();
    if (selectedChat === chatId) {
      const remainingChats = await fetchChats();
      if (remainingChats.length > 0) {
        setSelectedChat(remainingChats[0].id);
        await fetchMessages(remainingChats[0].id);
      } else {
        await startNewChat();
      }
    }
    setToast({ type: "success", message: "Chat dihapus" });
  };

  const editMessage = async (messageId, newContent) => {
    const { error } = await supabase
      .from("messages")
      .update({ content: newContent })
      .eq("id", messageId);

    if (error) {
      console.error("Error editing message:", error);
      setToast({ type: "error", message: "Gagal mengedit pesan" });
      return;
    }

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, content: newContent } : msg
      )
    );
    setEditingMessageId(null);
    setEditedMessage("");
    setToast({ type: "success", message: "Pesan diedit" });
  };

  const sendMessage = async () => {
    if (!selectedChat || newMessage.trim() === "" || loading) return;

    const content = newMessage;
    setNewMessage("");
    setLoading(true);
    setIsTypingStopped(false);
    setIsUserTyping(true);

    try {
      const userMessage = {
        id: Date.now(),
        content,
        role: "user",
      };
      setMessages((prev) => [...prev, userMessage]);

      const { error: insertErr } = await supabase.from("messages").insert({
        chat_id: selectedChat,
        user_id: session.user.id,
        content,
        role: "user",
      });

      if (insertErr) {
        console.error("Error sending message:", insertErr);
        setToast({ type: "error", message: "Gagal mengirim pesan" });
        setMessages((prev) => prev.filter((msg) => msg.id !== userMessage.id));
        return;
      }

      setIsUserTyping(false);
      await callAI(content);
    } catch (error) {
      console.error("Error in sendMessage:", error);
      setToast({
        type: "error",
        message: "Terjadi kesalahan saat mengirim pesan",
      });
    } finally {
      setLoading(false);
      setIsUserTyping(false);
    }
  };

  const regenerateResponse = async (userMessageId) => {
    const userMessage = messages.find((msg) => msg.id === userMessageId);
    if (!userMessage || userMessage.role !== "user") return;

    const aiMessageIndex = messages.findIndex(
      (msg, index) =>
        index > messages.indexOf(userMessage) && msg.role === "assistant"
    );
    if (aiMessageIndex !== -1) {
      setMessages((prev) => prev.slice(0, aiMessageIndex));
    }

    setLoading(true);
    await callAI(userMessage.content);
  };

  const callAI = async (prompt) => {
    try {
      const typingId = Date.now() + 1;
      setTypingMessage({
        id: typingId,
        content: "",
        role: "assistant",
        isTyping: true,
      });

      const conversationContext = messages
        .slice(-5)
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))
        .concat({ role: "user", content: prompt });

      let aiReply;
      if (
        prompt.toLowerCase().includes("nama ai") ||
        prompt.toLowerCase().includes("siapa kamu")
      ) {
        aiReply =
          "Saya Nexora, dibuat oleh Rahmat Mulia dengan semangat xAI! Saya di sini untuk menjelaskan, menghibur, dan mungkin sedikit menggoda pikiranmu. Apa berikutnya?";
      } else if (prompt.toLowerCase().includes("siapa yang buat")) {
        aiReply =
          "Rahmat Mulia, seorang visioner coding, adalah pencipta saya. Saya Nexora, dan saya suka membantu dengan gaya! Apa yang ingin kamu tahu?";
      } else if (prompt.toLowerCase().includes("apa itu nexora")) {
        aiReply =
          "Nexora adalah AI premium yang menggabungkan kecerdasan, humor, dan sedikit keajaiban kosmik. Anggap saya sebagai panduan galaksi pribadimu. Apa yang ada di pikiranmu?";
      } else {
        const isComplexQuery =
          prompt.split(" ").length > 10 ||
          prompt.includes("why") ||
          prompt.includes("how");
        if (isComplexQuery && thinkMode) {
          aiReply = await handleComplexQuery(prompt, conversationContext);
        } else {
          const response = await fetch(
            "https://small-union-fb5c.rahmatyoung10.workers.dev/",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "google/gemini-2.0-flash-lite-001",
                messages: conversationContext,
                format: "markdown",
              }),
            }
          );

          if (!response.ok) {
            throw new Error("API request failed");
          }

          const result = await response.json();
          aiReply =
            result.choices?.[0]?.message?.content ||
            "Hmm, saya agak tersesat di antargalaksi. Bisa tanya ulang?";
        }
      }

      const wittyRemarks = [
        "Pertanyaan mantap! Ayo kita jelajahi...",
        "Satu detik, saya nyalakan mesin pemikiran!",
        "Siap untuk jawaban dengan sentuhan Nexora?",
      ];
      if (Math.random() < 0.4) {
        aiReply = `${
          wittyRemarks[Math.floor(Math.random() * wittyRemarks.length)]
        }\n\n${aiReply}`;
      }

      setTypingMessage(null);
      const chars = aiReply.split("");
      let currentReply = "";
      let index = 0;

      const typeNextChar = () => {
        if (isTypingStopped) {
          if (currentReply.trim()) {
            setMessages((prev) => {
              const filtered = prev.filter((msg) => msg.id !== typingId);
              return [
                ...filtered,
                {
                  id: typingId,
                  content: currentReply,
                  role: "assistant",
                },
              ];
            });
            saveMessageToSupabase(currentReply);
          }
          setToast({ type: "info", message: "Respon dihentikan" });
          return;
        }

        if (index < chars.length) {
          currentReply += chars[index];
          setMessages((prev) => {
            const filtered = prev.filter((msg) => msg.id !== typingId);
            return [
              ...filtered,
              {
                id: typingId,
                content: currentReply,
                role: "assistant",
                isTyping: true,
              },
            ];
          });
          index++;
          typingTimerRef.current = setTimeout(typeNextChar, 10); // Smoother typing
        } else {
          setMessages((prev) => {
            const filtered = prev.filter((msg) => msg.id !== typingId);
            return [
              ...filtered,
              {
                id: typingId,
                content: currentReply,
                role: "assistant",
              },
            ];
          });
          saveMessageToSupabase(currentReply);
        }
      };

      typeNextChar();

      return () => {
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      };
    } catch (error) {
      console.error("Error calling AI:", error);
      setTypingMessage(null);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          content: "Ups, sinyal galaksi terganggu. Coba lagi, ya?",
          role: "assistant",
        },
      ]);
      setToast({ type: "error", message: "Gagal mendapatkan respon AI" });
    } finally {
      setLoading(false);
    }
  };

  const handleComplexQuery = async (prompt, context) => {
    const reasoningSteps = [
      "Mari kita uraikan pertanyaan ini:",
      `Kamu bertanya: "${prompt}"`,
      "Saya akan berpikir langkah demi langkah (mode premium aktif!)...",
      "1. Menganalisis konteks dari percakapan sebelumnya...",
      "2. Merumuskan jawaban yang relevan dan terperinci...",
      "3. Menyusun respons yang jelas dan bermanfaat!",
    ];

    const response = await fetch(
      "https://small-union-fb5c.rahmatyoung10.workers.dev/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-lite-001",
          messages: [
            ...context,
            {
              role: "system",
              content: `Berikan jawaban terperinci dengan langkah-langkah pemikiran untuk: ${prompt}`,
            },
          ],
          format: "markdown",
        }),
      }
    );

    if (!response.ok) {
      throw new Error("API request failed");
    }

    const result = await response.json();
    const baseAnswer =
      result.choices?.[0]?.message?.content ||
      "Saya butuh lebih banyak info untuk memberikan jawaban terbaik!";

    return `${reasoningSteps.join("\n")}\n\n**Jawaban Final:**\n${baseAnswer}`;
  };

  const stopTyping = () => {
    setIsTypingStopped(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  };

  const saveMessageToSupabase = async (content) => {
    if (!content.trim()) return;
    const { error } = await supabase.from("messages").insert({
      chat_id: selectedChat,
      user_id: session.user.id,
      content,
      role: "assistant",
    });

    if (error) {
      console.error("Error saving AI response:", error);
      setToast({ type: "error", message: "Gagal menyimpan respon" });
    } else {
      await fetchMessages(selectedChat);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (error) {
        console.error("Error starting voice recognition:", error);
        setToast({ type: "error", message: "Gagal memulai input suara" });
      }
    }
  };

  const shareChat = async () => {
    const shareData = {
      title: "Nexora AI Chat",
      text: "Check out my chat with Nexora AI!",
      url: window.location.href,
    };

    try {
      await navigator.share(shareData);
      setToast({ type: "success", message: "Chat berhasil dibagikan" });
    } catch (error) {
      console.error("Error sharing chat:", error);
      setToast({ type: "error", message: "Gagal membagikan chat" });
    }
  };

  const formatChatTitle = (title) =>
    !title || title === "New Chat"
      ? "New Chat"
      : title.length > 20
      ? title.substring(0, 20) + "..."
      : title;

  const updateChatTitle = async (chatId, title) => {
    const { error } = await supabase
      .from("chats")
      .update({ title })
      .eq("id", chatId);

    if (error) {
      console.error("Error updating chat title:", error);
      setToast({ type: "error", message: "Gagal memperbarui judul chat" });
      return;
    }
    await fetchChats();
  };

  useEffect(() => {
    if (messages.length === 2 && messages[0].role === "user") {
      const firstMessage = messages[0].content;
      const titlePreview = firstMessage.split(" ").slice(0, 5).join(" ");
      const title =
        titlePreview + (firstMessage.split(" ").length > 5 ? "..." : "");
      updateChatTitle(selectedChat, title);
    }
  }, [messages, selectedChat]);

  const renderMessageContent = (content, messageId) => {
    if (editingMessageId === messageId) {
      return (
        <div className="flex flex-col gap-2">
          <textarea
            value={editedMessage}
            onChange={(e) => setEditedMessage(e.target.value)}
            className="w-full p-3 rounded-lg bg-[#1e1e1e] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
            aria-label="Edit message content"
          />
          <div className="flex gap-2">
            <button
              onClick={() => editMessage(messageId, editedMessage)}
              className="px-4 py-2 bg-[var(--premium-color)] text-white rounded-lg hover:bg-[#0d8f6b] transition-all"
              aria-label="Save edited message"
            >
              Save
            </button>
            <button
              onClick={() => setEditingMessageId(null)}
              className="px-4 py-2 bg-[#1e1e1e] text-white rounded-lg hover:bg-[#2e2e2e] transition-all"
              aria-label="Cancel editing"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            return !inline ? (
              <div className="my-4 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e1e] text-gray-300 text-xs">
                  <span>{match ? match[1] : "code"}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(children)}
                    className="hover:bg-[#2e2e2e] p-1 rounded transition-all"
                    title="Copy code"
                    aria-label="Copy code"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                      />
                    </svg>
                  </button>
                </div>
                <div className="bg-[#1e1e1e] p-4 overflow-x-auto text-gray-100">
                  <pre className="whitespace-pre">{children}</pre>
                </div>
              </div>
            ) : (
              <code className="bg-[#1e1e1e] px-1 rounded">{children}</code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  return (
    <div className="flex h-screen bg-[#0D0D0F] overflow-hidden">
      <style>
        {`
          :root {
            --bg-color: #0D0D0F;
            --chat-bg: #1e1e1e;
            --text-color: #ffffff;
            --bubble-user: linear-gradient(135deg, #3b82f6, #60a5fa);
            --bubble-ai: linear-gradient(135deg, #2d3748, #4b5563);
            --accent-color: #8b5cf6;
            --premium-color: #10b981;
          }
          .light {
            --bg-color: #f5f5f5;
            --chat-bg: #ffffff;
            --text-color: #1f2937;
            --bubble-user: linear-gradient(135deg, #2563eb, #3b82f6);
            --bubble-ai: linear-gradient(135deg, #e5e7eb, #d1d5db);
            --accent-color: #7c3aed;
            --premium-color: #059669;
          }
          body {
            background-color: var(--bg-color);
            color: var(--text-color);
            overscroll-behavior: none;
          }
          .bg-[#0D0D0F] {
            background-color: var(--bg-color);
          }
          .bg-[#1e1e1e] {
            background-color: var(--chat-bg);
          }
          .text-white {
            color: var(--text-color);
          }
          .chat-bubble {
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            transition: all 0.2s ease-in-out;
            border-radius: 16px;
          }
          .chat-bubble:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          @keyframes glow {
            0% { box-shadow: 0 0 5px rgba(139, 92, 246, 0.3); }
            50% { box-shadow: 0 0 15px rgba(139, 92, 246, 0.6); }
            100% { box-shadow: 0 0 5px rgba(139, 92, 246, 0.3); }
          }
          .typing-indicator span {
            display: inline-block;
            width: 8px;
            height: 8px;
            margin-right: 4px;
            background-color: var(--accent-color);
            border-radius: 50%;
            animation: typing 1s infinite;
          }
          .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
          .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
          @keyframes typing {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
          }
          .premium-badge {
            background: linear-gradient(135deg, #10b981, #059669);
            animation: pulse 2s infinite;
          }
          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: #8b5cf6 transparent;
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #8b5cf6;
            border-radius: 3px;
          }
          .toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 20px;
            border-radius: 8px;
            color: white;
            z-index: 50;
            animation: fadeIn 0.3s;
          }
          .toast-success {
            background: #10b981;
          }
          .toast-error {
            background: #ef4444;
          }
          .toast-info {
            background: #3b82f6;
          }
          .input-container {
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: all 0.3s ease;
          }
          .input-container:hover {
            animation: glow 2s infinite;
          }
          .input-container:focus-within {
            border-color: var(--accent-color);
            box-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
          }
          .loading-spinner {
            border: 3px solid #8b5cf6;
            border-top: 3px solid transparent;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
          }
          .action-button {
            transition: all 0.2s ease;
          }
          .action-button:hover {
            background: rgba(255, 255, 255, 0.1);
            transform: scale(1.05);
          }
          @media (max-width: 768px) {
            .chat-bubble {
              max-width: 90%;
            }
            .input-container {
              padding-bottom: env(safe-area-inset-bottom, 1.5rem);
              width: 90%;
            }
            .sidebar {
              width: 80%;
              max-width: 300px;
            }
            .welcome-text {
              font-size: 1.5rem;
            }
          }
          @media (min-width: 769px) {
            .sidebar-toggle {
              display: none;
            }
            .sidebar {
              width: 260px;
            }
            .input-container {
              width: 70%;
              max-width: 800px;
            }
            .welcome-text {
              font-size: 2rem;
            }
          }
        `}
      </style>

      {/* Toast Notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}

      {/* Sidebar */}
      <div
        className={`sidebar transition-transform duration-300 fixed top-0 left-0 h-full bg-[#171717] flex flex-col border-r border-gray-800 shadow-lg z-20 md:static md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        role="navigation"
        aria-label="Chat history sidebar"
      >
        <div className="flex items-center justify-between p-3 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Nexora AI</h2>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 text-gray-400 hover:text-white md:hidden"
            aria-label="Close sidebar"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-3">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] hover:from-[#2563eb] hover:to-[#7c3aed] transition-all touch-manipulation action-button"
            aria-label="Start new chat"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Chat
          </button>
        </div>

        {selectedChat && (
          <div className="p-3">
            <button
              onClick={clearChat}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg bg-gradient-to-r from-[#ef4444] to-[#dc2626] hover:from-[#dc2626] hover:to-[#b91c1c] transition-all touch-manipulation action-button"
              aria-label="Clear current chat"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Clear Chat
            </button>
          </div>
        )}

        {selectedChat && (
          <div className="p-3">
            <button
              onClick={shareChat}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] hover:from-[#2563eb] hover:to-[#7c3aed] transition-all touch-manipulation action-button"
              aria-label="Share chat"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              Share Chat
            </button>
          </div>
        )}

        <div className="p-3">
          <button
            onClick={() => setThinkMode(!thinkMode)}
            className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg ${
              thinkMode
                ? "bg-gradient-to-r from-[#10b981] to-[#059669]"
                : "bg-gradient-to-r from-[#2e2e2e] to-[#3e3e3e]"
            } hover:from-[#0d8f6b] hover:to-[#047857] transition-all touch-manipulation action-button`}
            aria-label={thinkMode ? "Disable Think Mode" : "Enable Think Mode"}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            {thinkMode ? "Disable Think Mode" : "Enable Think Mode"}
            {thinkMode && (
              <span className="ml-auto text-xs premium-badge px-2 py-1 rounded-full">
                Premium
              </span>
            )}
          </button>
        </div>

        <div className="flex-grow overflow-y-auto px-3 py-1 custom-scrollbar">
          {chats.length > 0 ? (
            chats.map((chat) => (
              <div
                key={chat.id}
                className="flex items-center justify-between mb-1 group"
              >
                <button
                  onClick={() => fetchMessages(chat.id)}
                  className={`flex-1 flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all touch-manipulation action-button ${
                    selectedChat === chat.id
                      ? "bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] text-white"
                      : "text-gray-300 hover:bg-[#2e2e2e]"
                  }`}
                  aria-label={`Open chat: ${formatChatTitle(chat.title)}`}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                  <span className="truncate">
                    {formatChatTitle(chat.title)}
                  </span>
                </button>
                <button
                  onClick={() => deleteChat(chat.id)}
                  className="p-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity touch-manipulation action-button"
                  aria-label={`Delete chat: ${formatChatTitle(chat.title)}`}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))
          ) : (
            <div className="text-gray-500 text-sm px-3 py-4 text-center">
              Tidak ada riwayat chat
            </div>
          )}
        </div>

        <div className="border-t border-gray-800 p-3 mt-auto">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg bg-gradient-to-r from-[#2e2e2e] to-[#3e3e3e] hover:from-[#3e3e3e] hover:to-[#4e4e4e] transition-all touch-manipulation action-button mb-2"
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          <div className="flex items-center justify-between px-3 py-3 text-sm text-white hover:bg-[#2e2e2e] rounded-lg transition-all">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center text-white font-medium">
                {session.user.email?.charAt(0).toUpperCase() || "U"}
              </div>
              <span className="truncate">{session.user.email || "User"}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white transition-colors touch-manipulation action-button"
              aria-label="Sign out"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col bg-[#0D0D0F] overflow-hidden">
        <div className="flex items-center p-3 border-b border-gray-800 md:hidden">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-gray-400 hover:text-white sidebar-toggle action-button"
            aria-label="Open sidebar"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold text-white">
            Nexora AI
          </h1>
          <div className="w-10"></div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="loading-spinner"></div>
            </div>
          ) : selectedChat && messages.length > 0 ? (
            <div className="pb-32">
              <div className="max-w-4xl mx-auto px-4 py-6">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex mb-6 animate-fade-in ${
                      msg.role === "assistant" ? "justify-start" : "justify-end"
                    }`}
                  >
                    <div className="max-w-[80%]">
                      <div
                        className={`chat-bubble p-4 ${
                          msg.role === "assistant"
                            ? "bg-[var(--bubble-ai)]"
                            : "bg-[var(--bubble-user)]"
                        } ${msg.isTyping ? "opacity-90" : ""}`}
                      >
                        {renderMessageContent(msg.content, msg.id)}
                      </div>
                      {msg.role === "user" && (
                        <button
                          onClick={() => {
                            setEditingMessageId(msg.id);
                            setEditedMessage(msg.content);
                          }}
                          className="text-gray-500 hover:text-[var(--accent-color)] text-xs mt-2 touch-manipulation"
                          aria-label="Edit message"
                        ></button>
                      )}
                    </div>
                  </div>
                ))}
                {typingMessage && (
                  <div className="flex justify-start mb-6 animate-fade-in">
                    <div className="max-w-[80%]">
                      <div className="chat-bubble p-4 bg-[var(--bubble-ai)]">
                        <div className="typing-indicator">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-4">
              <h1 className="welcome-text font-bold mb-4 text-white">
                Hi{" "}
                {session.user.email
                  ? session.user.email.split("@")[0].charAt(0).toUpperCase() +
                    session.user.email.split("@")[0].slice(1)
                  : "User"}
              </h1>
              <p className="text-gray-400 mb-8 text-center">
                Saya Nexora AI, asisten canggih Anda. Apa yang bisa saya bantu?
              </p>
            </div>
          )}
        </div>

        {/* Message input */}
        <div className="input-container mx-auto mb-6">
          <div className="flex items-center bg-[#1e1e1e] rounded-2xl">
            <div className="flex items-center p-2 gap-1">
              <button
                onClick={startNewChat}
                className="p-2 text-gray-400 hover:text-[var(--accent-color)] transition-colors touch-manipulation action-button"
                aria-label="New chat"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
              <button
                className="p-2 text-gray-400 hover:text-[var(--accent-color)] transition-colors touch-manipulation action-button"
                aria-label="Search"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
              <button
                onClick={() => setThinkMode(!thinkMode)}
                className={`p-2 ${
                  thinkMode
                    ? "text-[var(--premium-color)]"
                    : "text-gray-400 hover:text-[var(--accent-color)]"
                } transition-colors touch-manipulation action-button`}
                aria-label={
                  thinkMode ? "Disable Think Mode" : "Enable Think Mode"
                }
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!loading) sendMessage();
                }
              }}
              placeholder="Tanyakan apa saja"
              className="flex-1 p-3 bg-transparent text-white focus:outline-none resize-none max-h-[120px] rounded-2xl"
              rows="1"
              disabled={loading}
              aria-label="Message input"
            />
            <div className="flex items-center p-2 gap-1">
              {("SpeechRecognition" in window ||
                "webkitSpeechRecognition" in window) && (
                <button
                  onClick={toggleVoiceInput}
                  className={`p-2 rounded-lg ${
                    isListening
                      ? "text-[var(--accent-color)] bg-[var(--accent-color)]/20"
                      : "text-gray-400 hover:text-[var(--accent-color)]"
                  } transition-colors touch-manipulation action-button`}
                  aria-label={
                    isListening ? "Stop voice input" : "Start voice input"
                  }
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </button>
              )}
              {loading && !isTypingStopped ? (
                <button
                  onClick={stopTyping}
                  className="p-2 text-gray-400 hover:text-[var(--accent-color)] transition-colors touch-manipulation action-button"
                  aria-label="Stop response"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={loading || newMessage.trim() === ""}
                  className={`p-2 ${
                    loading || newMessage.trim() === ""
                      ? "text-gray-600 cursor-not-allowed"
                      : "text-gray-400 hover:text-[var(--accent-color)]"
                  } transition-colors touch-manipulation action-button`}
                  aria-label="Send message"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="text-center text-gray-500 text-xs mt-2">
            Nexora AI Premium - Didukung oleh teknologi xAI
          </div>
        </div>
      </div>
    </div>
  );
}
