import type { SupabaseClient } from "@supabase/supabase-js";

// Schema-level plan tiers — no real payment processing. `subscriptions.plan`
// gates feature limits in application code; upgrading to real billing later
// only means writing to this same column from a checkout webhook instead of
// defaulting everyone to "free".
export const PLAN_LIMITS = {
  free: { maxGalleries: 1, maxStorageBytes: 2 * 1024 ** 3 },
  pro: { maxGalleries: 10, maxStorageBytes: 50 * 1024 ** 3 },
} as const;

export type PlanId = keyof typeof PLAN_LIMITS;

function isPlanId(value: unknown): value is PlanId {
  return value === "free" || value === "pro";
}

export async function getOwnerPlan(supabase: SupabaseClient, userId: string): Promise<PlanId> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return isPlanId(data?.plan) ? data.plan : "free";
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)}GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)}MB`;
  return `${bytes}B`;
}
