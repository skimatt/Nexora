// File: services/chatService.js
import { supabase } from "../supabaseClient";

export const fetchChats = async (userId) => {
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};

export const createNewChat = async (userId) => {
  const { data, error } = await supabase
    .from("chats")
    .insert({ user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const fetchMessages = async (chatId) => {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
};

export const sendUserMessage = async ({ chatId, userId, content }) => {
  const { data, error } = await supabase
    .from("messages")
    .insert({ chat_id: chatId, user_id: userId, content, role: "user" })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const sendAIReply = async ({ chatId, userId, content }) => {
  const { data, error } = await supabase
    .from("messages")
    .insert({ chat_id: chatId, user_id: userId, content, role: "assistant" });
  if (error) throw error;
  return data;
};
export const deleteChat = async (chatId) => {
  const { error } = await supabase.from("chats").delete().eq("id", chatId);
  if (error) throw error;
};
