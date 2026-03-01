import { useState } from "react";
import { Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Mail, Lock, User, ArrowRight, Loader2, Orbit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import StarField from "@/components/StarField";

type Mode = "login" | "signup" | "forgot";

export default function Auth() {
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (session) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
        setMode("login");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu email para confirmar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar solicitação");
    } finally {
      setSubmitting(false);
    }
  };

  const titles = {
    login: "Bem-vindo de volta",
    signup: "Crie sua conta",
    forgot: "Recuperar senha",
  };

  const subtitles = {
    login: "Acesse o centro de comando",
    signup: "Comece sua jornada criativa",
    forgot: "Enviaremos um link de recuperação",
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Star field background */}
      <StarField />

      {/* Ambient nebula glows */}
      <div className="fixed inset-0 pointer-events-none z-[1]">
        <div
          className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, hsl(var(--cos-purple) / 0.3) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-1/4 -right-1/4 w-[800px] h-[800px] rounded-full opacity-15"
          style={{
            background: "radial-gradient(circle, hsl(var(--primary) / 0.25) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[420px] px-4"
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-10 text-center"
        >
          <div className="inline-flex items-center gap-3 mb-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="relative"
            >
              <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-cos-purple/10 p-3 border border-primary/20 glow-cyan">
                <Zap className="h-7 w-7 text-primary" />
              </div>
              {/* Orbiting dot */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-8px]"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-primary absolute top-0 left-1/2 -translate-x-1/2" />
              </motion.div>
            </motion.div>
            <div className="text-left">
              <h1 className="text-2xl font-bold font-mono-brand tracking-tight">COS</h1>
              <p className="text-[10px] text-muted-foreground/60 font-mono-brand tracking-[0.2em] uppercase">
                Creative Operating System
              </p>
            </div>
          </div>
        </motion.div>

        {/* Glass Card */}
        <motion.div
          layout
          className="glass-intense rounded-3xl p-8 elevation-clay relative overflow-hidden"
        >
          {/* Card inner glow */}
          <div
            className="absolute -top-20 -right-20 w-40 h-40 rounded-full pointer-events-none opacity-40"
            style={{
              background: "radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 70%)",
            }}
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              {/* Title */}
              <div className="mb-6">
                <h2 className="text-lg font-bold font-mono-brand tracking-tight">
                  {titles[mode]}
                </h2>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {subtitles[mode]}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {mode === "signup" && (
                  <div className="relative group">
                    <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full rounded-xl border border-border/50 bg-background/40 py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                )}

                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    className="w-full rounded-xl border border-border/50 bg-background/40 py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                {mode !== "forgot" && (
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Senha (mín. 6 caracteres)"
                      className="w-full rounded-xl border border-border/50 bg-background/40 py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                )}

                {mode === "login" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-[11px] text-muted-foreground/60 hover:text-primary transition-colors"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                )}

                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all glow-cyan disabled:opacity-50 mt-2"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {mode === "login" ? "Entrar" : mode === "signup" ? "Criar Conta" : "Enviar Link"}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </motion.button>
              </form>
            </motion.div>
          </AnimatePresence>

          {/* Mode switch */}
          <div className="mt-6 pt-5 border-t border-border/30 text-center">
            {mode === "login" && (
              <p className="text-xs text-muted-foreground/60">
                Não tem conta?{" "}
                <button onClick={() => setMode("signup")} className="text-primary hover:text-primary/80 font-semibold transition-colors">
                  Criar conta
                </button>
              </p>
            )}
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground/60">
                Já tem conta?{" "}
                <button onClick={() => setMode("login")} className="text-primary hover:text-primary/80 font-semibold transition-colors">
                  Entrar
                </button>
              </p>
            )}
            {mode === "forgot" && (
              <button onClick={() => setMode("login")} className="text-xs text-muted-foreground/60 hover:text-primary transition-colors">
                ← Voltar para login
              </button>
            )}
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-[10px] text-muted-foreground/30 mt-8 font-mono-brand tracking-wider"
        >
          POWERED BY COS ENGINE
        </motion.p>
      </motion.div>
    </div>
  );
}
