// src/components/Sidebar.tsx
import { Session } from "@supabase/supabase-js";
import { Chat } from "./Home";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  chats: Chat[];
  selectedChat: number | null;
  onSelectChat: (chatId: number) => void;
  onNewChat: () => void;
  onThemeToggle: () => void;
  session: Session;
  theme: "dark" | "light";
}

export default function Sidebar({
  isOpen,
  onClose,
  chats,
  selectedChat,
  onSelectChat,
  onNewChat,
  onThemeToggle,
  session,
  theme,
}: SidebarProps) {
  return (
    <div
      className={`fixed inset-y-0 left-0 w-64 bg-gray-800 transform ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0 transition-transform duration-300 z-20`}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">Nexora AI</h2>
        <button
          onClick={onClose}
          className="md:hidden text-gray-400 hover:text-white"
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
      <div className="p-4">
        <button
          onClick={onNewChat}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2 rounded-lg hover:from-blue-600 hover:to-purple-700"
          aria-label="New chat"
        >
          New Chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {chats.map((chat) => (
          <button
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className={`w-full text-left p-2 rounded-lg ${
              selectedChat === chat.id
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-gray-700"
            }`}
            aria-label={`Open chat: ${chat.title}`}
          >
            {chat.title}
          </button>
        ))}
      </div>
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={onThemeToggle}
          className="w-full bg-gray-700 text-white py-2 rounded-lg hover:bg-gray-600"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
        <div className="mt-2 text-gray-300">{session.user.email}</div>
      </div>
    </div>
  );
}
