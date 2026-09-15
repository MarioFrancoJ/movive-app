import type { Metadata } from "next";
import { getLocaleCookie } from "@/lib/i18n/actions";
import { getDictionary } from "@/lib/i18n/getDictionary";
import ShoppingListView from "./ShoppingListView";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocaleCookie();
  const dict = await getDictionary(locale);
  return {
    title: dict.nav.nutrition.shoppingList,
  };
}

export default function ShoppingListPage() {
  return <ShoppingListView />;
}
