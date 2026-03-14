import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router";
import { nanoid } from "nanoid";

import { names, type ChatMessage, type Message } from "../shared";
import { MessageContent } from "./MessageContent";

const STORAGE_KEY = "chat-username";
const MESSAGES_STORAGE_KEY_PREFIX = "chat-messages-";
const THEME_STORAGE_KEY = "chat-theme";

type Theme = "light" | "dark";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  // 默认跟随系统偏好
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function setStoredTheme(theme: Theme) {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  // 更新 meta theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", theme === "dark" ? "#0F172A" : "#F8FAFC");
  }
}

function getStoredName(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  const randomName = names[Math.floor(Math.random() * names.length)];
  localStorage.setItem(STORAGE_KEY, randomName);
  return randomName;
}

function getStoredMessages(roomId: string): ChatMessage[] {
  try {
    const stored = localStorage.getItem(MESSAGES_STORAGE_KEY_PREFIX + roomId);
    if (stored) {
      return JSON.parse(stored) as ChatMessage[];
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

function saveMessages(roomId: string, messages: ChatMessage[]) {
  try {
    localStorage.setItem(MESSAGES_STORAGE_KEY_PREFIX + roomId, JSON.stringify(messages));
  } catch {
    // ignore storage errors (e.g., quota exceeded)
  }
}

// 获取用户名首字母
function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

// 确认弹窗组件
function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "确认",
  cancelText = "取消",
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Enter") {
        onConfirm();
      }
    },
    [onConfirm, onCancel]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <div className="modal-content">
          <h3 className="modal-title">{title}</h3>
          <p className="modal-message">{message}</p>
        </div>
        <div className="modal-actions">
          <button type="button" className="modal-btn cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button type="button" className="modal-btn confirm" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [name, setName] = useState<string>("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
  const { room } = useParams();

  // 初始化时从 localStorage 加载缓存消息
  const [messages, setMessages] = useState<ChatMessage[]>(() => getStoredMessages(room || ""));
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // 消息变化时滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    setName(getStoredName());
  }, []);

  // 应用主题
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // 切换主题
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const newTheme = prev === "light" ? "dark" : "light";
      setStoredTheme(newTheme);
      return newTheme;
    });
  }, []);

  // 当消息变化时保存到 localStorage
  useEffect(() => {
    if (messages.length > 0) {
      saveMessages(room || "", messages);
    } else {
      localStorage.removeItem(MESSAGES_STORAGE_KEY_PREFIX + room);
    }
  }, [messages, room]);

  const socket = usePartySocket({
    party: "chat",
    room,
    onOpen: () => {
      setIsConnected(true);
    },
    onClose: () => {
      setIsConnected(false);
    },
    onMessage: (evt) => {
      const message = JSON.parse(evt.data as string) as Message;
      if (message.type === "add") {
        const foundIndex = messages.findIndex((m) => m.id === message.id);
        if (foundIndex === -1) {
          // probably someone else who added a message
          setMessages((messages) => [
            ...messages,
            {
              id: message.id,
              content: message.content,
              user: message.user,
              role: message.role,
            },
          ]);
        } else {
          // this usually means we ourselves added a message
          // and it was broadcasted back
          // so let's replace the message with the new message
          setMessages((messages) => {
            return messages
              .slice(0, foundIndex)
              .concat({
                id: message.id,
                content: message.content,
                user: message.user,
                role: message.role,
              })
              .concat(messages.slice(foundIndex + 1));
          });
        }
      } else if (message.type === "update") {
        setMessages((messages) =>
          messages.map((m) =>
            m.id === message.id
              ? {
                  id: message.id,
                  content: message.content,
                  user: message.user,
                  role: message.role,
                }
              : m,
          ),
        );
      } else if (message.type === "delete") {
        setMessages((messages) => messages.filter((m) => m.id !== message.id));
      } else if (message.type === "clear") {
        setMessages([]);
      } else {
        setMessages(message.messages);
      }
    },
  });

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed) {
      setName(trimmed);
      localStorage.setItem(STORAGE_KEY, trimmed);
    }
    setIsEditingName(false);
  };

  const handleCancelEdit = () => {
    setNameInput(name);
    setIsEditingName(false);
  };

  return (
    <div className="chat">
      {/* Header bar - 极简模式 */}
      <div className="header-bar">
        <div className="user-info">
          <div className="user-avatar" onClick={toggleTheme} title={theme === "light" ? "切换到深色模式" : "切换到浅色模式"}>
            {getInitials(name)}
          </div>
          {isEditingName ? (
            <div className="name-edit-container">
              <input
                type="text"
                className="name-edit-input"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSaveName();
                  } else if (e.key === "Escape") {
                    handleCancelEdit();
                  }
                }}
                autoFocus
                maxLength={20}
              />
              <button
                type="button"
                className="name-edit-btn save"
                onClick={handleSaveName}
                title="保存"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </button>
              <button
                type="button"
                className="name-edit-btn cancel"
                onClick={handleCancelEdit}
                title="取消"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="user-name-display"
              onClick={() => {
                setNameInput(name);
                setIsEditingName(true);
              }}
            >
              <span>{name}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          )}
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="header-btn danger"
            onClick={() => setShowClearConfirm(true)}
            title="清空聊天记录"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="messages-empty">
            <div className="messages-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <h3>开始聊天吧</h3>
            <p>发送一条消息，开启实时对话</p>
          </div>
        ) : (
          messages.map((message) => {
            const isMyMessage = message.user === name;
            return (
              <div
                key={message.id}
                className={`message ${isMyMessage ? "my-message" : "other-message"}`}
              >
                <div className="message-header">
                  <span className="message-user">{message.user}</span>
                  <div className="message-actions">
                    <button
                      type="button"
                      className={`message-action-btn ${copiedId === message.id ? "copied" : ""}`}
                      onClick={() => {
                        navigator.clipboard.writeText(message.content);
                        setCopiedId(message.id);
                        setTimeout(() => setCopiedId(null), 1500);
                      }}
                      title="复制消息"
                    >
                      {copiedId === message.id ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      className="message-action-btn delete"
                      onClick={() => {
                        socket.send(JSON.stringify({ type: "delete", id: message.id } as Message));
                        setMessages((msgs) => msgs.filter((m) => m.id !== message.id));
                      }}
                      title="删除消息"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="message-content">
                  <MessageContent content={message.content} />
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message form */}
      <form
        className="message-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name) return;
          const content = e.currentTarget.elements.namedItem(
            "content",
          ) as HTMLTextAreaElement;
          const text = content.value.trim();
          if (!text) return;
          const chatMessage: ChatMessage = {
            id: nanoid(8),
            content: text,
            user: name,
            role: "user",
          };
          setMessages((messages) => [...messages, chatMessage]);

          socket.send(
            JSON.stringify({
              type: "add",
              ...chatMessage,
            } satisfies Message),
          );

          content.value = "";
          // 重置高度
          content.style.height = "auto";
        }}
      >
        <div className="input-wrapper">
          <textarea
            name="content"
            className="message-input"
            placeholder="输入消息... (Shift+Enter 换行)"
            autoComplete="off"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            onInput={(e) => {
              // 自动调整高度
              const textarea = e.currentTarget;
              textarea.style.height = "auto";
              textarea.style.height = Math.min(textarea.scrollHeight, 150) + "px";
            }}
          />
        </div>
        <button type="submit" className="send-button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>

      <ConfirmModal
        isOpen={showClearConfirm}
        title="清空聊天记录"
        message="确定要清空当前聊天室的所有消息吗？此操作无法撤销。"
        confirmText="清空"
        cancelText="取消"
        onConfirm={() => {
          socket.send(JSON.stringify({ type: "clear" } as Message));
          setMessages([]);
          localStorage.removeItem(MESSAGES_STORAGE_KEY_PREFIX + room);
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to={`/${nanoid()}`} />} />
      <Route path="/:room" element={<App />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </BrowserRouter>,
);