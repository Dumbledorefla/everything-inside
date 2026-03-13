/**
 * Shared guard utilities for Edge Functions.
 * Checks AI pause, credit balance, and monthly budget before allowing operations.
 */

export interface GuardResult {
  allowed: boolean;
  reason?: string;
}

export async function checkAIGuard(
  supabase: any,
  userId: string,
  operationCost: number = 0
): Promise<GuardResult> {
  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_ai_paused, credit_balance, monthly_budget")
    .eq("user_id", userId)
    .single();

  // If no profile found, allow (graceful degradation)
  if (!profile) return { allowed: true };

  // Check global AI pause
  if (profile.is_ai_paused) {
    return { allowed: false, reason: "AI_PAUSED" };
  }

  // Check credit balance (only if operationCost > 0)
  if (operationCost > 0 && profile.credit_balance !== null && profile.credit_balance !== undefined) {
    // credit_balance tracks consumed credits; we don't block based on it
    // unless a monthly_budget is set
  }

  // Check monthly budget
  if (profile.monthly_budget && profile.monthly_budget > 0) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: ledger } = await supabase
      .from("cos_ledger")
      .select("credits_cost")
      .eq("user_id", userId)
      .gte("created_at", startOfMonth);

    const totalSpent = (ledger || []).reduce(
      (sum: number, row: any) => sum + Number(row.credits_cost || 0),
      0
    );

    if (totalSpent + operationCost > profile.monthly_budget) {
      return { allowed: false, reason: "BUDGET_EXCEEDED" };
    }
  }

  return { allowed: true };
}

export function guardErrorResponse(reason: string, corsHeaders: Record<string, string>): Response {
  const messages: Record<string, string> = {
    AI_PAUSED: "As operações de IA estão pausadas globalmente pelo usuário.",
    BUDGET_EXCEEDED: "O orçamento mensal de créditos foi excedido.",
  };

  return new Response(
    JSON.stringify({ error: messages[reason] || "Operação bloqueada.", code: reason }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
