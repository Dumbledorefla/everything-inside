import { motion } from "framer-motion";
import { Settings2, Shield, Zap, CreditCard, ScrollText, SlidersHorizontal, ToggleLeft } from "lucide-react";

const providers = [
  { name: "Nano Banana 2", model: "gemini-3.1-flash-image-preview", role: "Padrão", status: "OK", active: true },
  { name: "Nano Banana Pro", model: "gemini-3-pro-image-preview", role: "Qualidade", status: "OK", active: true },
  { name: "Nano Banana 2.5", model: "gemini-2.5-flash-image", role: "Economia", status: "OK", active: true },
];

const textProviders = [
  { name: "Gemini Flash", role: "Economia", status: "OK", active: true },
  { name: "Gemini Pro", role: "Padrão", status: "OK", active: true },
  { name: "OpenAI", role: "Qualidade", status: "OK", active: true },
  { name: "Claude", role: "Alternativo", status: "Inativo", active: false },
];

const roleColors: Record<string, string> = {
  Padrão: "bg-cos-cyan/10 text-cos-cyan",
  Qualidade: "bg-cos-purple/10 text-cos-purple",
  Economia: "bg-cos-warning/10 text-cos-warning",
  Alternativo: "bg-muted text-muted-foreground",
};

const tabs = [
  { id: "image", label: "Provedores Imagem", icon: Zap },
  { id: "text", label: "Provedores Texto", icon: ScrollText },
  { id: "fallback", label: "Fallback", icon: Shield },
  { id: "budget", label: "Budget & Quotas", icon: CreditCard },
  { id: "logs", label: "Logs", icon: SlidersHorizontal },
  { id: "ux", label: "Preferências", icon: ToggleLeft },
];

import { useState } from "react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("image");

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold tracking-tight mb-6">Configurações</h1>

      <div className="flex gap-6">
        {/* Tab list */}
        <div className="w-48 shrink-0 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-xs text-left transition-colors ${
                activeTab === tab.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === "image" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold mb-4">Provedores de Imagem</h2>
              {providers.map((p, i) => (
                <motion.div
                  key={p.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-lg border border-border bg-card p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-2 w-2 rounded-full ${p.active ? "bg-cos-success" : "bg-muted-foreground"}`} />
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{p.model}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-mono ${roleColors[p.role]}`}>{p.role}</span>
                    <span className="text-[10px] text-cos-success font-mono">{p.status}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {activeTab === "text" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold mb-4">Provedores de Texto</h2>
              {textProviders.map((p, i) => (
                <motion.div
                  key={p.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-lg border border-border bg-card p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-2 w-2 rounded-full ${p.active ? "bg-cos-success" : "bg-muted-foreground"}`} />
                    <p className="text-sm font-medium">{p.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-mono ${roleColors[p.role]}`}>{p.role}</span>
                    <span className={`text-[10px] font-mono ${p.active ? "text-cos-success" : "text-muted-foreground"}`}>{p.status}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {activeTab === "budget" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold mb-4">Budget & Quotas</h2>
              <div className="rounded-lg border border-border bg-card p-5 space-y-4">
                {[
                  { label: "Budget por geração", value: "50 créditos" },
                  { label: "Budget por Sprint", value: "500 créditos" },
                  { label: "Budget mensal", value: "2.000 créditos" },
                  { label: "Alerta em", value: "70% e 90%" },
                ].map((b) => (
                  <div key={b.label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{b.label}</span>
                    <span className="text-xs font-mono text-foreground">{b.value}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="text-xs font-semibold mb-3">COS Credits — Uso atual</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Consumido este mês</span>
                    <span className="font-mono">847 / 2.000</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: "42%" }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {!["image", "text", "budget"].includes(activeTab) && (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <Settings2 className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Seção em construção</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
