import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useAIGuard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["ai-guard-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("is_ai_paused, credit_balance, monthly_budget")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
    refetchInterval: 15_000,
  });

  const { data: monthlySpent } = useQuery({
    queryKey: ["monthly-spent", user?.id],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data } = await supabase
        .from("cos_ledger")
        .select("credits_cost")
        .eq("user_id", user!.id)
        .gte("created_at", startOfMonth);
      return (data || []).reduce((sum, row) => sum + Number(row.credits_cost || 0), 0);
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const togglePause = useMutation({
    mutationFn: async (paused: boolean) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_ai_paused: paused } as any)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-guard-profile"] }),
  });

  const updateBudget = useMutation({
    mutationFn: async (budget: number | null) => {
      const { error } = await supabase
        .from("profiles")
        .update({ monthly_budget: budget } as any)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-guard-profile"] }),
  });

  return {
    isAIPaused: profile?.is_ai_paused ?? false,
    creditBalance: Number(profile?.credit_balance ?? 0),
    monthlyBudget: profile?.monthly_budget ? Number(profile.monthly_budget) : null,
    monthlySpent: monthlySpent ?? 0,
    isLoading,
    togglePause,
    updateBudget,
  };
}
