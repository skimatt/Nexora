// src/components/MessageInput.tsx
import { useState, useRef, useEffect } from "react";

interface MessageInputProps {
  onSend: (content: string) => void;
  thinkMode: boolean;
  onToggleThinkMode: () => void;
  disabled: boolean;
}

export default function MessageInput({
  onSend,
  thinkMode,
  onToggleThinkMode,
  disabled,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        120
      )}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message);
      setMessage("");
    }
  };

  return (
    <div className="p-4 bg-gray-900 border-t border-gray-800">
      <div className="flex items-center max-w-4xl mx-auto bg-gray-800 rounded-xl p-2">
        <button
          onClick={onToggleThinkMode}
          className={`p-2 ${
            thinkMode ? "text-green-500" : "text-gray-400"
          } hover:text-green-600`}
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
        </button>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type your message..."
          className="flex-1 bg-transparent text-white p-2 resize-none focus:outline-none"
          rows={1}
          disabled={disabled}
          aria-label="Message input"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          className={`p-2 ${
            disabled || !message.trim()
              ? "text-gray-600"
              : "text-blue-500 hover:text-blue-600"
          }`}
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
      </div>
    </div>
  );
}
