import { createClient } from "@/lib/supabase/server";
import RecipesView, {
  type Recipe,
  type RecipeGoal,
  type MealType,
} from "./RecipesView";

// Server Component: fetch recipes on the server (no client waterfall / spinner)
// and hand the data to the interactive client view. RLS is enforced via the
// user's JWT from cookies.
export default async function RecipesPage() {
  const supabase = await createClient();

  const { data: recipesData } = await supabase
    .from("recipes")
    .select(
      `
      id,
      name,
      description,
      goal,
      meal_type,
      recommended_meal_type,
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
      )
    `
    )
    .order("name");

  const recipes: Recipe[] = (recipesData ?? []).map((r: {
    id: string;
    name: string;
    description: string | null;
    goal: string | null;
    meal_type: string | null;
    recommended_meal_type: string | null;
    image_url: string | null;
    servings: number | null;
    prep_time: number | null;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    recipe_ingredients: { id: string; name: string; quantity: number | null; unit: string | null }[] | null;
  }) => ({
    id: r.id,
    name: r.name,
    description: r.description || "",
    goal: (r.goal || "Maintenance") as RecipeGoal,
    mealType: (r.meal_type || null) as MealType | null,
    recommendedMealType: r.recommended_meal_type || null,
    imageUrl: r.image_url || null,
    servings: r.servings || 1,
    prepTime: r.prep_time || 0,
    calories: r.calories || 0,
    protein: r.protein || 0,
    carbs: r.carbs || 0,
    fat: r.fat || 0,
    ingredients: (r.recipe_ingredients || []).map((ing) => ({
      id: ing.id,
      name: ing.name,
      quantity: ing.quantity || 0,
      unit: ing.unit || "",
    })),
  }));

  return <RecipesView initialRecipes={recipes} />;
}
