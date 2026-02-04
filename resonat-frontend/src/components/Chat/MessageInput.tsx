import { useState } from "react";

interface MessageInputProps {
  onSend: (text: string) => void | Promise<void>;
  disabled?: boolean;
}

export default function MessageInput({
  onSend,
  disabled,
}: MessageInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    await onSend(text);
    setValue("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-3 rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2"
    >
      <textarea
        className="flex-1 resize-none bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500 max-h-24 min-h-[40px] py-1"
        placeholder="Написать сообщение..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSubmit(e);
          }
        }}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="inline-flex min-w-[90px] items-center justify-center rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Отправить
      </button>
    </form>
  );
}
