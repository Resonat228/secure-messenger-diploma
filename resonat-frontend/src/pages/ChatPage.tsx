import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "../store/authStore";

import { listDialogs, createDialog } from "../api/dialogs";
import { listMessages } from "../api/messages";
import { searchUsers, getMe, setMyPublicKey  } from "../api/users";

import type { Dialog } from "../api/dialogs";
import type { Message } from "../api/messages";
import type { UserShort } from "../api/users";
import { deriveSharedKey, encryptMessage, decryptMessage, getOrCreateUserKeyPair, keyToBase64 } from "../crypto/e2ee";

import { uploadFile } from "../api/files";
import type { UploadedFile } from "../api/files";

const WS_BASE = "ws://127.0.0.1:8000/ws/dialog";

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, token, clearAuth } = useAuthStore();

  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [activeDialogId, setActiveDialogId] = useState<Dialog["id"] | null>(
    null
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingDialogs, setLoadingDialogs] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [mySecretKeyB64, setMySecretKeyB64] = useState<string | null>(null);
  const sharedKeysRef = useRef<Record<string, string>>({});
  const [myPublicKeyB64, setMyPublicKeyB64] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setPendingFile(f);
    e.target.value = "";
  };
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<UserShort[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [userSearchError, setUserSearchError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);


    async function getSharedKeyForDialog(dialog: Dialog): Promise<string | null> {
      if (!mySecretKeyB64) return null;
      if (!dialog.other_user_public_key) return null;

      const cached = sharedKeysRef.current[dialog.id];
      if (cached) return cached;

      const shared = await deriveSharedKey(
        mySecretKeyB64,
        dialog.other_user_public_key
      );

      sharedKeysRef.current[dialog.id] = shared;
      return shared;
    }



  useEffect(() => {
    if (!token) return;

    const loadMe = async () => {
      try {
        const me = await getMe();
        setCurrentUserId(String(me.id));
      } catch (e) {
        console.error("Не удалось получить /users/me", e);
      }
    };

    loadMe();
  }, [token]);

useEffect(() => {
  if (!token) return;

  async function initKeys() {
    try {

      let storedSecret = localStorage.getItem("resonat_secret_key");
      let storedPublic = localStorage.getItem("resonat_public_key");


      if (!storedSecret || !storedPublic) {
        const { pk, sk } = await getOrCreateUserKeyPair();
        const pkB64 = keyToBase64(pk);
        const skB64 = keyToBase64(sk);

        storedPublic = pkB64;
        storedSecret = skB64;

        localStorage.setItem("resonat_public_key", storedPublic);
        localStorage.setItem("resonat_secret_key", storedSecret);
      }

      setMySecretKeyB64(storedSecret);
      setMyPublicKeyB64(storedPublic);

      try {
        await setMyPublicKey(storedPublic);
      } catch (e) {
        console.error("Не удалось отправить публичный ключ", e);
      }
    } catch (e) {
      console.error("Ошибка при инициализации ключей E2E", e);
    }
  }

  initKeys();
}, [token]);



  useEffect(() => {
    if (!token) {
      setDialogs([]);
      setActiveDialogId(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoadingDialogs(true);
        const data = await listDialogs();
        if (!cancelled) {
          setDialogs(data);
        }
      } catch (err) {
        console.error("Ошибка загрузки диалогов", err);
      } finally {
        if (!cancelled) {
          setLoadingDialogs(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  
  useEffect(() => {
    if (activeDialogId === null && dialogs.length > 0) {
      setActiveDialogId(dialogs[0].id);
    }
  }, [dialogs, activeDialogId]);

useEffect(() => {
  if (!token || activeDialogId == null) {
    setMessages([]);
    return;
  }

  if (!mySecretKeyB64) {
    return;
  }

  let cancelled = false;

  const loadMessagesForDialog = async () => {
    try {
      setLoadingMessages(true);

      const data = await listMessages(String(activeDialogId));

      const dialog = dialogs.find((d) => d.id === activeDialogId);
      if (!dialog) {
        return;
      }

      const sharedKey = await getSharedKeyForDialog(dialog);
      if (!sharedKey) {
        console.error("Нет общего ключа — не можем расшифровать историю");
      }

      const normalized: Message[] = await Promise.all(
        data.map(async (m) => {
          let plaintext = m.ciphertext;

          if (sharedKey && m.ciphertext && m.nonce) {
            const plain = await decryptMessage(
              sharedKey,
              m.ciphertext,
              m.nonce
            );
            if (plain !== null) {
              plaintext = plain;
            }
          }

          return {
            ...m,
            text: plaintext,
            is_own: String(m.sender_id) === String(currentUserId),
          };
        })
      );

      if (!cancelled) {
        setMessages(normalized);
      }
    } catch (err) {
      console.error("Ошибка загрузки сообщений", err);
    } finally {
      if (!cancelled) {
        setLoadingMessages(false);
      }
    }
  };

  loadMessagesForDialog();

  return () => {
    cancelled = true;
  };
}, [activeDialogId, token, currentUserId, dialogs, mySecretKeyB64]);



  // WebSocket
useEffect(() => {
  if (!token || activeDialogId == null) return;

  const url = `${WS_BASE}/${encodeURIComponent(
    String(activeDialogId)
  )}?token=${encodeURIComponent(token)}`;

  const ws = new WebSocket(url);
  wsRef.current = ws;

  ws.onmessage = async (event) => {
    try {
      const raw = JSON.parse(event.data) as Message;

      const dialog = dialogs.find((d) => d.id === activeDialogId);
      let text = raw.ciphertext;
      const sharedKey =
        dialog && (await getSharedKeyForDialog(dialog));

      if (sharedKey && raw.ciphertext && raw.nonce) {
        const plain = await decryptMessage(sharedKey, raw.ciphertext, raw.nonce);
        if (plain !== null) text = plain;
      }

      const msg: Message = {
        ...raw,
        is_own: raw.sender_id === String(currentUserId),
        text,
      };

      setMessages((prev) => [...prev, msg]);
    } catch (e) {
      console.error("Ошибка обработки WS-сообщения", e);
    }
  };


  ws.onerror = (e) => {
    console.error("WebSocket error", e);
  };

  ws.onclose = () => {
    wsRef.current = null;
  };

  return () => {
    ws.close();
  };
}, [token, activeDialogId, user?.id]);



  const handleLogout = () => {
    clearAuth();
    navigate("/");
  };

const handleSend = async () => {
  if (!wsRef.current || activeDialogId == null || !activeDialog) return;

  if (pendingFile) {
    try {
      setUploadingFile(true);

      const uploaded: UploadedFile = await uploadFile(String(activeDialogId), pendingFile);


      wsRef.current.send(
        JSON.stringify({
          ciphertext: "",     
          nonce: "",          
          has_links: false,
          has_files: true,
          file: {
            id: uploaded.id,
            url: uploaded.url,
            filename: uploaded.filename,
            mime: uploaded.mime,
            size: uploaded.size,
          },
        })
      );

      setPendingFile(null);
      return;
    } catch (err) {
      console.error("Ошибка загрузки файла", err);
      return;
    } finally {
      setUploadingFile(false);
    }
  }

  const text = draft.trim();
  if (!text) return;

  const sharedKey = await getSharedKeyForDialog(activeDialog);
  if (!sharedKey) {
    console.error("Нет общего ключа для диалога, не можем зашифровать");
    return;
  }

  const { ciphertext, nonce } = await encryptMessage(sharedKey, text);

  wsRef.current.send(
    JSON.stringify({
      ciphertext,
      nonce,
      has_links: false,
      has_files: false,
    })
  );

  setDraft("");
};




  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeDialog = dialogs.find((d) => d.id === activeDialogId) ?? null;

  // ------- ПОИСК ПОЛЬЗОВАТЕЛЕЙ --------

  useEffect(() => {
    const q = userQuery.trim();

    if (q.length < 2) {
      setUserResults([]);
      setUserSearchError(null);
      return;
    }

    let cancelled = false;
    setUserSearchLoading(true);
    setUserSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await searchUsers(q);
        if (!cancelled) {
          setUserResults(res);
        }
      } catch (err) {
        console.error("Ошибка поиска пользователей", err);
        if (!cancelled) {
          setUserSearchError("Не удалось выполнить поиск");
        }
      } finally {
        if (!cancelled) {
          setUserSearchLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userQuery]);

  useEffect(() => {
  const el = messagesContainerRef.current;
  if (!el) return;

  el.scrollTop = el.scrollHeight;
}, [messages.length]);

  const handleStartDialog = async (otherUser: UserShort) => {
    try {
      setUserSearchLoading(true);
      setUserSearchError(null);

      const newDialog = await createDialog(otherUser.id);

      setDialogs((prev) => {
        const exists = prev.find((d) => d.id === newDialog.id);
        if (exists) return prev;
        return [newDialog, ...prev];
      });

      setActiveDialogId(newDialog.id);
      setUserQuery("");
      setUserResults([]);
    } catch (err) {
      console.error("Ошибка создания диалога", err);
      setUserSearchError("Не удалось создать диалог");
    } finally {
      setUserSearchLoading(false);
    }
  };

  // ------------------------------------

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* HEADER */}
      <header className="border-b border-slate-800/60 bg-slate-950/70 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-baseline gap-2">
            <span className="text-cyan-400 font-semibold tracking-[0.25em] text-xs uppercase">
              Resonat
            </span>
            <span className="text-slate-400 text-xs">
              защищённый мессенджер
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/40">
              <div className="h-6 w-6 rounded-full bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-[11px] text-cyan-200">
                {(user?.email?.[0] ?? "U").toUpperCase()}
              </div>
              <div className="leading-tight">
                <div className="text-[10px] text-slate-400">Вы вошли как</div>
                <div className="text-xs text-slate-200 max-w-[220px] truncate">
                  {user?.email ?? "secure@user"}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-700/80 hover:border-slate-500 hover:bg-slate-900/80 transition-colors"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto py-6 px-4 flex gap-6 h-[calc(100vh-5rem)]">
          {/* SIDEBAR: диалоги */}
          <aside className="w-80 bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-col">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-slate-100">Диалоги</h2>
              <p className="text-xs text-slate-400 mt-1">
                Выбери диалог слева, чтобы начать переписку.
              </p>
            </div>

            {/* ПОИСК ПОЛЬЗОВАТЕЛЕЙ ДЛЯ НОВОГО ДИАЛОГА */}
            <div className="mb-2">
              <div className="text-[11px] text-slate-400 mb-1">
                Новый диалог
              </div>
              <input
                type="text"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Найти пользователя по email"
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-cyan-500/60 focus:border-cyan-400/70 placeholder:text-slate-500"
              />
              {userQuery.trim().length > 0 && (
                <div className="mt-1 max-h-40 overflow-y-auto space-y-1">
                  {userSearchLoading && (
                    <div className="text-[11px] text-slate-400">
                      Ищем пользователей...
                    </div>
                  )}

                  {!userSearchLoading && userSearchError && (
                    <div className="text-[11px] text-rose-400">
                      {userSearchError}
                    </div>
                  )}

                  {!userSearchLoading &&
                    !userSearchError &&
                    userQuery.trim().length >= 2 &&
                    userResults.length === 0 && (
                      <div className="text-[11px] text-slate-500">
                        Никого не нашли.
                      </div>
                    )}

                  {!userSearchLoading &&
                    !userSearchError &&
                    userResults.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => handleStartDialog(u)}
                        className="w-full text-left px-3 py-1.5 rounded-xl text-[11px] bg-slate-950/40 border border-slate-800/70 hover:border-cyan-500/70 hover:bg-slate-900/80 transition-colors"
                      >
                        <div className="text-slate-100 truncate">
                          {u.email}
                        </div>
                        <div className="text-[10px] text-cyan-400">
                          начать диалог
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* список диалогов */}
            <div className="flex-1 overflow-y-auto space-y-1 mt-1">
              {loadingDialogs && (
                <div className="text-xs text-slate-400 px-1 py-2">
                  Загружаем диалоги...
                </div>
              )}

              {!loadingDialogs && dialogs.length === 0 && (
                <div className="text-xs text-slate-400 px-1 py-2">
                  Диалогов пока нет. Пора с кем-нибудь поссориться.
                </div>
              )}

              {!loadingDialogs &&
                dialogs.length > 0 &&
                dialogs.map((d) => {
                  const isActive = d.id === activeDialogId;
                  const shortId = String(d.id).slice(0, 8);

                  return (
                    <button
                      key={d.id}
                      onClick={() => setActiveDialogId(d.id)}
                      className={[
                        "w-full text-left px-3 py-2 rounded-xl text-[11px] border mb-1",
                        "transition-colors",
                        isActive
                          ? "bg-cyan-500/20 border-cyan-400 text-cyan-50"
                          : "bg-slate-950/40 border-slate-700 text-slate-100 hover:border-cyan-400/60",
                      ].join(" ")}
                    >
                    <div className="font-semibold">
                      {d.other_user_email ?? `Диалог ${shortId}`}
                    </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        создан: {new Date(d.created_at).toLocaleString()}
                      </div>
                    </button>
                  );
                })}
            </div>
          </aside>

          {/* CHAT */}
          <section className="flex-1 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col">
            {/* Заголовок */}
            <div className="px-5 py-3 border-b border-slate-800/80 flex items-center justify-between">
              {activeDialog ? (
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    {activeDialog.other_user_email}
                  </div>
                  <div className="text-xs text-slate-400">
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    Диалог не выбран
                  </div>
                  <div className="text-xs text-slate-400">
                    Выбери диалог слева, чтобы начать переписку.
                  </div>
                </div>
              )}
            </div>

            {/* Сообщения */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto px-5 py-4 space-y-3 custom-scroll"
            >
              {loadingMessages && (
                <div className="text-xs text-slate-400">
                  Загружаем сообщения...
                </div>
              )}

              {!loadingMessages &&
                messages.length === 0 &&
                activeDialog && (
                  <div className="text-xs text-slate-400">
                    Сообщений пока нет. Самое время написать что-нибудь компрометирующее.
                  </div>
                )}
                {messages.map((m) => {
                  const isOwn = String(m.sender_id) === String(currentUserId);
                  const text = (m as any).text ?? m.ciphertext;
                  const fileMeta = (m as any).file as
                    | { url: string; filename: string; size?: number }
                    | undefined;

                  return (
                    <div key={m.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`min-w-0 max-w-[70%] rounded-2xl px-3 py-2 text-sm leading-snug ${
                          isOwn
                            ? "bg-cyan-500 text-slate-950 rounded-br-sm"
                            : "bg-slate-800 text-slate-100 rounded-bl-sm"
                        }`}
                      >
                        {fileMeta ? (
                          <a
                            href={fileMeta.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block underline underline-offset-2 break-words"
                          >
                            📎 {fileMeta.filename}
                          </a>
                        ) : (
                          <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                            {text}
                          </div>
                        )}

                        <div
                          className={`mt-1 text-[10px] text-right ${
                            isOwn ? "text-cyan-900/85" : "text-slate-300"
                          }`}
                        >
                          {new Date(m.created_at).toLocaleTimeString("ru-RU", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
            {/* Ввод */}
            <div className="border-t border-slate-800/80 px-5 py-3">
              <div className="relative flex gap-3 items-end">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelected}
                />

                <button
                  type="button"
                  onClick={handlePickFile}
                  disabled={!activeDialog || uploadingFile}
                  className="h-[42px] px-3 rounded-xl border border-slate-800 bg-slate-950/70 text-slate-200
                            hover:border-cyan-400/70 hover:bg-slate-900/60 transition-colors
                            disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Прикрепить файл"
                >
                  📎
                </button>
                {pendingFile && (
                  <div className="absolute bottom-[52px] left-0 text-[11px] text-slate-300 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1 max-w-[60%] truncate">
                    Файл: {pendingFile.name}
                    <button
                      className="ml-2 text-slate-400 hover:text-slate-200"
                      onClick={() => setPendingFile(null)}
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <textarea
                  className="flex-1 resize-none rounded-xl bg-slate-950/70 border border-slate-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-cyan-500/70 focus:border-cyan-400/80 placeholder:text-slate-500 max-h-32 min-h-[42px]"
                  placeholder={
                    activeDialog
                      ? "Написать сообщение..."
                      : "Сначала выбери диалог слева"
                  }
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={!activeDialog}
                />
                <button
                  onClick={handleSend}
                  disabled={!activeDialog || (!draft.trim() && !pendingFile) || uploadingFile}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-cyan-500 text-slate-950 disabled:bg-slate-700 disabled:text-slate-300 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(34,211,238,0.35)] hover:bg-cyan-400 transition-colors"
                >
                  Отправить
                </button>
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                Enter – отправить, Shift+Enter – новая строка.
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
