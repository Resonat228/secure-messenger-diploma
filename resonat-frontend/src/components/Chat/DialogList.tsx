import type { Dialog as ApiDialog } from "../../api/dialogs";

type Dialog = ApiDialog & Record<string, any>;

interface DialogListProps {
  dialogs: Dialog[];
  activeDialogId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
}

export default function DialogList({
  dialogs,
  activeDialogId,
  loading,
  onSelect,
}: DialogListProps) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Загружаем диалоги...
      </div>
    );
  }

  if (!dialogs.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500 text-center px-4">
        Диалогов пока нет. Пора с кем-нибудь поссориться.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {dialogs.map((d) => (
        <button
          key={String(d.id)}
          onClick={() => onSelect(String(d.id))}
          className={[
            "w-full rounded-2xl px-4 py-3 text-left text-sm transition-all",
            "bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/70",
            activeDialogId === String(d.id)
              ? "ring-2 ring-cyan-400/70 bg-slate-800"
              : "",
          ].join(" ")}
        >
          <div className="font-medium text-slate-100 truncate">
            {d.title || d.name || "Диалог"}
          </div>
          {d.last_message_preview && (
            <div className="mt-0.5 text-xs text-slate-400 truncate">
              {d.last_message_preview}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
