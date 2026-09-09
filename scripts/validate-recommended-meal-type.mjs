#!/usr/bin/env node
/**
 * Validation for migration 00015 + backfill. Read-only.
 * Confirms: column exists, NO recipe has NULL recommended_meal_type, and every
 * value is one of the 5 allowed slots. Exits non-zero on any discrepancy.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ALLOWED = new Set(["Breakfast", "Snack AM", "Lunch", "Snack PM", "Dinner"]);
let failures = 0;
const fail = (m) => { console.error("  ✗ " + m); failures++; };
const ok = (m) => console.log("  ✓ " + m);

const probe = await sb.from("recipes").select("recommended_meal_type").limit(1);
if (probe.error) { console.error("column missing — migration not applied:", probe.error.code); process.exit(1); }
ok("recommended_meal_type column exists");

const { data: recipes } = await sb.from("recipes").select("id, name, recommended_meal_type");
const nulls = (recipes || []).filter((r) => !r.recommended_meal_type);
const invalid = (recipes || []).filter((r) => r.recommended_meal_type && !ALLOWED.has(r.recommended_meal_type));

if (nulls.length) fail(`${nulls.length} recipe(s) with NULL recommended_meal_type: ${nulls.map((r) => r.name).join(", ")}`);
else ok(`no NULLs — all ${recipes?.length ?? 0} recipe(s) have a recommendation`);

if (invalid.length) fail(`${invalid.length} recipe(s) with invalid value: ${invalid.map((r) => `${r.name}=${r.recommended_meal_type}`).join(", ")}`);
else ok("all values are within the 5 allowed slots");

// Distribution (informational)
const dist = {};
for (const r of recipes || []) dist[r.recommended_meal_type] = (dist[r.recommended_meal_type] || 0) + 1;
console.log("  distribution:", JSON.stringify(dist));

console.log(`\nRESULT: ${failures === 0 ? "PASS — every recipe has a valid recommendation" : failures + " discrepancy(ies)"}`);
process.exit(failures === 0 ? 0 : 1);
