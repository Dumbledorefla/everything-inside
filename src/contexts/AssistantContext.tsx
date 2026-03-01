import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

// ── Types ──────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface GenerationSpec {
  mode: "rapido" | "orientado" | "sprint";
  output: "text" | "image" | "both";
  pieceType: string;
  quantity: number;
  profile: "economy" | "standard" | "quality";
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

interface ProjectAssistantState {
  thread: ChatMessage[];
  spec: GenerationSpec;
  selectedAsset: SelectedAsset | null;
  dockOpen: boolean;
  dockWidth: number;
  activeTab: "chat" | "context" | "actions";
}

interface AssistantContextValue {
  // Derived
  activeProjectId: string | null;
  isInProject: boolean;

  // UI state
  dockOpen: boolean;
  dockWidth: number;
  activeTab: "chat" | "context" | "actions";
  openDock: () => void;
  closeDock: () => void;
  toggleDock: () => void;
  setDockWidth: (w: number) => void;
  setActiveTab: (tab: "chat" | "context" | "actions") => void;

  // Chat
  thread: ChatMessage[];
  sendMessage: (text: string) => void;

  // Spec
  spec: GenerationSpec;
  setSpec: (partial: Partial<GenerationSpec>) => void;

  // Asset selection
  selectedAsset: SelectedAsset | null;
  selectAsset: (asset: SelectedAsset | null) => void;

  // Actions (contracts — mock for now)
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

// ── Persistence helpers ─────────────────────────────────────────
function loadState(projectId: string): ProjectAssistantState {
  try {
    const raw = localStorage.getItem(`assistant_${projectId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    thread: [],
    spec: { ...DEFAULT_SPEC },
    selectedAsset: null,
    dockOpen: true,
    dockWidth: 380,
    activeTab: "chat",
  };
}

function saveState(projectId: string, state: ProjectAssistantState) {
  try {
    localStorage.setItem(`assistant_${projectId}`, JSON.stringify(state));
  } catch {}
}

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

  // Per-project state
  const [stateMap, setStateMap] = useState<Record<string, ProjectAssistantState>>({});

  // Load state when project changes
  useEffect(() => {
    if (activeProjectId && !stateMap[activeProjectId]) {
      setStateMap((prev) => ({
        ...prev,
        [activeProjectId]: loadState(activeProjectId),
      }));
    }
  }, [activeProjectId]);

  const current = activeProjectId ? stateMap[activeProjectId] ?? loadState(activeProjectId) : null;

  // Updater
  const update = useCallback(
    (fn: (s: ProjectAssistantState) => ProjectAssistantState) => {
      if (!activeProjectId) return;
      setStateMap((prev) => {
        const old = prev[activeProjectId] ?? loadState(activeProjectId);
        const next = fn(old);
        saveState(activeProjectId, next);
        return { ...prev, [activeProjectId]: next };
      });
    },
    [activeProjectId]
  );

  // ── API ────────────────────
  const openDock = useCallback(() => update((s) => ({ ...s, dockOpen: true })), [update]);
  const closeDock = useCallback(() => update((s) => ({ ...s, dockOpen: false })), [update]);
  const toggleDock = useCallback(() => update((s) => ({ ...s, dockOpen: !s.dockOpen })), [update]);
  const setDockWidth = useCallback((w: number) => update((s) => ({ ...s, dockWidth: w })), [update]);
  const setActiveTab = useCallback((tab: "chat" | "context" | "actions") => update((s) => ({ ...s, activeTab: tab })), [update]);

  const sendMessage = useCallback(
    (text: string) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      // Mock assistant reply
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Entendido! Vou processar: "${text.slice(0, 80)}${text.length > 80 ? "…" : ""}".\n\n_Geração de conteúdo será conectada em breve._`,
        timestamp: Date.now() + 1,
      };
      update((s) => ({ ...s, thread: [...s.thread, userMsg, assistantMsg], activeTab: "chat" }));
    },
    [update]
  );

  const setSpec = useCallback(
    (partial: Partial<GenerationSpec>) =>
      update((s) => ({ ...s, spec: { ...s.spec, ...partial } })),
    [update]
  );

  const selectAsset = useCallback(
    (asset: SelectedAsset | null) =>
      update((s) => ({ ...s, selectedAsset: asset, dockOpen: true, activeTab: asset ? "context" : s.activeTab })),
    [update]
  );

  // Mock action contracts
  const mockAction = (action: string, id: string) => {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "system",
      content: `✅ Ação **${action}** executada no ativo \`${id.slice(0, 8)}…\``,
      timestamp: Date.now(),
    };
    update((s) => ({ ...s, thread: [...s.thread, msg] }));
  };

  const value: AssistantContextValue = {
    activeProjectId,
    isInProject,
    dockOpen: current?.dockOpen ?? false,
    dockWidth: current?.dockWidth ?? 380,
    activeTab: current?.activeTab ?? "chat",
    openDock,
    closeDock,
    toggleDock,
    setDockWidth,
    setActiveTab,
    thread: current?.thread ?? [],
    sendMessage,
    spec: current?.spec ?? DEFAULT_SPEC,
    setSpec,
    selectedAsset: current?.selectedAsset ?? null,
    selectAsset,
    approveAsset: (id) => mockAction("Aprovar", id),
    promoteAsset: (id) => mockAction("Promover a Oficial", id),
    archiveAsset: (id) => mockAction("Arquivar", id),
    regenerateAsset: (id) => mockAction("Regerar", id),
    regenerateWithQuality: (id) => mockAction("Regerar com Qualidade", id),
  };

  return <AssistantCtx.Provider value={value}>{children}</AssistantCtx.Provider>;
}
