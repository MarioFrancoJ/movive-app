import { createClient } from "@/lib/supabase/server";
import RecipeDetailView, {
  type Recipe,
  type RecipeGoal,
  type MealType,
} from "./RecipeDetailView";
import RecipeNotFound from "./RecipeNotFound";

// Server Component: fetch the recipe (with ingredients + instructions) on the
// server and hand it to the interactive client view. No client waterfall /
// spinner. Next 16: route params are async.
export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) return <RecipeNotFound />;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recipes")
    .select(
      `
      id,
      name,
      description,
      goal,
      meal_type,
      image_url,
      servings,
      prep_time,
      calories,
      protein,
      carbs,
      fat,
      recipe_ingredients (
        id,
        name,
        quantity,
        unit
      ),
      recipe_instructions (
        id,
        step_number,
        instruction
      )
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) return <RecipeNotFound />;

  const recipe: Recipe = {
    id: data.id,
    name: data.name,
    description: data.description || "",
    goal: (data.goal || "Maintenance") as RecipeGoal,
    mealType: (data.meal_type || null) as MealType | null,
    imageUrl: data.image_url || null,
    servings: data.servings || 1,
    prepTime: data.prep_time || 0,
    calories: data.calories || 0,
    protein: data.protein || 0,
    carbs: data.carbs || 0,
    fat: data.fat || 0,
    ingredients: (data.recipe_ingredients || []).map((ing) => ({
      id: ing.id,
      name: ing.name,
      quantity: ing.quantity || 0,
      unit: ing.unit || "",
    })),
    instructions: (data.recipe_instructions || [])
      .slice()
      .sort((a, b) => (a.step_number || 0) - (b.step_number || 0))
      .map((inst) => inst.instruction),
  };

  return <RecipeDetailView recipe={recipe} />;
}
