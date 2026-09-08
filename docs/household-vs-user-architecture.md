# Movive — ¿Modelo familiar (household) o centrado en usuario?

> Análisis de arquitectura para decidir **antes** de tocar Shopping List.
> **No se implementa nada.** Contexto: desarrollo siempre sobre `main`, base
> sólida para el futuro, evitar deuda técnica innecesaria, una sola familia por
> cuenta (sin multi-hogar por ahora).
> Fecha: 2026-08-25

---

## 1. ¿Debería Movive evolucionar hacia household o mantenerse centrado en usuario?

**Recomendación: mantener Movive centrado en el USUARIO como principio general, e
introducir "household" como una capa OPCIONAL y acotada, no como reemplazo de
`user_id`.**

Razón central: la gran mayoría de los datos de Movive son **intrínsecamente
personales** y no tendrían sentido compartidos. Fitness es individual: el peso,
las medidas, las fotos de progreso, los logs de entrenamiento, las sesiones, la
suscripción y el chat con la IA son de cada persona. Reasignar todo eso a un
household sería incorrecto de dominio, no solo costoso.

Household aporta valor **solo en un subconjunto reducido y bien definido** de
funcionalidades (esencialmente las de logística del hogar: comprar y planificar
comidas). Por tanto el modelo correcto no es "user → household", sino:

> **`user` sigue siendo la identidad y el dueño de casi todo; `household` es un
> grupo opcional al que un usuario pertenece, y SOLO unas pocas entidades
> "compartibles" se asocian al household.**

Esto evita el error clásico de "familiarizar" toda la app y cargar con la
complejidad (RLS por pertenencia, atribución, concurrencia) en tablas que nunca
la necesitarán.

---

## 2. Clasificación de las tablas actuales

Inventario real del esquema (`supabase/migrations/00001_initial_schema.sql`),
clasificado por naturaleza del dato:

### A) Estrictamente personales — SIEMPRE `user_id` (NO tocar)
Estos datos no deben compartirse nunca; asociarlos a household sería un error de
dominio y un problema de privacidad.

- `subscriptions` — facturación/plan por persona.
- `weight_entries`, `measurement_entries`, `progress_photos` — progreso corporal.
- `training_sessions`, `session_exercise_logs`, `session_set_logs` — actividad
  de entrenamiento real.
- `meal_logs` — lo que **esta** persona comió (adherencia individual).
- `daily_checkins` — hábitos diarios personales.
- `ai_chat_messages`, `ai_usage` — conversaciones y consumo de IA por usuario.
- `notifications`, `notification_preferences` — canal/preferencias personales.
- `recommendations` — sugerencias personalizadas al individuo.
- `feedback`, `audit_log` — atribuibles a la persona.

### B) Candidatas legítimas a "compartibles" por household
Aquí es donde household aporta valor real:

- `shopping_lists` — **el caso de uso que dispara todo esto**; comprar es
  logística del hogar.
- `meal_plans` — planear el menú semanal de la casa tiene sentido familiar
  (aunque el *consumo*, `meal_logs`, sigue siendo individual).
- (Futuro) recetas propias del hogar, despensa/inventario, presupuesto de
  compra — si algún día existen.

### C) Globales / catálogo — sin `user_id`, no aplican a household
- `ingredients`, `recipes`, `recipe_ingredients`, `recipe_instructions`,
  `exercises` — catálogo compartido por toda la plataforma.
- `platform_settings`, `recommendation_rules`, `beta_registrations` — nivel
  plataforma.

### D) Estructura de contenido del usuario (matices)
- `workouts`, `workout_days`, `workout_exercises` — hoy son **plantillas de
  entrenamiento del usuario**. Podrían compartirse en el hogar como "rutina de la
  casa", pero es un nice-to-have débil; recomiendo mantenerlas en `user` por
  ahora.

**Conclusión del inventario:** de ~22 tablas con `user_id`, solo **2** son
candidatas fuertes a household hoy (`shopping_lists`, `meal_plans`). Eso confirma
que household debe ser una **capa acotada**, no un rediseño global.

---

## 3. Funcionalidades futuras que se beneficiarían de household

- **Lista de compras compartida** (el detonante actual).
- **Meal plan familiar**: un menú semanal de la casa que todos ven; cada quien
  registra su propio `meal_log`.
- **Despensa / inventario del hogar** (si se construye): qué hay en casa, qué
  falta → alimenta la lista de compras.
- **Presupuesto/gasto de compra** del hogar (fuera de Alpha, pero encaja).
- **"Cocinero de la semana" / asignación de tareas** de compra.
- **Recetas propias del hogar** (colección familiar sobre el catálogo global).

Nota: **NO** se benefician (y no deben moverse): progreso corporal, sesiones de
gym, suscripción, IA, notificaciones. Son y seguirán siendo individuales.

---

## 4. Qué tablas deberían asociarse a household (si se adopta)

Diseño recomendado — **aditivo, no destructivo**:

1. Tablas nuevas:
   - `households (id, name, created_by, created_at)`
   - `household_members (household_id, user_id, role, created_at)`
     con **una fila por usuario** (una familia por cuenta = un usuario pertenece
     a un household).
2. En las tablas **compartibles**, añadir `household_id` **sin quitar `user_id`**:
   - `shopping_lists.household_id` (nullable al inicio; `user_id` = quién la creó).
   - `meal_plans.household_id` (opcional/segunda fase).
3. **RLS** de esas tablas pasa de `auth.uid() = user_id` a "pertenezco al
   household" (`EXISTS (select 1 from household_members ...)`), conservando el
   fallback por `user_id` durante la transición.
4. Todo lo demás (grupo A) **permanece igual con `user_id`**.

Clave de diseño para no generar deuda: **añadir `household_id`, no reemplazar
`user_id`.** Así una tabla puede ser "propiedad del usuario que la creó" y
"visible por el hogar" a la vez, y revertir es trivial.

---

## 5. ¿Qué tan costosa sería una migración futura si NO lo hacemos ahora?

Esta es la pregunta decisiva para la deuda técnica. Desglose por escenario:

### Costo de migrar MÁS ADELANTE solo lo compartible (shopping_lists, meal_plans)
**Bajo–moderado, y NO aumenta significativamente con el tiempo.** Migrar dos
tablas a household luego consiste en: crear `households`/`household_members`,
`ALTER TABLE ... ADD COLUMN household_id`, un backfill (un household por usuario
existente + set `household_id`), y reescribir sus RLS. Es exactamente el mismo
trabajo hoy que en seis meses; el volumen de esas dos tablas es pequeño y su
esquema es simple. **No se abarata haciéndolo ahora.**

### Costo de haber "familiarizado" TODO ahora y arrepentirse
**Alto.** Si hoy metiéramos `household_id` en tablas personales (progreso, gym,
IA…), tendríamos que mantener RLS complejas, atribución y concurrencia en sitios
que nunca lo necesitan — deuda pura. Revertirlo después es caro.

### El costo real que sí crece con el tiempo (el único que importa adelantar)
El **`shopping_lists` basado en blob JSON**. Mientras siga siendo un array JSON
reescrito entero:
- Cada mejora (categorías, edición, atribución, compartir) se apila sobre un
  modelo frágil (last-write-wins, sin filas).
- El backfill futuro (JSON → filas + household) crece con la cantidad de listas y
  con cada campo nuevo que metamos al JSON.

**Conclusión de costo:** lo caro de posponer **no es el household en sí**, sino
**seguir construyendo sobre el blob JSON**. Household se puede añadir después casi
al mismo costo; el blob, cuanto más se le construye encima, más caro es migrarlo.

---

## 6. Recomendación final (para desarrollo continuo sobre `main`)

**Adoptar un enfoque "user-first, household-opt-in y acotado", y ordenar el
trabajo así:**

1. **Primero, sin household**, resolver la base de datos de Shopping List:
   migrar de **blob JSON → filas `shopping_list_items`** (con `qty`+`unit`
   estructurados y `category`), manteniendo `user_id`. Esto elimina la deuda que
   **sí** crece con el tiempo y deja una base sólida. RLS `own` por ahora.
2. **Introducir `households` + `household_members`** (una familia por cuenta) y
   **añadir `household_id` (nullable)** a `shopping_list_items` (y luego
   `meal_plans`), con backfill "un household por usuario". RLS pasa a pertenencia.
   Como el modelo ya es por filas, este paso es incremental y de bajo riesgo.
3. **NO** asociar a household ninguna tabla del grupo A (personales). Se quedan
   en `user_id` de forma permanente.
4. `meal_plans` a household: **segunda fase**, cuando Shopping List familiar esté
   validada.

**Por qué esta secuencia evita deuda:**
- Ataca primero lo único cuyo costo de migración **crece** (el blob JSON).
- Household queda como capa aditiva (`household_id` junto a `user_id`), reversible
  y de costo estable en el tiempo → **no hay penalización por no hacerlo ahora**.
- Mantiene la corrección de dominio: lo personal sigue personal.

### Decisión concreta que habilita este documento
- **Sí** evolucionamos hacia household, pero **solo para `shopping_lists` (y
  luego `meal_plans`)**, no para toda la app.
- **El primer paso a implementar (cuando apruebes) NO es household**, es
  **migrar Shopping List a filas** — porque es la deuda que se encarece si se
  pospone. Household viene inmediatamente después, como capa aditiva.

> Próximo paso sugerido: aprobar la migración de `shopping_lists` a
> `shopping_list_items` (filas + qty/unit/category, RLS `own`) como base, y a
> continuación la capa `households`. Ambas se entregarían como migraciones
> `00014+` con su aprobación, siguiendo el flujo de `unit_weight`.
