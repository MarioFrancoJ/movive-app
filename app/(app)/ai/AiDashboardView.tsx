"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

type AiDict = ReturnType<typeof useDictionary>["dict"]["ai"];

interface AIUsageStats {
  dailyRequests: number;
  monthlyRequests: number;
  dailyTokens: number;
  monthlyTokens: number;
  estimatedMonthlyCost: number;
}

interface AIFeatureFlags {
  aiCoach: boolean;
  aiMealPlanner: boolean;
  aiWorkoutGenerator: boolean;
  aiInsights: boolean;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AiDashboardView() {
  const { dict } = useDictionary();
  const t = dict.ai;
  const [flags, setFlags] = useState<AIFeatureFlags>({ aiCoach: true, aiMealPlanner: false, aiWorkoutGenerator: false, aiInsights: false });
  const [usage, setUsage] = useState<AIUsageStats>({ dailyRequests: 0, monthlyRequests: 0, dailyTokens: 0, monthlyTokens: 0, estimatedMonthlyCost: 0 });
  const [activeProvider, setActiveProvider] = useState(dict.ai.providerRuleBasedFallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Load AI usage stats from ai_usage table
      const today = new Date().toISOString().slice(0, 10);
      const monthStart = today.slice(0, 7);

      const { data: usageData } = await supabase
        .from("ai_usage")
        .select("tokens_used, estimated_cost, date")
        .eq("user_id", user.id);

      if (usageData) {
        const dailyEntries = usageData.filter((u) => u.date === today);
        const monthlyEntries = usageData.filter((u) => u.date.startsWith(monthStart));
        setUsage({
          dailyRequests: dailyEntries.length,
          monthlyRequests: monthlyEntries.length,
          dailyTokens: dailyEntries.reduce((s, u) => s + u.tokens_used, 0),
          monthlyTokens: monthlyEntries.reduce((s, u) => s + u.tokens_used, 0),
          estimatedMonthlyCost: monthlyEntries.reduce((s, u) => s + u.estimated_cost, 0),
        });
      }

      // Load feature flags from platform_settings
      const { data: flagsData } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "ai_feature_flags")
        .maybeSingle();

      if (flagsData?.value && typeof flagsData.value === "object") {
        const v = flagsData.value as Record<string, boolean>;
        setFlags({
          aiCoach: v.aiCoach ?? true,
          aiMealPlanner: v.aiMealPlanner ?? false,
          aiWorkoutGenerator: v.aiWorkoutGenerator ?? false,
          aiInsights: v.aiInsights ?? false,
        });
      }

      // Check active provider from platform_settings
      const { data: configData } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "ai_config")
        .maybeSingle();

      if (configData?.value && typeof configData.value === "object") {
        const cfg = configData.value as Record<string, string>;
        const provider = cfg.provider || "rule_based";
        setActiveProvider(provider === "rule_based" ? dict.ai.providerRuleBasedFallback : provider.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()));
      }

      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <PageLoader text={t.loadingDashboard} />
    );
  }

  const features = [
    { key: "aiCoach" as const, label: t.featureAiCoachLabel, description: t.featureAiCoachDesc, enabled: flags.aiCoach, href: "/ai/chat" },
    { key: "aiMealPlanner" as const, label: t.featureMealPlannerLabel, description: t.featureMealPlannerDesc, enabled: flags.aiMealPlanner, href: "/nutrition/meal-planner" },
    { key: "aiWorkoutGenerator" as const, label: t.featureWorkoutGenLabel, description: t.featureWorkoutGenDesc, enabled: flags.aiWorkoutGenerator, href: "/workouts/new" },
    { key: "aiInsights" as const, label: t.featureInsightsLabel, description: t.featureInsightsDesc, enabled: flags.aiInsights, href: "/ai-coach" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t.dashboardTitle}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t.dashboardSubtitle}</p>
        </div>
        <Link href="/ai/chat" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover">
          {t.openChat}
        </Link>
      </div>

      {/* Provider status */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.activeProvider}</p>
            <p className="mt-1 text-sm font-bold text-zinc-900">{activeProvider}</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-success-light px-3 py-1 text-xs font-medium text-success">
            <span className="h-2 w-2 rounded-full bg-success" />
            {t.statusOnline}
          </span>
        </div>
      </div>

      {/* Usage stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xl font-bold text-zinc-900">{usage.dailyRequests}</p>
          <p className="text-xs text-zinc-400">{t.statToday}</p>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xl font-bold text-blue-600">{usage.monthlyRequests}</p>
          <p className="text-xs text-zinc-400">{t.statThisMonth}</p>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xl font-bold text-zinc-900">{usage.monthlyTokens.toLocaleString()}</p>
          <p className="text-xs text-zinc-400">{t.statTokens}</p>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xl font-bold text-success">${usage.estimatedMonthlyCost.toFixed(4)}</p>
          <p className="text-xs text-zinc-400">{t.statEstCost}</p>
        </div>
      </div>

      {/* AI Features */}
      <div>
        <p className="mb-3 text-sm font-semibold text-zinc-900">{t.featuresHeading}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.key} className={["flex items-start justify-between rounded-xl border p-5 shadow-sm transition-shadow",
              feature.enabled ? "border-zinc-200 bg-white hover:shadow-md" : "border-zinc-100 bg-zinc-50 opacity-70",
            ].join(" ")}>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-zinc-900">{feature.label}</p>
                  {feature.enabled ? (
                    <span className="rounded-full bg-success-light px-2 py-0.5 text-xs font-medium text-success">{t.badgeActive}</span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">{t.badgeComingSoon}</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-400">{feature.description}</p>
              </div>
              {feature.enabled && (
                <Link href={feature.href} className="shrink-0 text-xs font-medium text-zinc-600 hover:text-zinc-900">
                  {t.openLink}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/ai/chat" className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-sm font-semibold text-zinc-900">{t.quickChatTitle}</p>
          <p className="text-xs text-zinc-400">{t.quickChatDesc}</p>
        </Link>
        <Link href="/ai/settings" className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-sm font-semibold text-zinc-900">{t.quickSettingsTitle}</p>
          <p className="text-xs text-zinc-400">{t.quickSettingsDesc}</p>
        </Link>
        <Link href="/ai-coach" className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-sm font-semibold text-zinc-900">{t.quickCoachTitle}</p>
          <p className="text-xs text-zinc-400">{t.quickCoachDesc}</p>
        </Link>
      </div>
    </div>
  );
}
