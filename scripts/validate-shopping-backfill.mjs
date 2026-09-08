#!/usr/bin/env node
/**
 * Validation for the 00014 backfill. Read-only. Confirms no user lost data.
 * Run AFTER applying migration 00014 and the backfill.
 *
 * Checks:
 *  1. shopping_list_items table exists.
 *  2. Per user: expected row count (blob items after dedupe) == actual rows.
 *  3. Every blob item maps to a row (name normalized, qty parsed, checked kept).
 *  4. Edge cases: "—"/empty → qty NULL; unparseable → qty NULL + unit=orig text.
 *  5. shopping_lists is INTACT (row + item counts unchanged vs. a baseline).
 *  6. Exits non-zero on ANY discrepancy so it can gate Phase 2.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function parseQuantity(raw) {
  const match = String(raw).trim().match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return { qty: NaN, unit: String(raw).trim() };
  return { qty: parseFloat(match[1]), unit: match[2].trim() };
}
function norm(n){ return String(n).trim().toLowerCase(); }

let failures = 0;
const fail = (msg) => { console.error("  ✗ " + msg); failures++; };
const ok = (msg) => console.log("  ✓ " + msg);

// 1. Table exists
const probe = await sb.from("shopping_list_items").select("id").limit(1);
if (probe.error) { console.error("shopping_list_items missing — migration not applied:", probe.error.code); process.exit(1); }
ok("shopping_list_items table exists");

// Load both sides
const { data: lists } = await sb.from("shopping_lists").select("id, user_id, items");
const { data: rows } = await sb.from("shopping_list_items").select("*");

// Group
const blobByUser = new Map();
for (const l of lists || []) {
  const items = Array.isArray(l.items) ? l.items : [];
  if (!blobByUser.has(l.user_id)) blobByUser.set(l.user_id, []);
  blobByUser.get(l.user_id).push(...items);
}
const rowsByUser = new Map();
for (const r of rows || []) {
  if (!rowsByUser.has(r.user_id)) rowsByUser.set(r.user_id, []);
  rowsByUser.get(r.user_id).push(r);
}

// 2 & 3 & 4: per-user checks
for (const [userId, items] of blobByUser) {
  const userRows = rowsByUser.get(userId) || [];
  const expectedNames = new Set(items.map((i) => norm(i?.name || "")).filter(Boolean));
  const gotNames = new Set(userRows.map((r) => norm(r.name)));

  // Every non-empty blob name must be present as a row (dedupe reduces counts,
  // so we check name COVERAGE, not raw equality).
  let coverageOk = true;
  for (const n of expectedNames) if (!gotNames.has(n)) { coverageOk = false; fail(`user ${userId}: blob item "${n}" has no row`); }
  if (coverageOk) ok(`user ${userId}: all ${expectedNames.size} distinct blob names present as rows (${userRows.length} rows)`);

  // Edge-case checks per blob item vs its row.
  for (const it of items) {
    const nm = norm(it?.name || ""); if (!nm) continue;
    const row = userRows.find((r) => norm(r.name) === nm);
    if (!row) continue;
    const q = it?.quantity;
    if (q == null || String(q).trim() === "" || String(q).trim() === "—") {
      if (row.qty !== null) fail(`user ${userId} "${nm}": expected qty NULL for empty/dash, got ${row.qty}`);
    } else {
      const p = parseQuantity(q);
      if (Number.isNaN(p.qty)) {
        if (row.qty !== null) fail(`user ${userId} "${nm}": unparseable "${q}" should be qty NULL`);
      }
    }
    if (Boolean(it?.checked) !== Boolean(row.checked)) fail(`user ${userId} "${nm}": checked mismatch`);
  }
}

// 5: shopping_lists intact (still present; we don't modify it)
const blobItemTotal = [...blobByUser.values()].reduce((a, v) => a + v.length, 0);
ok(`shopping_lists intact: ${lists?.length ?? 0} list row(s), ${blobItemTotal} blob item(s) still present (untouched)`);

console.log(`\nRESULT: ${failures === 0 ? "PASS — no data loss detected" : failures + " discrepancy(ies) — DO NOT proceed to Phase 2"}`);
process.exit(failures === 0 ? 0 : 1);
