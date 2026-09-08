# Design Tokens — Border Radius & Numeric Controls

> Scope of this document: the canonical border-radius scale for Movive and the
> shared `QuantityStepper` control. Written alongside the UI-unification pass
> that introduced `components/ui/QuantityStepper.tsx`.

---

## 1. Border-radius scale (canonical)

Movive standardizes on **three** radius tokens (plus `full` for pills/avatars,
which is a shape, not a size step). The tokens already exist in
`app/globals.css` under the φ-harmonized `golden` family:

| Token (Tailwind class) | CSS variable | Value | Use for |
|---|---|---|---|
| `rounded-golden-sm` | `--radius-golden-sm` | 5px  | small chips, inline badges, tight controls |
| `rounded-golden-md` | `--radius-golden-md` | 8px  | **default**: buttons, inputs, steppers, list items |
| `rounded-golden-lg` | `--radius-golden-lg` | 13px | cards, panels, modals, media containers |
| `rounded-full`      | — (9999px)           | —    | pills, avatars, progress bars (shape, not a step) |

`--radius-golden-xl` (21px) remains defined for exceptional hero surfaces but is
**not** part of the everyday 3-tier vocabulary; prefer `lg` unless a surface
genuinely needs the larger sweep.

### Radius audit snapshot (at time of writing)

Current usage across `app/` + `components/` (informational — shows the drift the
token system is meant to converge):

```
Ad-hoc Tailwind radii:        golden tokens:
  346  rounded-lg               33  rounded-golden-md
  243  rounded-xl                8  rounded-golden-lg
  160  rounded-full              7  rounded-golden-xl
   62  rounded-md
   39  rounded-2xl
    1  rounded-sm
```

**Convergence guidance** (apply opportunistically when touching a file — no
big-bang migration):

| If you see | Replace with |
|---|---|
| `rounded-sm`, `rounded` | `rounded-golden-sm` |
| `rounded-md`, `rounded-lg` | `rounded-golden-md` |
| `rounded-xl`, `rounded-2xl` | `rounded-golden-lg` |
| `rounded-full` (pills/avatars) | keep as-is |

New shared components (like `QuantityStepper`) use the golden tokens directly.

---

## 2. QuantityStepper (shared numeric control)

`components/ui/QuantityStepper.tsx` is the single source of truth for
portion / quantity selection. It replaces bare `<input type="number">` controls
so every flow shares the same touch targets, spacing and radius.

**Design:**
- Layout: `[−] value [+]`.
- Touch target: `h-11 w-11` (44px) on mobile, condensing to `h-9 w-9` (36px) at `≥sm`.
- Radius: `rounded-golden-md` (with matched `rounded-l/r-golden-md` on the buttons).
- Accessible: `role="group"` + `aria-label`, per-button `aria-label`s, and an
  `aria-live` `<output>` announcing the current value. Bounds disable the
  relevant button (`disabled` at `min`/`max`).

**Props:** `value`, `onChange(next)`, `min` (default 1), `max` (default ∞),
`step` (default 1), `ariaLabel`, `decrementLabel`, `incrementLabel`, `disabled`.

**Adopted in:**
- `app/(app)/nutrition/recipes/[id]/RecipeDetailView.tsx` — recipe servings
  (used by both "Add to plan" and "Log meal").
- `components/nutrition/MealPlanModal.tsx` — per-assignment servings.

> Note: `nutrition/log` and the `nutrition` quick-add meal form capture raw
> macros (calories/protein/carbs/fat), not a portion count, so they keep their
> labeled numeric `Input` fields — a stepper does not apply there.
