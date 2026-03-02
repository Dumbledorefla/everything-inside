import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "online" | "offline" | "checking";

export default function ConnectionStatus() {
  const [status, setStatus] = useState<Status>("checking");
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [retrying, setRetrying] = useState(false);

  const check = useCallback(async () => {
    setRetrying(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`,
        {
          method: "HEAD",
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);
      setStatus(res.ok ? "online" : "offline");
    } catch {
      setStatus("offline");
    } finally {
      setLastCheck(new Date());
      setRetrying(false);
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [check]);

  // Also listen to browser online/offline
  useEffect(() => {
    const goOnline = () => check();
    const goOffline = () => setStatus("offline");
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [check]);

  const label =
    status === "online" ? "Conectado" :
    status === "offline" ? "Sem conexão" :
    "Verificando…";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-mono-brand uppercase tracking-wider border transition-all duration-500 select-none",
        status === "online" && "bg-cos-success/8 border-cos-success/15 text-cos-success/80",
        status === "offline" && "bg-destructive/8 border-destructive/20 text-destructive",
        status === "checking" && "bg-muted/10 border-border/10 text-muted-foreground/50",
      )}
    >
      {/* Dot / icon */}
      <span className="relative flex h-2 w-2">
        {status === "online" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cos-success/40" />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            status === "online" && "bg-cos-success",
            status === "offline" && "bg-destructive",
            status === "checking" && "bg-muted-foreground/40 animate-pulse",
          )}
        />
      </span>

      {status === "online" ? (
        <Wifi className="h-3 w-3" />
      ) : status === "offline" ? (
        <WifiOff className="h-3 w-3" />
      ) : null}

      <span>{label}</span>

      {status === "offline" && (
        <button
          onClick={check}
          disabled={retrying}
          className="ml-1 rounded-full p-0.5 hover:bg-destructive/10 transition-colors disabled:opacity-40"
          title="Tentar reconectar"
        >
          <RefreshCw className={cn("h-3 w-3", retrying && "animate-spin")} />
        </button>
      )}
    </div>
  );
}