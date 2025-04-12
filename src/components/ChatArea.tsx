// src/components/ChatArea.tsx
import { Session } from "@supabase/supabase-js";
import { Message } from "./Home";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatAreaProps {
  messages: Message[];
  session: Session;
  isLoading: boolean;
  onOpenSidebar: () => void;
}

export default function ChatArea({
  messages,
  session,
  isLoading,
  onOpenSidebar,
}: ChatAreaProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-gray-900 p-4">
      <div className="md:hidden flex items-center p-4">
        <button
          onClick={onOpenSidebar}
          className="text-gray-400 hover:text-white"
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
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin border-4 border-t-transparent border-blue-500 rounded-full w-8 h-8"></div>
        </div>
      ) : messages.length > 0 ? (
        <div className="max-w-4xl mx-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex mb-4 ${
                msg.role === "assistant" ? "justify-start" : "justify-end"
              }`}
            >
              <div
                className={`p-4 rounded-lg max-w-[80%] ${
                  msg.role === "assistant"
                    ? "bg-gray-700"
                    : "bg-blue-600 text-white"
                }`}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-full flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold text-white">
            Hi {session.user.email?.split("@")[0] || "User"}
          </h1>
          <p className="text-gray-400">Ask me anything!</p>
        </div>
      )}
    </div>
  );
}
