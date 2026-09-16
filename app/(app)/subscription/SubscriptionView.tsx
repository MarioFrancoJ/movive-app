"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import { useToast } from "@/components/ui/Toast";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";
import {
  type PlanId,
  limitsForPlanId,
  isPaidPlan,
  formatPrice,
  PRO_PRICE_MONTHLY,
  PRO_PRICE_YEARLY,
} from "@/lib/plans";

// ── Types ─────────────────────────────────────────────────────────────────────

type SubscriptionDict = ReturnType<typeof useDictionary>["dict"]["subscription"];

// Internal (DB) plan id — persisted values, kept for compatibility. UI maps
// these to the public Free / Pro display via lib/plans.
type PlanType = PlanId;
type SubscriptionStatus = "Active" | "Trial" | "Expired" | "Cancelled" | "Pending";

interface Subscription {
  id: string;
  plan: PlanType;
  status: SubscriptionStatus;
  startDate: string;
  renewalDate: string | null;
  expirationDate: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Maps a plan id (logic key) to its localized display name.
function planName(plan: PlanType, t: SubscriptionDict): string {
  switch (plan) {
    case "PREMIUM_MONTHLY": return t.planPremiumMonthly;
    case "PREMIUM_YEARLY":  return t.planPremiumYearly;
    default:                return t.planFree;
  }
}

function UsageBar({ label, current, max }: { label: string; current: number; max: number }) {
  const unlimited = max === -1;
  const pct = unlimited ? 0 : Math.min((current / max) * 100, 100);
  const isNear = !unlimited && pct >= 80;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-600">{label}</span>
        <span className={`text-xs font-semibold ${isNear ? "text-red-500" : "text-zinc-700"}`}>
          {current} / {unlimited ? "∞" : max}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full rounded-full transition-all ${isNear ? "bg-red-400" : "bg-primary"}`}
          style={{ width: unlimited ? "0%" : `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubscriptionView() {
  const { dict } = useDictionary();
  const t = dict.subscription;
  const { success: showToast } = useToast();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState({ recipesCreated: 0, workoutPlansCreated: 0, progressPhotosUploaded: 0, historyDays: 0 });
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Load subscription
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("id, plan, status, start_date, renewal_date, expiration_date")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subData) {
        setSub({
          id: subData.id,
          plan: subData.plan as PlanType,
          status: subData.status as SubscriptionStatus,
          startDate: subData.start_date,
          renewalDate: subData.renewal_date,
          expirationDate: subData.expiration_date,
        });
      } else {
        setSub({ id: "", plan: "FREE", status: "Active", startDate: new Date().toISOString().slice(0, 10), renewalDate: null, expirationDate: null });
      }

      // Load usage counts from actual tables
      const { count: recipesCount } = await supabase.from("recipes").select("id", { count: "exact", head: true }).eq("created_by", user.id);
      const { count: workoutsCount } = await supabase.from("workouts").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      const { count: photosCount } = await supabase.from("progress_photos").select("id", { count: "exact", head: true }).eq("user_id", user.id);

      setUsage({
        recipesCreated: recipesCount || 0,
        workoutPlansCreated: workoutsCount || 0,
        progressPhotosUploaded: photosCount || 0,
        historyDays: 0,
      });

      setLoading(false);
    }
    loadData();
  }, []);

  async function handleUpgrade(plan: PlanType) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !sub) return;

    const now = new Date();
    const renewalDate = new Date(now);
    if (plan === "PREMIUM_MONTHLY") renewalDate.setMonth(now.getMonth() + 1);
    else if (plan === "PREMIUM_YEARLY") renewalDate.setFullYear(now.getFullYear() + 1);

    try {
      if (sub.id) {
        await supabase.from("subscriptions").update({ plan, status: "Active", start_date: now.toISOString().slice(0, 10), renewal_date: renewalDate.toISOString().slice(0, 10), expiration_date: null }).eq("id", sub.id);
      } else {
        const { data: inserted } = await supabase.from("subscriptions").insert({ user_id: user.id, plan, status: "Active", start_date: now.toISOString().slice(0, 10), renewal_date: renewalDate.toISOString().slice(0, 10) }).select("id").single();
        if (inserted) sub.id = inserted.id;
      }
      setSub({ ...sub, plan, status: "Active", startDate: now.toISOString().slice(0, 10), renewalDate: renewalDate.toISOString().slice(0, 10), expirationDate: null });
      showToast(t.toastUpgraded);
    } catch (err) { console.error("Upgrade failed:", err); }
  }

  async function handleCancel() {
    if (!sub?.id) return;
    const supabase = createClient();
    await supabase.from("subscriptions").update({ status: "Cancelled", expiration_date: sub.renewalDate }).eq("id", sub.id);
    setSub({ ...sub, status: "Cancelled", expirationDate: sub.renewalDate });
    showToast(t.toastCancelled);
  }

  async function handleDowngrade() {
    if (!sub?.id) return;
    const supabase = createClient();
    await supabase.from("subscriptions").update({ plan: "FREE", status: "Active", renewal_date: null, expiration_date: null }).eq("id", sub.id);
    setSub({ ...sub, plan: "FREE", status: "Active", renewalDate: null, expirationDate: null });
    showToast(t.toastDowngraded);
  }

  async function handleStartTrial() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !sub) return;

    const now = new Date();
    const expiry = new Date(now);
    expiry.setDate(now.getDate() + 7);

    if (sub.id) {
      await supabase.from("subscriptions").update({ plan: "PREMIUM_MONTHLY", status: "Trial", start_date: now.toISOString().slice(0, 10), renewal_date: null, expiration_date: expiry.toISOString().slice(0, 10) }).eq("id", sub.id);
    } else {
      await supabase.from("subscriptions").insert({ user_id: user.id, plan: "PREMIUM_MONTHLY", status: "Trial", start_date: now.toISOString().slice(0, 10), expiration_date: expiry.toISOString().slice(0, 10) });
    }
    setSub({ ...sub, plan: "PREMIUM_MONTHLY", status: "Trial", startDate: now.toISOString().slice(0, 10), renewalDate: null, expirationDate: expiry.toISOString().slice(0, 10) });
    showToast(t.toastTrialStarted);
  }

  if (loading) {
    return (
      <PageLoader text={t.loading} />
    );
  }

  if (!sub) return null;

  const premium = isPaidPlan(sub.plan) && (sub.status === "Active" || sub.status === "Trial");
  const limits = limitsForPlanId(sub.plan);
  const badge = sub.plan === "FREE" ? { label: t.badgeFree, color: "bg-zinc-100 text-zinc-600" } : sub.status === "Trial" ? { label: t.badgeTrial, color: "bg-amber-100 text-amber-700" } : { label: t.badgePremium, color: "bg-primary text-white" };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">{t.subtitle}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${badge.color}`}>{badge.label}</span>
        </div>

        {/* Current Plan */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-zinc-900">{t.currentPlanHeading}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-zinc-50 p-4"><p className="text-xs text-zinc-400">{t.fieldPlan}</p><p className="text-sm font-bold text-zinc-900">{planName(sub.plan, t)}</p></div>
            <div className="rounded-lg bg-zinc-50 p-4"><p className="text-xs text-zinc-400">{t.fieldStatus}</p><p className={`text-sm font-bold ${sub.status === "Active" ? "text-success" : sub.status === "Trial" ? "text-amber-600" : "text-red-500"}`}>{sub.status}</p></div>
            <div className="rounded-lg bg-zinc-50 p-4"><p className="text-xs text-zinc-400">{t.fieldStartDate}</p><p className="text-sm font-bold text-zinc-900">{sub.startDate}</p></div>
            <div className="rounded-lg bg-zinc-50 p-4"><p className="text-xs text-zinc-400">{sub.expirationDate ? t.fieldExpires : t.fieldRenewal}</p><p className="text-sm font-bold text-zinc-900">{sub.expirationDate || sub.renewalDate || "—"}</p></div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {!premium && (
              <>
                <button type="button" onClick={() => handleUpgrade("PREMIUM_MONTHLY")} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover">{t.upgradeMonthly.replace("{price}", formatPrice(PRO_PRICE_MONTHLY))}</button>
                <button type="button" onClick={() => handleUpgrade("PREMIUM_YEARLY")} className="rounded-lg border border-primary px-4 py-2 text-xs font-semibold text-primary-fg hover:bg-primary-light">{t.upgradeYearly.replace("{price}", formatPrice(PRO_PRICE_YEARLY))}</button>
                {sub.status !== "Trial" && <button type="button" onClick={handleStartTrial} className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">{t.startTrial}</button>}
              </>
            )}
            {premium && sub.status === "Active" && (
              <>
                <button type="button" onClick={handleCancel} className="rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">{t.cancel}</button>
                <button type="button" onClick={handleDowngrade} className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50">{t.downgrade}</button>
              </>
            )}
          </div>
        </div>

        {/* Usage */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-zinc-900">{t.usageHeading}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <UsageBar label={t.usageRecipes} current={usage.recipesCreated} max={limits.maxRecipes} />
            <UsageBar label={t.usageWorkoutPlans} current={usage.workoutPlansCreated} max={limits.maxWorkoutPlans} />
            <UsageBar label={t.usageProgressPhotos} current={usage.progressPhotosUploaded} max={limits.maxProgressPhotos} />
            <UsageBar label={t.usageHistoryDays} current={usage.historyDays} max={limits.maxHistoryDays} />
          </div>
        </div>

        {!premium && (
          <div className="rounded-xl border border-border-brand bg-background-brand p-6">
            <p className="text-sm font-semibold text-primary-fg">{t.unlockHeading}</p>
            <p className="mt-1 text-xs text-success">{t.unlockDesc}</p>
            <Link href="/pricing" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover">{t.viewPlans}</Link>
          </div>
        )}
      </div>
    </>
  );
}
