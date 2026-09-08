# Performance Audit — Backlog Técnico (Cierre)

> **Estado:** Auditoría cerrada. Fases 1, 2 y 3 completadas y en `main`.
> **Política:** No se implementarán más cambios de performance hasta contar con
> métricas reales de uso o un problema concreto reportado por usuarios.
> **Fecha de cierre:** 2026-08-25

Este documento consolida los hallazgos pendientes de la auditoría de performance
de Movive tras las Fases 1-3, para consulta futura. Sirve como backlog priorizado:
si en algún momento las métricas de uso o un reporte de usuario lo justifican, aquí
está el análisis técnico listo para retomar.

---

## Resumen: qué se optimizó (Fases 1-3, ya en `main`)

| Métrica | Estado inicial | Estado actual |
|---|---|---|
| Pantallas en Server Component | 0 | 4 (dashboard, recetas listado+detalle, exercises) |
| Dashboard: queries de carga | ~11 secuenciales | 1 `Promise.all(9)` + dedup weight_entries (3×→1) |
| Nutrition / Workouts / Calendar | 0 `Promise.all` | parallelizadas (1 batch c/u) |
| `next/image` | 1 | 3 (recetas listado+detalle con `priority` en LCP) |
| Lazy loading en grids | No | Sí |
| N+1 en "Usar plantilla" (workouts) | Sí | Resuelto (2 inserts batch) |
| Build | 70/70 páginas | 70/70 páginas |
| Lint (baseline) | 97 problemas | 91 problemas |

**Conclusión de la auditoría:** se capturó la mayor parte del ROI de bajo riesgo.
Las conversiones arquitectónicas restantes (RSC de Dashboard/Calendar/Meal-Planner)
tienen beneficio marginal decreciente y riesgo creciente. **No se recomienda continuar
sin evidencia de un problema real.**

---

## Backlog técnico pendiente

### 1. Meal-Planner — carga con queries secuenciales y `getUser()` duplicado

**Archivo:** `app/(app)/nutrition/meal-planner/page.tsx`

**Hallazgo:**
- Dos `useEffect` de carga (`loadRecipes` ~L254, `loadWeek` ~L283) arrancan en
  paralelo, pero **cada uno ejecuta su propio `supabase.auth.getUser()`** antes de
  su query real → `getUser()` se llama **2 veces** en el arranque y cada query espera
  a su propio `getUser()`. Son 2 waterfalls de 2 saltos en vez de un batch.
- En total el módulo tiene ~14 `await supabase` secuenciales y **0 `Promise.all`**.

**Propuesta (si se retoma):**
- Unificar la obtención del usuario en un solo `getUser()` compartido.
- Agrupar `recipes` + `meal_plans(semana)` en un único `Promise.all`.
- **NO** convertir a RSC-shell completo: el módulo es mutation-heavy (autosave,
  edición semanal, duplicación) y el riesgo de romper el autosave supera el beneficio.

**Valoración:** Impacto Alto · Complejidad Media · Riesgo Medio · ~2h
**Riesgo funcional a vigilar:** el flujo de autosave (`savePlan`) y la navegación
semana-a-semana dependen del mismo `getUser()`; cualquier cambio debe preservar que
un plan ya guardado no se degrade a borrador por un auto-save.

---

### 2. Meal-Planner — `handleDuplicateWeek`: loop de hasta 52 queries (N+1)

**Archivo:** `app/(app)/nutrition/meal-planner/page.tsx` (~L531-590)

**Hallazgo:** al duplicar una semana, se busca la primera semana vacía con un
`for (i < 52)` que ejecuta **un `SELECT` a `meal_plans` por iteración** → hasta 52
round-trips secuenciales en una sola acción de usuario.

**Propuesta (si se retoma):** reemplazar el loop por un único `SELECT` con rango de
fechas (52 semanas hacia adelante) y resolver la primera semana vacía en memoria.

**Valoración:** Impacto Medio (solo al duplicar) · Complejidad Baja-Media · Riesgo Bajo-Medio · ~1h

---

### 3. Imágenes crudas `<img>` en Meal-Planner y Nutrition

**Archivos:** `app/(app)/nutrition/meal-planner/page.tsx`, `app/(app)/nutrition/page.tsx`

**Hallazgo:** siguen usando `<img>` en lugar de `next/image`, por lo que no se
benefician de AVIF/WebP ni del sizing responsive. La configuración de imágenes
(`next.config.ts`: AVIF/WebP + `remotePatterns` para Supabase Storage) ya está lista
desde la Fase 2, así que la migración sería directa.

**Valoración:** Impacto Medio-Bajo · Complejidad Baja · Riesgo Bajo · ~45min

---

### 4. Progress Photos — almacenamiento en base64 (data URLs)

**Archivos:** `app/(app)/progress/photos/*`

**Hallazgo:** las fotos de progreso se guardan como data URLs base64
(`readAsDataURL`). Esto genera payloads pesados y **`next/image` no puede optimizar
data URLs**, por lo que quedan como `<img>` con lazy loading.

**Propuesta (si se retoma):** migrar a Supabase Storage y servir URLs públicas
optimizables por `next/image`.

**Valoración:** Impacto Alto (payload) · Complejidad Alta · **Riesgo Alto**
**⚠️ Requiere aprobación explícita del usuario:** toca datos de usuario y exige una
migración de datos. Excluido del alcance de esta auditoría por decisión del usuario.

---

### 5. Nutrition / Workouts / Calendar — aún client-fetched (spinner)

**Archivos:** `app/(app)/nutrition/page.tsx`, `app/(app)/workouts/page.tsx`, `app/(app)/calendar/page.tsx`

**Hallazgo:** ya están parallelizadas (1 `Promise.all` c/u), pero el fetch ocurre en
cliente con spinner. Un RSC-shell eliminaría el spinner y adelantaría el contenido.

**Propuesta (si se retoma):** RSC-shell por pantalla. **Baja prioridad:** el ROI es
menor tras la paralelización y Calendar (14 `.from()`) / Nutrition tienen bastante
estado interactivo.

**Valoración:** Impacto Medio · Complejidad Media · Riesgo Medio · ~2-3h c/u

---

## Recomendación de priorización (para cuando se retome)

Si en el futuro las métricas justifican retomar, el orden por ROI/riesgo sería:

1. **Meal-Planner: unificar `getUser()` + `Promise.all`** (quick-win quirúrgico, no RSC completo).
2. **`handleDuplicateWeek`: loop 52 → 1 query.**
3. **`<img>` → `next/image`** en meal-planner/nutrition.
4. (Con aprobación) **Progress Photos → Supabase Storage.**
5. RSC-shell de Nutrition/Workouts/Calendar — solo si hay evidencia de lentitud percibida.

**Explícitamente NO recomendado sin evidencia:** convertir Dashboard a RSC (ya está
en Server Component + parallelizado; beneficio marginal, riesgo alto por el tamaño de
`DashboardContent`).
