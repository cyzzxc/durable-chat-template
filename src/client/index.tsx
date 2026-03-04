import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router";
import { nanoid } from "nanoid";

import { names, type ChatMessage, type Message } from "../shared";

const STORAGE_KEY = "chat-username";

// URL正则表达式
const URL_REGEX = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;

// 解析文本中的URL并转换为链接
function parseLinks(text: string): React.ReactNode {
  const parts = text.split(URL_REGEX);
  const matches = text.match(URL_REGEX) || [];

  return parts.map((part, index) => {
    if (matches[index - 1]) {
      return (
        <a
          key={index}
          href={matches[index - 1]}
          target="_blank"
          rel="noopener noreferrer"
        >
          {matches[index - 1]}
        </a>
      );
    }
    return part;
  });
}

function getStoredName(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  const randomName = names[Math.floor(Math.random() * names.length)];
  localStorage.setItem(STORAGE_KEY, randomName);
  return randomName;
}

function App() {
  const [name, setName] = useState<string>("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { room } = useParams();

  useEffect(() => {
    setName(getStoredName());
  }, []);

  const socket = usePartySocket({
    party: "chat",
    room,
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
      {/* Header bar */}
      <div className="header-bar">
        <div className="room-info">
          <span className="room-label">聊天室</span>
          <span className="room-id" title={room}>{room}</span>
        </div>
        <div className="user-info">
          <span className="user-label">当前用户</span>
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </button>
              <button
                type="button"
                className="name-edit-btn cancel"
                onClick={handleCancelEdit}
                title="取消"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
              {name}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {messages.map((message) => {
          const isMyMessage = message.user === name;
          return (
            <div
              key={message.id}
              className={`message ${isMyMessage ? "my-message" : "other-message"}`}
            >
              <span className="message-user">{message.user}</span>
              <div className="message-content">{parseLinks(message.content)}</div>
            </div>
          );
        })}
      </div>

      {/* Message form */}
      <form
        className="message-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name) return;
          const content = e.currentTarget.elements.namedItem(
            "content",
          ) as HTMLInputElement;
          const chatMessage: ChatMessage = {
            id: nanoid(8),
            content: content.value,
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
        }}
      >
        <div className="input-wrapper">
          <input
            type="text"
            name="content"
            className="message-input"
            placeholder="输入消息..."
            autoComplete="off"
          />
        </div>
        <button type="submit" className="send-button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
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
