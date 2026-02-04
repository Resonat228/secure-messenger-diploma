import { useEffect, useRef } from "react";
import type { Message as ApiMessage } from "../../api/messages";

type Message = ApiMessage & Record<string, any>;

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  currentUserEmail?: string | null;
}

export default function MessageList({
  messages,
  loading,
  currentUserEmail,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Загружаем сообщения...
      </div>
    );
  }

  if (!messages.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500 text-center px-6">
        Сообщений пока нет. Самое время написать что-нибудь компрометирующее.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto space-y-3 pr-2">
      {messages.map((m) => {
        const isMe =
          currentUserEmail &&
          (m.sender_email === currentUserEmail ||
            m.sender?.email === currentUserEmail);

        const text =
          m.text || m.ciphertext || m.content || "[пустое сообщение]";

        const timestamp =
          (m.created_at &&
            new Date(m.created_at).toLocaleTimeString("ru-RU", {
              hour: "2-digit",
              minute: "2-digit",
            })) ||
          "";

        return (
          <div
            key={String(m.id)}
            className={`flex ${isMe ? "justify-end" : "justify-start"}`}
          >
            <div
              className={[
                "max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-md",
                isMe
                  ? "bg-cyan-500/80 text-slate-900"
                  : "bg-slate-800/80 text-slate-50 border border-slate-700/70",
              ].join(" ")}
            >
              {!isMe && (
                <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">
                  {m.sender_email || m.sender?.email || "Аноним"}
                </div>
              )}
              <div className="whitespace-pre-wrap break-words">{text}</div>
              {timestamp && (
                <div
                  className={[
                    "mt-1 text-[10px] text-right",
                    isMe ? "text-slate-900/70" : "text-slate-400",
                  ].join(" ")}
                >
                  {timestamp}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
