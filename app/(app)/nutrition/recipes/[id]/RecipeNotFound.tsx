"use client";

import Link from "next/link";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// Localized "recipe not found" state. Small client component so it can read the
// dictionary; rendered by the server page when the recipe id doesn't resolve.
export default function RecipeNotFound() {
  const { dict } = useDictionary();
  const t = dict.nutrition.recipeDetail;
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <p className="mb-2 text-lg font-semibold text-zinc-900">{t.notFoundTitle}</p>
      <p className="mb-6 text-golden-sm text-zinc-500">{t.notFoundDescription}</p>
      <Link
        href="/nutrition/recipes"
        className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-golden-sm font-semibold text-white hover:bg-primary-hover"
      >
        {t.backToRecipes}
      </Link>
    </div>
  );
}
