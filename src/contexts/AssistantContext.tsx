import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  audioUrl?: string;
  actions?: Record<string, any>;
}

export interface GenerationSpec {
  mode: "rapido" | "orientado" | "sprint";
  output: "text" | "image" | "both";
  pieceType: string;
  quantity: number;
  profile: "economy" | "standard" | "quality" | "unrestricted";
  destination: string;
  ratio: string;
  intensity: string;
  provider: string;
  useModel: boolean;
  useVisualProfile: boolean;
}

export interface SelectedAsset {
  id: string;
  title: string;
  type: string;
  status: string;
  profile?: string;
  provider?: string;
}

type DockTab = "chat" | "context" | "actions";
type AgentMode = "global" | "project";

interface AssistantContextValue {
  // Derived
  activeProjectId: string | null;
  isInProject: boolean;
  agentMode: AgentMode;

  // UI state
  dockOpen: boolean;
  dockWidth: number;
  activeTab: DockTab;
  dockFocused: boolean;
  openDock: () => void;
  closeDock: () => void;
  toggleDock: () => void;
  setDockWidth: (w: number) => void;
  setActiveTab: (tab: DockTab) => void;
  setDockFocused: (f: boolean) => void;

  // Chat
  thread: ChatMessage[];
  sendMessage: (text: string, userOnly?: boolean, isSystem?: boolean, isStreamUpdate?: boolean) => void;
  clearThread: () => void;
  isLoadingHistory: boolean;

  // DB persistence
  activeThreadId: string | null;
  persistMessage: (msg: ChatMessage) => Promise<void>;

  // Spec
  spec: GenerationSpec;
  setSpec: (partial: Partial<GenerationSpec>) => void;

  // Asset selection
  selectedAsset: SelectedAsset | null;
  selectAsset: (asset: SelectedAsset | null) => void;

  // Voice
  isRecording: boolean;
  isTranscribing: boolean;
  startRecording: () => void;
  stopRecording: () => Promise<string | null>;

  // Actions
  approveAsset: (assetId: string) => void;
  promoteAsset: (assetId: string) => void;
  archiveAsset: (assetId: string) => void;
  regenerateAsset: (assetId: string) => void;
  regenerateWithQuality: (assetId: string) => void;
}

const DEFAULT_SPEC: GenerationSpec = {
  mode: "rapido",
  output: "both",
  pieceType: "post",
  quantity: 3,
  profile: "standard",
  destination: "Feed",
  ratio: "1:1",
  intensity: "Equilibrado",
  provider: "Auto",
  useModel: false,
  useVisualProfile: false,
};

// ── Context ─────────────────────────────────────────────────────
const AssistantCtx = createContext<AssistantContextValue | null>(null);

export function useAssistant() {
  const ctx = useContext(AssistantCtx);
  if (!ctx) throw new Error("useAssistant must be used within AssistantProvider");
  return ctx;
}

// ── Provider ────────────────────────────────────────────────────
export function AssistantProvider({ children }: { children: ReactNode }) {
  const location = useLocation();

  // Derive projectId from route
  const match = location.pathname.match(/^\/project\/([^/]+)/);
  const activeProjectId = match ? match[1] : null;
  const isInProject = !!activeProjectId;
  const agentMode: AgentMode = isInProject ? "project" : "global";

  // UI state
  const [dockOpen, setDockOpen] = useState(false);
  const [dockWidth, setDockWidthState] = useState(400);
  const [activeTab, setActiveTabState] = useState<DockTab>("chat");
  const [dockFocused, setDockFocused] = useState(true);

  // Chat state
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Spec & asset
  const [spec, setSpecState] = useState<GenerationSpec>({ ...DEFAULT_SPEC });
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(null);

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Dock starts closed by default — user opens it manually
  // No auto-open behavior

  // ── DB: Load or create thread when context changes ──
  useEffect(() => {
    let cancelled = false;

    async function loadThread() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      setIsLoadingHistory(true);

      // Find existing thread
      let query = supabase
        .from("chat_threads")
        .select("id")
        .eq("user_id", user.id)
        .order("last_active", { ascending: false })
        .limit(1);

      if (activeProjectId) {
        query = query.eq("project_id", activeProjectId);
      } else {
        query = query.is("project_id", null);
      }

      const { data: threads } = await query;

      if (cancelled) return;

      if (threads && threads.length > 0) {
        const tid = threads[0].id;
        setActiveThreadId(tid);

        // Load messages
        const { data: msgs } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("thread_id", tid)
          .order("created_at", { ascending: true })
          .limit(100);

        if (!cancelled && msgs) {
          setThread(msgs.map((m: any) => ({
            id: m.id,
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
            timestamp: new Date(m.created_at).getTime(),
            audioUrl: m.audio_url,
            actions: m.actions,
          })));
        }
      } else {
        // Create new thread
        const { data: newThread } = await supabase
          .from("chat_threads")
          .insert({
            user_id: user.id,
            project_id: activeProjectId,
            title: activeProjectId ? "Projeto" : "Global",
          })
          .select("id")
          .single();

        if (!cancelled && newThread) {
          setActiveThreadId(newThread.id);
          setThread([]);
        }
      }
      setIsLoadingHistory(false);
    }

    loadThread();
    return () => { cancelled = true; };
  }, [activeProjectId]);

  // ── Persist message to DB ──
  const persistMessage = useCallback(async (msg: ChatMessage) => {
    if (!activeThreadId) return;
    try {
      await supabase.from("chat_messages").insert({
        thread_id: activeThreadId,
        role: msg.role,
        content: msg.content,
        audio_url: msg.audioUrl || null,
        actions: msg.actions || {},
      });
    } catch {
      // non-blocking persistence
    }
  }, [activeThreadId]);

  // ── API ────────────────────
  const openDock = useCallback(() => setDockOpen(true), []);
  const closeDock = useCallback(() => setDockOpen(false), []);
  const toggleDock = useCallback(() => setDockOpen(p => !p), []);
  const setDockWidth = useCallback((w: number) => setDockWidthState(w), []);
  const setActiveTab = useCallback((tab: DockTab) => setActiveTabState(tab), []);

  const sendMessage = useCallback(
    (text: string, userOnly?: boolean, isSystem?: boolean, isStreamUpdate?: boolean) => {
      if (isStreamUpdate) {
        setThread(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            const newThread = [...prev];
            newThread[newThread.length - 1] = { ...last, content: text };
            return newThread;
          }
          return [...prev, { id: crypto.randomUUID(), role: "assistant", content: text, timestamp: Date.now() }];
        });
        return;
      }

      const role: "user" | "assistant" | "system" = isSystem ? "system" : "user";
      const msg: ChatMessage = { id: crypto.randomUUID(), role, content: text, timestamp: Date.now() };

      setThread(prev => [...prev, msg]);
      setActiveTabState("chat");

      // Persist asynchronously
      if (activeThreadId) {
        persistMessage(msg);
      }
    },
    [activeThreadId, persistMessage]
  );

  const clearThread = useCallback(() => setThread([]), []);

  const setSpec = useCallback(
    (partial: Partial<GenerationSpec>) =>
      setSpecState(prev => ({ ...prev, ...partial })),
    []
  );

  const selectAsset = useCallback(
    (asset: SelectedAsset | null) => {
      setSelectedAsset(asset);
      if (asset) {
        setDockOpen(true);
        setActiveTabState("context");
      }
    },
    []
  );

  // ── Voice Recording ──
  const startRecording = useCallback(() => {
    audioChunksRef.current = [];
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start(100); // collect in 100ms chunks
      setIsRecording(true);
    }).catch(() => {
      console.error("Microphone access denied");
    });
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        setIsRecording(false);
        resolve(null);
        return;
      }

      recorder.onstop = async () => {
        setIsRecording(false);
        setIsTranscribing(true);

        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        // Stop all tracks
        recorder.stream.getTracks().forEach(t => t.stop());

        try {
          // Convert to base64
          const reader = new FileReader();
          const base64Promise = new Promise<string>((res) => {
            reader.onloadend = () => res(reader.result as string);
            reader.readAsDataURL(blob);
          });
          const base64 = await base64Promise;

          // Send to transcription edge function
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

          const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cos-transcribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ audio: base64 }),
          });

          if (resp.ok) {
            const data = await resp.json();
            setIsTranscribing(false);
            resolve(data.text || null);
          } else {
            setIsTranscribing(false);
            resolve(null);
          }
        } catch {
          setIsTranscribing(false);
          resolve(null);
        }
      };

      recorder.stop();
    });
  }, []);

  // Mock action contracts
  const mockAction = (action: string, id: string) => {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "system",
      content: `✅ Ação **${action}** executada no ativo \`${id.slice(0, 8)}…\``,
      timestamp: Date.now(),
    };
    setThread(prev => [...prev, msg]);
    persistMessage(msg);
  };

  const value: AssistantContextValue = {
    activeProjectId,
    isInProject,
    agentMode,
    dockOpen,
    dockWidth,
    activeTab,
    dockFocused,
    openDock,
    closeDock,
    toggleDock,
    setDockWidth,
    setActiveTab,
    setDockFocused,
    thread,
    sendMessage,
    clearThread,
    isLoadingHistory,
    activeThreadId,
    persistMessage,
    spec,
    setSpec,
    selectedAsset,
    selectAsset,
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    approveAsset: (id) => mockAction("Aprovar", id),
    promoteAsset: (id) => mockAction("Promover a Oficial", id),
    archiveAsset: (id) => mockAction("Arquivar", id),
    regenerateAsset: (id) => mockAction("Regerar", id),
    regenerateWithQuality: (id) => mockAction("Regerar com Qualidade", id),
  };

  return <AssistantCtx.Provider value={value}>{children}</AssistantCtx.Provider>;
}
