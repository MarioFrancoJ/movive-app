#!/usr/bin/env node
/**
 * Backfill: shopping_lists.items (JSON blob) → shopping_list_items (rows).
 * Migration 00014, Phase 1.
 *
 * - Reuses the SAME quantity parsing logic as lib/nutrition.ts (parseQuantity)
 *   so SQL/JS never diverge. See §Backfill in docs/00014-*.
 * - Idempotent: skips a user who already has rows in shopping_list_items.
 * - Non-destructive: never touches shopping_lists (kept as rollback/backup).
 * - Dedupe: consolidates duplicate names within a list (sum qty when unit
 *   matches), mirroring the single merge engine planned for Phase 2.
 *
 * Usage:
 *   node scripts/backfill-shopping-list-items.mjs           # dry-run (default)
 *   node scripts/backfill-shopping-list-items.mjs --apply   # actually insert
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local. READS blob, WRITES only to
 * shopping_list_items.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const APPLY = process.argv.includes("--apply");

const env = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ── EXACT copy of lib/nutrition.ts parseQuantity (single source of truth) ────
function parseQuantity(raw) {
  const match = String(raw).trim().match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return { qty: NaN, unit: String(raw).trim() };
  return { qty: parseFloat(match[1]), unit: match[2].trim() };
}
function normalizeName(name) { return String(name).trim().toLowerCase(); }

// Convert one blob item → a structured row payload.
function toRow(userId, item, sortOrder) {
  const name = String(item?.name ?? "").trim();
  const rawQ = item?.quantity;
  let qty = null;
  let unit = "";
  if (rawQ != null && String(rawQ).trim() !== "" && String(rawQ).trim() !== "—") {
    const p = parseQuantity(rawQ);
    if (Number.isNaN(p.qty)) {
      // Unparseable → keep the original text as the unit so nothing is lost.
      qty = null;
      unit = String(rawQ).trim();
    } else {
      qty = p.qty;
      unit = p.unit;
    }
  }
  return {
    id: randomUUID(),
    user_id: userId,
    name,
    qty,
    unit,
    category: "Other",           // no category in legacy data; Phase 2 can reclassify
    checked: Boolean(item?.checked),
    source_recipe_id: null,
    sort_order: sortOrder,
  };
}

// Dedupe within a single list (sum qty when unit matches; else keep separate).
function dedupe(rows) {
  const out = [];
  const idx = new Map(); // key: name|unit → index in out
  for (const r of rows) {
    const key = `${normalizeName(r.name)}|${r.unit}`;
    if (idx.has(key) && r.qty != null && out[idx.get(key)].qty != null) {
      out[idx.get(key)].qty = Math.round((out[idx.get(key)].qty + r.qty) * 100) / 100;
    } else {
      idx.set(key, out.length);
      out.push({ ...r });
    }
  }
  return out.map((r, i) => ({ ...r, sort_order: i }));
}

async function main() {
  console.log(`Backfill mode: ${APPLY ? "APPLY (will insert)" : "DRY-RUN (no writes)"}\n`);

  const { data: lists, error } = await sb
    .from("shopping_lists")
    .select("id, user_id, items");
  if (error) { console.error("Failed to read shopping_lists:", error); process.exit(1); }

  let totalUsers = 0, totalItemsIn = 0, totalRowsOut = 0, skipped = 0;

  // Group blob items per user (a user might have >1 list row; today max 1).
  const byUser = new Map();
  for (const l of lists || []) {
    const items = Array.isArray(l.items) ? l.items : [];
    if (!byUser.has(l.user_id)) byUser.set(l.user_id, []);
    byUser.get(l.user_id).push(...items);
  }

  for (const [userId, items] of byUser) {
    totalUsers++;
    totalItemsIn += items.length;

    // Idempotency: skip users who already have rows.
    const { count } = await sb.from("shopping_list_items")
      .select("*", { count: "exact", head: true }).eq("user_id", userId);
    if (count && count > 0) {
      console.log(`user ${userId}: already has ${count} rows → skip`);
      skipped++;
      continue;
    }

    const rows = dedupe(items.map((it, i) => toRow(userId, it, i)))
      .filter((r) => r.name.length > 0); // never insert nameless items

    console.log(`user ${userId}: ${items.length} blob items → ${rows.length} rows`);
    for (const r of rows) console.log(`   - ${r.name} | qty=${r.qty ?? "NULL"} unit="${r.unit}" checked=${r.checked}`);
    totalRowsOut += rows.length;

    if (APPLY && rows.length > 0) {
      const { error: insErr } = await sb.from("shopping_list_items").insert(rows);
      if (insErr) { console.error(`   INSERT failed for ${userId}:`, insErr); process.exit(1); }
      console.log(`   inserted ${rows.length} rows`);
    }
  }

  console.log(`\nSummary: users=${totalUsers} blobItems=${totalItemsIn} rowsToInsert=${totalRowsOut} skipped=${skipped}`);
  console.log(APPLY ? "Done (applied)." : "Dry-run only. Re-run with --apply to insert.");
  process.exit(0);
}
main();
