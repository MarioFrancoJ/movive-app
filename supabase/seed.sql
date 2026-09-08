-- ============================================================================
-- Movive — Seed Data
-- Date: 2026-08-25
-- Purpose: Populate reference data and system templates
-- Idempotent: Safe to run multiple times (ON CONFLICT used throughout)
-- Order: Respects FK constraints
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════════
-- EXECUTION ORDER:
-- 1. Ingredients (no FK dependencies)
-- 2. Exercises (no FK dependencies)
-- 3. Recipes → Recipe Ingredients → Recipe Instructions
-- 4. Workouts → Workout Days → Workout Exercises
-- 5. Recommendation Rules (no FK dependencies)
-- 6. Platform Settings (no FK dependencies)
-- 7. Super Admin Bootstrap
-- ════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════════
-- 1. INGREDIENTS (50 items)
-- Categories: Protein, Carbohydrate, Fat, Vegetable, Fruit, Dairy, Beverage, Other
-- Values: realistic per 100g, common foods available in Colombia
-- ════════════════════════════════════════════════════════════════════════════════

INSERT INTO ingredients (id, name, category, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, unit)
VALUES
  -- Protein (10)
  ('a0000001-0000-0000-0000-000000000001', 'Pechuga de Pollo', 'Protein', 165, 31.0, 0.0, 3.6, 'g'),
  ('a0000001-0000-0000-0000-000000000002', 'Huevo Entero', 'Protein', 155, 13.0, 1.1, 11.0, 'unit'),
  ('a0000001-0000-0000-0000-000000000003', 'Salmón', 'Protein', 208, 20.0, 0.0, 13.0, 'g'),
  ('a0000001-0000-0000-0000-000000000004', 'Carne Molida Magra', 'Protein', 250, 26.0, 0.0, 15.0, 'g'),
  ('a0000001-0000-0000-0000-000000000005', 'Atún Enlatado', 'Protein', 116, 26.0, 0.0, 1.0, 'g'),
  ('a0000001-0000-0000-0000-000000000006', 'Camarón', 'Protein', 99, 24.0, 0.2, 0.3, 'g'),
  ('a0000001-0000-0000-0000-000000000007', 'Pechuga de Pavo', 'Protein', 135, 30.0, 0.0, 1.0, 'g'),
  ('a0000001-0000-0000-0000-000000000008', 'Tofu Firme', 'Protein', 76, 8.0, 1.9, 4.8, 'g'),
  ('a0000001-0000-0000-0000-000000000009', 'Trucha', 'Protein', 141, 20.0, 0.0, 6.6, 'g'),
  ('a0000001-0000-0000-0000-000000000010', 'Lomo de Cerdo', 'Protein', 143, 26.0, 0.0, 3.5, 'g'),

  -- Carbohydrate (8)
  ('a0000001-0000-0000-0000-000000000011', 'Arroz Blanco', 'Carbohydrate', 130, 2.7, 28.0, 0.3, 'g'),
  ('a0000001-0000-0000-0000-000000000012', 'Avena en Hojuelas', 'Carbohydrate', 389, 16.9, 66.0, 6.9, 'g'),
  ('a0000001-0000-0000-0000-000000000013', 'Papa', 'Carbohydrate', 77, 2.0, 17.0, 0.1, 'g'),
  ('a0000001-0000-0000-0000-000000000014', 'Plátano Maduro', 'Carbohydrate', 122, 1.3, 32.0, 0.4, 'g'),
  ('a0000001-0000-0000-0000-000000000015', 'Yuca', 'Carbohydrate', 160, 1.4, 38.0, 0.3, 'g'),
  ('a0000001-0000-0000-0000-000000000016', 'Pan Integral', 'Carbohydrate', 247, 13.0, 41.0, 3.4, 'g'),
  ('a0000001-0000-0000-0000-000000000017', 'Pasta Integral', 'Carbohydrate', 124, 5.3, 25.0, 0.5, 'g'),
  ('a0000001-0000-0000-0000-000000000018', 'Arepa de Maíz', 'Carbohydrate', 199, 4.0, 43.0, 1.0, 'g'),

  -- Fat (6)
  ('a0000001-0000-0000-0000-000000000019', 'Aguacate', 'Fat', 160, 2.0, 8.5, 14.7, 'g'),
  ('a0000001-0000-0000-0000-000000000020', 'Aceite de Oliva', 'Fat', 884, 0.0, 0.0, 100.0, 'ml'),
  ('a0000001-0000-0000-0000-000000000021', 'Maní', 'Fat', 567, 26.0, 16.0, 49.0, 'g'),
  ('a0000001-0000-0000-0000-000000000022', 'Almendras', 'Fat', 579, 21.0, 22.0, 49.0, 'g'),
  ('a0000001-0000-0000-0000-000000000023', 'Mantequilla de Maní', 'Fat', 588, 25.0, 20.0, 50.0, 'g'),
  ('a0000001-0000-0000-0000-000000000024', 'Semillas de Chía', 'Fat', 486, 17.0, 42.0, 31.0, 'g'),

  -- Vegetable (8)
  ('a0000001-0000-0000-0000-000000000025', 'Espinaca', 'Vegetable', 23, 2.9, 3.6, 0.4, 'g'),
  ('a0000001-0000-0000-0000-000000000026', 'Brócoli', 'Vegetable', 34, 2.8, 7.0, 0.4, 'g'),
  ('a0000001-0000-0000-0000-000000000027', 'Tomate', 'Vegetable', 18, 0.9, 3.9, 0.2, 'g'),
  ('a0000001-0000-0000-0000-000000000028', 'Cebolla', 'Vegetable', 40, 1.1, 9.3, 0.1, 'g'),
  ('a0000001-0000-0000-0000-000000000029', 'Pimentón Rojo', 'Vegetable', 31, 1.0, 6.0, 0.3, 'g'),
  ('a0000001-0000-0000-0000-000000000030', 'Zanahoria', 'Vegetable', 41, 0.9, 10.0, 0.2, 'g'),
  ('a0000001-0000-0000-0000-000000000031', 'Lechuga', 'Vegetable', 15, 1.4, 2.9, 0.2, 'g'),
  ('a0000001-0000-0000-0000-000000000032', 'Pepino', 'Vegetable', 16, 0.7, 3.6, 0.1, 'g'),

  -- Fruit (6)
  ('a0000001-0000-0000-0000-000000000033', 'Banano', 'Fruit', 89, 1.1, 23.0, 0.3, 'g'),
  ('a0000001-0000-0000-0000-000000000034', 'Mango', 'Fruit', 60, 0.8, 15.0, 0.4, 'g'),
  ('a0000001-0000-0000-0000-000000000035', 'Fresas', 'Fruit', 32, 0.7, 7.7, 0.3, 'g'),
  ('a0000001-0000-0000-0000-000000000036', 'Maracuyá', 'Fruit', 97, 2.2, 23.0, 0.7, 'g'),
  ('a0000001-0000-0000-0000-000000000037', 'Guayaba', 'Fruit', 68, 2.6, 14.0, 1.0, 'g'),
  ('a0000001-0000-0000-0000-000000000038', 'Piña', 'Fruit', 50, 0.5, 13.0, 0.1, 'g'),

  -- Dairy (6)
  ('a0000001-0000-0000-0000-000000000039', 'Yogur Griego', 'Dairy', 59, 10.0, 3.6, 0.7, 'g'),
  ('a0000001-0000-0000-0000-000000000040', 'Queso Campesino', 'Dairy', 313, 21.0, 1.3, 25.0, 'g'),
  ('a0000001-0000-0000-0000-000000000041', 'Leche Entera', 'Dairy', 61, 3.2, 4.8, 3.3, 'ml'),
  ('a0000001-0000-0000-0000-000000000042', 'Queso Cottage', 'Dairy', 98, 11.0, 3.4, 4.3, 'g'),
  ('a0000001-0000-0000-0000-000000000043', 'Leche de Almendras', 'Dairy', 17, 0.4, 2.5, 0.6, 'ml'),
  ('a0000001-0000-0000-0000-000000000044', 'Whey Protein', 'Dairy', 400, 80.0, 8.0, 6.0, 'g'),

  -- Beverage (3)
  ('a0000001-0000-0000-0000-000000000045', 'Café Negro', 'Beverage', 2, 0.1, 0.0, 0.0, 'ml'),
  ('a0000001-0000-0000-0000-000000000046', 'Agua de Panela', 'Beverage', 40, 0.0, 10.0, 0.0, 'ml'),
  ('a0000001-0000-0000-0000-000000000047', 'Jugo de Naranja Natural', 'Beverage', 45, 0.7, 10.4, 0.2, 'ml'),

  -- Other (3)
  ('a0000001-0000-0000-0000-000000000048', 'Miel', 'Other', 304, 0.3, 82.0, 0.0, 'g'),
  ('a0000001-0000-0000-0000-000000000049', 'Chocolate Oscuro 70%', 'Other', 598, 7.8, 46.0, 43.0, 'g'),
  ('a0000001-0000-0000-0000-000000000050', 'Linaza Molida', 'Other', 534, 18.0, 29.0, 42.0, 'g')
ON CONFLICT (id) DO NOTHING;

-- unit_weight (grams per unit) for non-gram ingredients (unit/volume → grams). See migration 00013.
UPDATE ingredients SET unit_weight = 50   WHERE id = 'a0000001-0000-0000-0000-000000000002'; -- Huevo Entero (unit)
UPDATE ingredients SET unit_weight = 0.91 WHERE id = 'a0000001-0000-0000-0000-000000000020'; -- Aceite de Oliva (ml)
UPDATE ingredients SET unit_weight = 1.03 WHERE id = 'a0000001-0000-0000-0000-000000000041'; -- Leche Entera (ml)
UPDATE ingredients SET unit_weight = 1.00 WHERE unit = 'ml' AND unit_weight IS NULL;         -- other water-like liquids

-- ════════════════════════════════════════════════════════════════════════════════
-- 2. EXERCISES (50 items)
-- ════════════════════════════════════════════════════════════════════════════════

INSERT INTO exercises (id, name, description, category, muscle_group, equipment, difficulty, instructions, tips, common_mistakes)
VALUES
  -- Strength (15)
  ('b0000001-0000-0000-0000-000000000001', 'Barbell Bench Press', 'Compound chest pressing movement using a barbell on a flat bench.', 'Strength', 'Chest', 'Barbell', 'Intermediate',
    '["Lie flat on bench with feet on floor", "Grip barbell slightly wider than shoulder-width", "Unrack and lower bar to mid-chest", "Press bar up until arms are extended"]',
    '["Keep shoulder blades retracted", "Drive feet into floor for stability"]',
    '["Flaring elbows to 90 degrees", "Bouncing bar off chest", "Lifting hips off bench"]'),
  ('b0000001-0000-0000-0000-000000000002', 'Incline Dumbbell Press', 'Upper chest focused pressing on an inclined bench.', 'Strength', 'Chest', 'Dumbbells', 'Intermediate',
    '["Set bench to 30-45 degrees", "Hold dumbbells at shoulder level", "Press up and slightly inward", "Lower with control"]',
    '["Do not set bench too high", "Control the negative phase"]',
    '["Bench angle too steep", "Not controlling descent"]'),
  ('b0000001-0000-0000-0000-000000000003', 'Deadlift', 'Full body compound lift pulling a barbell from the floor.', 'Strength', 'Back', 'Barbell', 'Advanced',
    '["Stand with feet hip-width, bar over mid-foot", "Hinge at hips, grip bar outside knees", "Brace core, drive through legs", "Stand tall, lock hips at top"]',
    '["Keep bar close to body", "Engage lats before pulling"]',
    '["Rounding lower back", "Bar drifting forward", "Jerking the weight"]'),
  ('b0000001-0000-0000-0000-000000000004', 'Barbell Squat', 'Compound lower body exercise with barbell on upper back.', 'Strength', 'Quadriceps', 'Barbell', 'Advanced',
    '["Unrack bar on upper traps", "Step back, feet shoulder-width", "Squat down until thighs parallel", "Drive up through heels"]',
    '["Keep chest up throughout", "Push knees out over toes"]',
    '["Knees caving inward", "Rising on toes", "Leaning too far forward"]'),
  ('b0000001-0000-0000-0000-000000000005', 'Overhead Press', 'Standing barbell press for shoulder development.', 'Strength', 'Shoulders', 'Barbell', 'Intermediate',
    '["Stand with feet hip-width", "Clean bar to front shoulders", "Press overhead until lockout", "Lower with control to shoulders"]',
    '["Squeeze glutes for stability", "Tuck chin as bar passes face"]',
    '["Excessive back arch", "Pressing in front of face instead of overhead"]'),
  ('b0000001-0000-0000-0000-000000000006', 'Barbell Row', 'Compound pulling movement for back thickness.', 'Strength', 'Back', 'Barbell', 'Intermediate',
    '["Hinge forward at 45 degrees", "Grip bar shoulder-width", "Pull bar to lower chest/upper abs", "Squeeze shoulder blades at top"]',
    '["Keep core braced throughout", "Initiate pull with elbows"]',
    '["Using too much momentum", "Rounding upper back", "Standing too upright"]'),
  ('b0000001-0000-0000-0000-000000000007', 'Romanian Deadlift', 'Hip-hinge movement targeting hamstrings and glutes.', 'Strength', 'Hamstrings', 'Barbell', 'Intermediate',
    '["Hold bar at hip height", "Push hips back, slight knee bend", "Lower bar along legs until stretch felt", "Drive hips forward to stand"]',
    '["Keep bar close to legs", "Feel stretch in hamstrings"]',
    '["Rounding lower back", "Bending knees too much", "Looking up"]'),
  ('b0000001-0000-0000-0000-000000000008', 'Leg Press', 'Machine-based quad-dominant pressing movement.', 'Strength', 'Quadriceps', 'Machine', 'Beginner',
    '["Sit in machine with back flat", "Place feet shoulder-width on platform", "Lower weight until 90-degree knee angle", "Press up without locking knees"]',
    '["Do not lock knees at top", "Keep lower back pressed into pad"]',
    '["Letting hips rise off pad", "Locking knees", "Too narrow foot placement"]'),
  ('b0000001-0000-0000-0000-000000000009', 'Dumbbell Lateral Raise', 'Isolation exercise for lateral deltoid.', 'Strength', 'Shoulders', 'Dumbbells', 'Beginner',
    '["Stand with dumbbells at sides", "Raise arms to shoulder height", "Lead with elbows slightly", "Lower with control"]',
    '["Use lighter weight with strict form", "Slight forward lean helps target lateral head"]',
    '["Using momentum", "Raising above shoulder height", "Shrugging traps"]'),
  ('b0000001-0000-0000-0000-000000000010', 'Barbell Curl', 'Bicep isolation exercise with barbell.', 'Strength', 'Biceps', 'Barbell', 'Beginner',
    '["Stand with shoulder-width grip", "Curl bar up keeping elbows fixed", "Squeeze biceps at top", "Lower with control"]',
    '["Keep elbows at your sides", "Full range of motion"]',
    '["Swinging body", "Moving elbows forward", "Partial reps"]'),
  ('b0000001-0000-0000-0000-000000000011', 'Skull Crusher', 'Tricep isolation using barbell or EZ bar.', 'Strength', 'Triceps', 'Barbell', 'Intermediate',
    '["Lie on bench holding bar above chest", "Lower bar to forehead by bending elbows", "Extend arms back to start", "Keep upper arms stationary"]',
    '["Angle arms slightly back for constant tension", "Use EZ bar for wrist comfort"]',
    '["Flaring elbows", "Moving upper arms", "Going too heavy"]'),
  ('b0000001-0000-0000-0000-000000000012', 'Walking Lunge', 'Unilateral lower body exercise.', 'Strength', 'Quadriceps', 'Dumbbells', 'Beginner',
    '["Hold dumbbells at sides", "Step forward into lunge", "Lower until back knee nearly touches floor", "Drive through front foot to next step"]',
    '["Keep torso upright", "Take controlled steps"]',
    '["Knee going past toes", "Leaning forward", "Steps too short"]'),
  ('b0000001-0000-0000-0000-000000000013', 'Cable Fly', 'Chest isolation using cable machine.', 'Strength', 'Chest', 'Machine', 'Beginner',
    '["Set cables at chest height", "Step forward with slight lean", "Bring hands together in arc motion", "Squeeze chest at center"]',
    '["Maintain slight elbow bend", "Focus on squeezing chest"]',
    '["Using too much weight", "Straightening arms completely"]'),
  ('b0000001-0000-0000-0000-000000000014', 'Hip Thrust', 'Glute-focused hip extension exercise.', 'Strength', 'Glutes', 'Barbell', 'Intermediate',
    '["Sit with upper back against bench", "Roll barbell over hips", "Drive hips up until body is straight", "Squeeze glutes at top"]',
    '["Chin tucked throughout", "Drive through heels"]',
    '["Hyperextending lower back", "Not reaching full hip extension"]'),
  ('b0000001-0000-0000-0000-000000000015', 'Calf Raise', 'Isolated calf development exercise.', 'Strength', 'Calves', 'Machine', 'Beginner',
    '["Stand on edge of step/machine", "Lower heels below platform", "Rise up on toes as high as possible", "Hold peak contraction"]',
    '["Full range of motion is key", "Pause at top and bottom"]',
    '["Bouncing at bottom", "Partial range of motion", "Going too fast"]'),

  -- Calisthenics (20)
  ('b0000001-0000-0000-0000-000000000016', 'Push-Up', 'Fundamental bodyweight pressing movement.', 'Calisthenics', 'Chest', 'None', 'Beginner',
    '["Place hands shoulder-width apart", "Body straight from head to heels", "Lower chest to floor", "Push back up to full extension"]',
    '["Engage core throughout", "Elbows at 45-degree angle"]',
    '["Sagging hips", "Flaring elbows", "Partial range of motion"]'),
  ('b0000001-0000-0000-0000-000000000017', 'Pull-Up', 'Upper body pulling with overhand grip.', 'Calisthenics', 'Back', 'Pull-Up Bar', 'Intermediate',
    '["Hang with overhand grip slightly wider than shoulders", "Pull up until chin clears bar", "Lower with control to full hang", "Avoid kipping"]',
    '["Initiate with shoulder blades", "Think about pulling elbows down"]',
    '["Kipping or swinging", "Not reaching full hang", "Chin not clearing bar"]'),
  ('b0000001-0000-0000-0000-000000000018', 'Chin-Up', 'Upper body pulling with underhand grip.', 'Calisthenics', 'Back', 'Pull-Up Bar', 'Intermediate',
    '["Hang with underhand grip shoulder-width", "Pull up until chin clears bar", "Lower with full control", "Full dead hang at bottom"]',
    '["Squeeze biceps at top", "Supinated grip engages biceps more"]',
    '["Using momentum", "Half reps", "Not going to full extension"]'),
  ('b0000001-0000-0000-0000-000000000019', 'Dip', 'Compound pressing for chest and triceps.', 'Calisthenics', 'Chest', 'Pull-Up Bar', 'Intermediate',
    '["Grip parallel bars, arms straight", "Lean slightly forward for chest focus", "Lower until shoulders below elbows", "Press back up to lockout"]',
    '["Control the descent", "Lean forward for chest, upright for triceps"]',
    '["Going too deep too soon", "Flaring elbows excessively"]'),
  ('b0000001-0000-0000-0000-000000000020', 'Muscle-Up', 'Advanced transition from pull to push above the bar.', 'Calisthenics', 'Back', 'Pull-Up Bar', 'Advanced',
    '["Start in dead hang", "Pull explosively aiming for chest to bar", "Transition over the bar with wrist rotation", "Press out to support position"]',
    '["Master high pull-ups first", "Practice transition on low bar"]',
    '["Relying on kip only", "Not pulling high enough", "Chicken winging"]'),
  ('b0000001-0000-0000-0000-000000000021', 'Handstand Push-Up', 'Overhead pressing in inverted position.', 'Calisthenics', 'Shoulders', 'None', 'Advanced',
    '["Kick up to wall handstand", "Lower head toward floor with control", "Press back up to full lockout", "Keep core tight throughout"]',
    '["Start with wall-supported", "Use deficit for full ROM"]',
    '["Arching back", "Elbows flaring", "Not controlling descent"]'),
  ('b0000001-0000-0000-0000-000000000022', 'Pike Push-Up', 'Shoulder-focused push-up variation.', 'Calisthenics', 'Shoulders', 'None', 'Beginner',
    '["Form inverted V with hips high", "Lower head between hands toward floor", "Press back up", "Keep legs as straight as possible"]',
    '["Elevate feet for more difficulty", "Progression toward handstand push-up"]',
    '["Hips dropping", "Elbows flaring wide"]'),
  ('b0000001-0000-0000-0000-000000000023', 'Pistol Squat', 'Single-leg squat requiring strength and balance.', 'Calisthenics', 'Quadriceps', 'None', 'Advanced',
    '["Stand on one leg", "Extend other leg forward", "Squat down to full depth", "Stand back up without touching floor"]',
    '["Use counterbalance (arms forward)", "Start with assisted version"]',
    '["Knee caving inward", "Losing balance", "Not reaching full depth"]'),
  ('b0000001-0000-0000-0000-000000000024', 'Plank', 'Core stabilization hold.', 'Calisthenics', 'Core', 'None', 'Beginner',
    '["Forearms on floor, elbows under shoulders", "Body straight from head to heels", "Engage core, squeeze glutes", "Hold position breathing normally"]',
    '["Think about pulling elbows to toes", "Dont hold breath"]',
    '["Hips sagging", "Hips too high", "Looking up"]'),
  ('b0000001-0000-0000-0000-000000000025', 'Hollow Hold', 'Gymnastic core position for full-body tension.', 'Calisthenics', 'Core', 'None', 'Intermediate',
    '["Lie on back", "Press lower back into floor", "Lift legs and shoulders off ground", "Arms extended overhead or at sides"]',
    '["Lower back must stay flat", "Regress by bending knees"]',
    '["Lower back arching off floor", "Holding breath", "Neck strain"]'),
  ('b0000001-0000-0000-0000-000000000026', 'L-Sit', 'Isometric hold with legs parallel to floor.', 'Calisthenics', 'Core', 'Pull-Up Bar', 'Advanced',
    '["Support on parallel bars or floor", "Lift legs until parallel to floor", "Lock out arms completely", "Hold position with pointed toes"]',
    '["Start with tucked L-sit", "Compress hips actively"]',
    '["Bending arms", "Legs dropping", "Rounding shoulders forward"]'),
  ('b0000001-0000-0000-0000-000000000027', 'Handstand Hold', 'Inverted balance position.', 'Calisthenics', 'Shoulders', 'None', 'Intermediate',
    '["Kick up to wall handstand or freestanding", "Stack wrists over shoulders over hips", "Fingers spread for balance", "Engage core and point toes"]',
    '["Practice against wall first", "Focus on wrist balance corrections"]',
    '["Banana back", "Not engaging core", "Looking at floor"]'),
  ('b0000001-0000-0000-0000-000000000028', 'Front Lever Tuck Hold', 'Progression toward front lever.', 'Calisthenics', 'Back', 'Pull-Up Bar', 'Intermediate',
    '["Hang from bar", "Pull body up and horizontal", "Tuck knees to chest while horizontal", "Hold with straight arms"]',
    '["Depress scapula actively", "Keep arms completely straight"]',
    '["Bending arms", "Hips dropping", "Not engaging lats"]'),
  ('b0000001-0000-0000-0000-000000000029', 'Front Lever Raise', 'Dynamic front lever movement.', 'Calisthenics', 'Back', 'Pull-Up Bar', 'Advanced',
    '["Hang from bar with straight arms", "Raise body to horizontal position", "Hold briefly at top", "Lower with control"]',
    '["Master tuck hold first", "Progress through single-leg variations"]',
    '["Bending arms during raise", "Using momentum"]'),
  ('b0000001-0000-0000-0000-000000000030', 'Back Lever Hold', 'Inverted horizontal hold behind the bar.', 'Calisthenics', 'Shoulders', 'Pull-Up Bar', 'Advanced',
    '["Start in inverted hang (skin the cat position)", "Lower body to horizontal behind bar", "Arms straight, body flat", "Hold position"]',
    '["Start with tuck variation", "German hang flexibility helps"]',
    '["Bending arms", "Shoulders not rotated enough", "Hips piking"]'),
  ('b0000001-0000-0000-0000-000000000031', 'Diamond Push-Up', 'Tricep-focused push-up variation.', 'Calisthenics', 'Triceps', 'None', 'Beginner',
    '["Hands together forming diamond shape", "Lower chest to hands", "Push back up keeping elbows close", "Full lockout at top"]',
    '["Keep elbows tracking backward", "Engage triceps at lockout"]',
    '["Elbows flaring out", "Incomplete range of motion"]'),
  ('b0000001-0000-0000-0000-000000000032', 'Australian Pull-Up', 'Horizontal rowing movement using a low bar.', 'Calisthenics', 'Back', 'Pull-Up Bar', 'Beginner',
    '["Set bar at waist height", "Hang underneath with straight body", "Pull chest to bar", "Lower with control"]',
    '["Elevate feet for more difficulty", "Great pull-up progression"]',
    '["Hips sagging", "Not pulling to chest", "Using momentum"]'),
  ('b0000001-0000-0000-0000-000000000033', 'Muscle-Up Transition Drill', 'Skill work for muscle-up transition phase.', 'Calisthenics', 'Back', 'Pull-Up Bar', 'Intermediate',
    '["Use low bar at chest height", "Jump into transition position", "Practice rolling wrists over bar", "Press out to support"]',
    '["Focus on wrist rotation timing", "Keep bar close to body"]',
    '["Bar too far from body", "Not committing to transition"]'),
  ('b0000001-0000-0000-0000-000000000034', 'Tuck Front Lever Pull-Up', 'Pull-up in tucked front lever position.', 'Calisthenics', 'Back', 'Pull-Up Bar', 'Advanced',
    '["Assume tuck front lever position", "Pull body toward bar maintaining position", "Lower back to start", "Keep arms working, not swinging"]',
    '["Maintain horizontal body throughout", "Scapula depression is key"]',
    '["Losing horizontal position", "Using momentum"]'),
  ('b0000001-0000-0000-0000-000000000035', 'Skin the Cat', 'Shoulder mobility and strength through full rotation.', 'Calisthenics', 'Shoulders', 'Pull-Up Bar', 'Intermediate',
    '["Hang from bar", "Tuck knees and rotate backward through arms", "Extend into German hang position", "Reverse the movement back to hang"]',
    '["Go slowly and controlled", "Build shoulder flexibility gradually"]',
    '["Going too fast", "Not having enough shoulder flexibility"]'),

  -- Cardio (7)
  ('b0000001-0000-0000-0000-000000000036', 'Burpee', 'Full-body conditioning exercise.', 'Cardio', 'Full Body', 'None', 'Intermediate',
    '["Stand, then squat down hands on floor", "Jump feet back to plank", "Perform a push-up", "Jump feet to hands and jump up"]',
    '["Maintain form even when tired", "Scale by removing jump or push-up"]',
    '["Sagging in plank", "Not fully extending on jump"]'),
  ('b0000001-0000-0000-0000-000000000037', 'Mountain Climber', 'Core and cardio combination exercise.', 'Cardio', 'Core', 'None', 'Beginner',
    '["Start in high plank position", "Drive one knee toward chest", "Quickly alternate legs", "Keep hips level throughout"]',
    '["Keep shoulders over wrists", "Speed up for more cardio"]',
    '["Hips bouncing up", "Not driving knees far enough"]'),
  ('b0000001-0000-0000-0000-000000000038', 'Jump Squat', 'Explosive lower body plyometric.', 'Cardio', 'Quadriceps', 'None', 'Beginner',
    '["Squat down to parallel", "Explode upward jumping as high as possible", "Land softly with bent knees", "Immediately descend into next rep"]',
    '["Land quietly", "Use arms for momentum"]',
    '["Landing with straight legs", "Knees caving on landing"]'),
  ('b0000001-0000-0000-0000-000000000039', 'Box Jump', 'Plyometric jumping onto elevated surface.', 'Cardio', 'Quadriceps', 'None', 'Intermediate',
    '["Stand facing box", "Swing arms and jump onto box", "Land softly with both feet", "Stand fully then step down"]',
    '["Start with lower box", "Step down dont jump down"]',
    '["Not opening hips at top", "Jumping down instead of stepping"]'),
  ('b0000001-0000-0000-0000-000000000040', 'Jumping Jacks', 'Basic cardio warmup exercise.', 'Cardio', 'Full Body', 'None', 'Beginner',
    '["Stand with feet together arms at sides", "Jump spreading legs while raising arms overhead", "Jump back to start position", "Maintain rhythm"]',
    '["Keep core engaged", "Land softly on balls of feet"]',
    '["Landing heavily", "Arms not reaching full overhead"]'),
  ('b0000001-0000-0000-0000-000000000041', 'High Knees', 'Running in place with exaggerated knee drive.', 'Cardio', 'Core', 'None', 'Beginner',
    '["Stand tall", "Drive one knee up to hip height", "Quickly alternate legs", "Pump arms in coordination"]',
    '["Stay on balls of feet", "Drive knees as high as possible"]',
    '["Leaning back", "Knees not reaching hip height"]'),
  ('b0000001-0000-0000-0000-000000000042', 'Kettlebell Swing', 'Explosive hip-hinge movement for conditioning.', 'Cardio', 'Glutes', 'Kettlebell', 'Intermediate',
    '["Stand with feet wider than shoulders", "Hinge at hips, swing KB between legs", "Drive hips forward explosively", "Let KB float to chest height"]',
    '["Power comes from hips not arms", "Keep arms relaxed"]',
    '["Squatting instead of hinging", "Using arms to lift", "Rounding back"]'),

  -- Mobility (4)
  ('b0000001-0000-0000-0000-000000000043', 'Deep Squat Hold', 'Ankle and hip mobility through sustained deep squat.', 'Mobility', 'Quadriceps', 'None', 'Beginner',
    '["Squat down as deep as possible", "Heels flat on floor", "Elbows press knees outward", "Hold for time, breathe deeply"]',
    '["Use doorframe for support initially", "Rock side to side gently"]',
    '["Heels coming off floor", "Rounding lower back excessively"]'),
  ('b0000001-0000-0000-0000-000000000044', 'Wall Slides', 'Shoulder mobility exercise against wall.', 'Mobility', 'Shoulders', 'None', 'Beginner',
    '["Stand with back flat against wall", "Arms in W position against wall", "Slide arms up to Y position", "Return to W keeping contact with wall"]',
    '["Keep lower back pressed to wall", "Move slowly with control"]',
    '["Lower back arching", "Arms losing wall contact"]'),
  ('b0000001-0000-0000-0000-000000000045', 'Hip 90/90 Stretch', 'Internal and external hip rotation mobility.', 'Mobility', 'Glutes', 'None', 'Beginner',
    '["Sit with front leg at 90 degrees", "Back leg at 90 degrees behind", "Sit tall and lean over front shin", "Switch sides"]',
    '["Keep both sit bones on floor", "Breathe into the stretch"]',
    '["Leaning away from stretch", "Not keeping 90-degree angles"]'),
  ('b0000001-0000-0000-0000-000000000046', 'Cat-Cow Stretch', 'Spinal mobility flow exercise.', 'Mobility', 'Core', 'None', 'Beginner',
    '["Start on hands and knees", "Round spine upward (cat)", "Drop belly and look up (cow)", "Flow between positions with breath"]',
    '["Initiate from pelvis", "Coordinate with breathing"]',
    '["Rushing the movement", "Only moving neck instead of full spine"]'),

  -- Flexibility (4)
  ('b0000001-0000-0000-0000-000000000047', 'Pigeon Pose', 'Deep hip flexor and glute stretch.', 'Flexibility', 'Glutes', 'None', 'Intermediate',
    '["From all fours bring one knee forward", "Extend back leg straight behind", "Lower hips toward floor", "Hold and breathe deeply"]',
    '["Use pillow under hip if needed", "Keep hips square"]',
    '["Twisting hips", "Forcing too deep too fast"]'),
  ('b0000001-0000-0000-0000-000000000048', 'Standing Hamstring Stretch', 'Posterior chain flexibility.', 'Flexibility', 'Hamstrings', 'None', 'Beginner',
    '["Stand and place one heel on elevated surface", "Keep leg straight", "Hinge forward at hips", "Hold when stretch is felt"]',
    '["Hinge from hips not lower back", "Keep back flat"]',
    '["Rounding back", "Bending the stretched knee"]'),
  ('b0000001-0000-0000-0000-000000000049', 'Shoulder Dislocates', 'Shoulder flexibility using band or stick.', 'Flexibility', 'Shoulders', 'Resistance Bands', 'Beginner',
    '["Hold band/stick with wide grip", "Raise arms overhead", "Continue rotating behind body", "Return to front with control"]',
    '["Start very wide and narrow over time", "Keep arms straight throughout"]',
    '["Bending elbows", "Grip too narrow too soon"]'),
  ('b0000001-0000-0000-0000-000000000050', 'Pancake Stretch', 'Wide-leg forward fold for hip adductors.', 'Flexibility', 'Hamstrings', 'None', 'Intermediate',
    '["Sit with legs spread wide", "Rotate pelvis forward", "Walk hands forward between legs", "Hold at deepest point"]',
    '["Sit on small elevation to tilt pelvis", "Engage quads to relax hamstrings"]',
    '["Rounding upper back instead of hinging", "Forcing with arms"]')
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════════
-- 3. RECIPES (12 items + ingredients + instructions)
-- ════════════════════════════════════════════════════════════════════════════════

INSERT INTO recipes (id, name, description, goal, servings, prep_time, calories, protein, carbs, fat)
VALUES
  -- Fat Loss (4)
  ('c0000001-0000-0000-0000-000000000001', 'Ensalada de Pollo a la Plancha', 'Ensalada fresca con proteína magra y vegetales variados.', 'Fat Loss', 1, 15, 320, 35, 12, 14),
  ('c0000001-0000-0000-0000-000000000002', 'Bowl de Atún y Vegetales', 'Combinación ligera de atún con vegetales crujientes.', 'Fat Loss', 1, 10, 250, 30, 8, 10),
  ('c0000001-0000-0000-0000-000000000003', 'Wrap de Pavo y Espinaca', 'Wrap alto en proteína con vegetales frescos.', 'Fat Loss', 1, 10, 280, 28, 22, 9),
  ('c0000001-0000-0000-0000-000000000004', 'Salmón con Brócoli al Vapor', 'Salmón horneado con vegetales al vapor.', 'Fat Loss', 1, 25, 350, 32, 10, 20),

  -- Muscle Gain (4)
  ('c0000001-0000-0000-0000-000000000005', 'Arroz con Pollo y Aguacate', 'Plato clásico colombiano adaptado para ganar masa.', 'Muscle Gain', 1, 20, 580, 42, 55, 18),
  ('c0000001-0000-0000-0000-000000000006', 'Batido Proteico de Banano', 'Batido post-entrenamiento con alto contenido proteico.', 'Muscle Gain', 1, 5, 450, 40, 48, 10),
  ('c0000001-0000-0000-0000-000000000007', 'Pasta con Carne Molida', 'Pasta integral con salsa de carne y vegetales.', 'Muscle Gain', 2, 25, 520, 38, 52, 16),
  ('c0000001-0000-0000-0000-000000000008', 'Tortilla de Huevos con Avena', 'Desayuno alto en proteína y carbohidratos complejos.', 'Muscle Gain', 1, 10, 480, 32, 40, 20),

  -- Maintenance (4)
  ('c0000001-0000-0000-0000-000000000009', 'Bowl de Quinoa con Pollo', 'Bowl equilibrado con proteína, carbohidratos y grasas saludables.', 'Maintenance', 1, 20, 420, 35, 38, 14),
  ('c0000001-0000-0000-0000-000000000010', 'Arepa con Huevo y Aguacate', 'Desayuno colombiano balanceado.', 'Maintenance', 1, 15, 380, 18, 35, 18),
  ('c0000001-0000-0000-0000-000000000011', 'Trucha con Papa y Ensalada', 'Almuerzo equilibrado con proteína y carbohidratos.', 'Maintenance', 1, 25, 400, 28, 35, 15),
  ('c0000001-0000-0000-0000-000000000012', 'Yogur con Frutas y Granola', 'Snack balanceado rico en proteína.', 'Maintenance', 1, 5, 300, 18, 38, 8)
ON CONFLICT (id) DO NOTHING;

-- Recipe Ingredients
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, name, quantity, unit, sort_order)
VALUES
  -- Ensalada de Pollo (recipe 1)
  ('d0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'Pechuga de Pollo', 150, 'g', 1),
  ('d0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000025', 'Espinaca', 80, 'g', 2),
  ('d0000001-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000019', 'Aguacate', 50, 'g', 3),
  ('d0000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000027', 'Tomate', 80, 'g', 4),
  -- Bowl de Atún (recipe 2)
  ('d0000001-0000-0000-0000-000000000005', 'c0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000005', 'Atún Enlatado', 120, 'g', 1),
  ('d0000001-0000-0000-0000-000000000006', 'c0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000032', 'Pepino', 100, 'g', 2),
  ('d0000001-0000-0000-0000-000000000007', 'c0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000029', 'Pimentón Rojo', 60, 'g', 3),
  ('d0000001-0000-0000-0000-000000000008', 'c0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000020', 'Aceite de Oliva', 10, 'ml', 4),
  -- Wrap de Pavo (recipe 3)
  ('d0000001-0000-0000-0000-000000000009', 'c0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000007', 'Pechuga de Pavo', 120, 'g', 1),
  ('d0000001-0000-0000-0000-000000000010', 'c0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000025', 'Espinaca', 50, 'g', 2),
  ('d0000001-0000-0000-0000-000000000011', 'c0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000016', 'Pan Integral', 60, 'g', 3),
  -- Salmón con Brócoli (recipe 4)
  ('d0000001-0000-0000-0000-000000000012', 'c0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000003', 'Salmón', 150, 'g', 1),
  ('d0000001-0000-0000-0000-000000000013', 'c0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000026', 'Brócoli', 150, 'g', 2),
  ('d0000001-0000-0000-0000-000000000014', 'c0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000020', 'Aceite de Oliva', 5, 'ml', 3),
  -- Arroz con Pollo (recipe 5)
  ('d0000001-0000-0000-0000-000000000015', 'c0000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000001', 'Pechuga de Pollo', 180, 'g', 1),
  ('d0000001-0000-0000-0000-000000000016', 'c0000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000011', 'Arroz Blanco', 150, 'g', 2),
  ('d0000001-0000-0000-0000-000000000017', 'c0000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000019', 'Aguacate', 70, 'g', 3),
  -- Batido Proteico (recipe 6)
  ('d0000001-0000-0000-0000-000000000018', 'c0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000044', 'Whey Protein', 30, 'g', 1),
  ('d0000001-0000-0000-0000-000000000019', 'c0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000033', 'Banano', 120, 'g', 2),
  ('d0000001-0000-0000-0000-000000000020', 'c0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000041', 'Leche Entera', 250, 'ml', 3),
  ('d0000001-0000-0000-0000-000000000021', 'c0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000012', 'Avena en Hojuelas', 30, 'g', 4),
  -- Pasta con Carne (recipe 7)
  ('d0000001-0000-0000-0000-000000000022', 'c0000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000004', 'Carne Molida Magra', 150, 'g', 1),
  ('d0000001-0000-0000-0000-000000000023', 'c0000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000017', 'Pasta Integral', 120, 'g', 2),
  ('d0000001-0000-0000-0000-000000000024', 'c0000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000027', 'Tomate', 100, 'g', 3),
  ('d0000001-0000-0000-0000-000000000025', 'c0000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000028', 'Cebolla', 50, 'g', 4),
  -- Tortilla con Avena (recipe 8)
  ('d0000001-0000-0000-0000-000000000026', 'c0000001-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000002', 'Huevo Entero', 4, 'unit', 1),
  ('d0000001-0000-0000-0000-000000000027', 'c0000001-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000012', 'Avena en Hojuelas', 50, 'g', 2),
  ('d0000001-0000-0000-0000-000000000028', 'c0000001-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000025', 'Espinaca', 30, 'g', 3),
  -- Bowl de Quinoa (recipe 9) - using rice as stand-in
  ('d0000001-0000-0000-0000-000000000029', 'c0000001-0000-0000-0000-000000000009', 'a0000001-0000-0000-0000-000000000001', 'Pechuga de Pollo', 150, 'g', 1),
  ('d0000001-0000-0000-0000-000000000030', 'c0000001-0000-0000-0000-000000000009', 'a0000001-0000-0000-0000-000000000011', 'Arroz Blanco', 100, 'g', 2),
  ('d0000001-0000-0000-0000-000000000031', 'c0000001-0000-0000-0000-000000000009', 'a0000001-0000-0000-0000-000000000019', 'Aguacate', 50, 'g', 3),
  ('d0000001-0000-0000-0000-000000000032', 'c0000001-0000-0000-0000-000000000009', 'a0000001-0000-0000-0000-000000000029', 'Pimentón Rojo', 50, 'g', 4),
  -- Arepa con Huevo (recipe 10)
  ('d0000001-0000-0000-0000-000000000033', 'c0000001-0000-0000-0000-000000000010', 'a0000001-0000-0000-0000-000000000018', 'Arepa de Maíz', 100, 'g', 1),
  ('d0000001-0000-0000-0000-000000000034', 'c0000001-0000-0000-0000-000000000010', 'a0000001-0000-0000-0000-000000000002', 'Huevo Entero', 2, 'unit', 2),
  ('d0000001-0000-0000-0000-000000000035', 'c0000001-0000-0000-0000-000000000010', 'a0000001-0000-0000-0000-000000000019', 'Aguacate', 60, 'g', 3),
  -- Trucha con Papa (recipe 11)
  ('d0000001-0000-0000-0000-000000000036', 'c0000001-0000-0000-0000-000000000011', 'a0000001-0000-0000-0000-000000000009', 'Trucha', 150, 'g', 1),
  ('d0000001-0000-0000-0000-000000000037', 'c0000001-0000-0000-0000-000000000011', 'a0000001-0000-0000-0000-000000000013', 'Papa', 150, 'g', 2),
  ('d0000001-0000-0000-0000-000000000038', 'c0000001-0000-0000-0000-000000000011', 'a0000001-0000-0000-0000-000000000031', 'Lechuga', 50, 'g', 3),
  ('d0000001-0000-0000-0000-000000000039', 'c0000001-0000-0000-0000-000000000011', 'a0000001-0000-0000-0000-000000000027', 'Tomate', 60, 'g', 4),
  -- Yogur con Frutas (recipe 12)
  ('d0000001-0000-0000-0000-000000000040', 'c0000001-0000-0000-0000-000000000012', 'a0000001-0000-0000-0000-000000000039', 'Yogur Griego', 200, 'g', 1),
  ('d0000001-0000-0000-0000-000000000041', 'c0000001-0000-0000-0000-000000000012', 'a0000001-0000-0000-0000-000000000035', 'Fresas', 80, 'g', 2),
  ('d0000001-0000-0000-0000-000000000042', 'c0000001-0000-0000-0000-000000000012', 'a0000001-0000-0000-0000-000000000033', 'Banano', 60, 'g', 3),
  ('d0000001-0000-0000-0000-000000000043', 'c0000001-0000-0000-0000-000000000012', 'a0000001-0000-0000-0000-000000000012', 'Avena en Hojuelas', 20, 'g', 4)
ON CONFLICT (id) DO NOTHING;

-- Recipe Instructions
INSERT INTO recipe_instructions (id, recipe_id, step_number, instruction)
VALUES
  -- Ensalada de Pollo
  ('e0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 1, 'Sazonar la pechuga de pollo con sal y pimienta.'),
  ('e0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001', 2, 'Cocinar a la plancha 5-6 minutos por cada lado.'),
  ('e0000001-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000001', 3, 'Cortar en tiras y servir sobre la espinaca con tomate y aguacate.'),
  -- Bowl de Atún
  ('e0000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000002', 1, 'Escurrir el atún enlatado.'),
  ('e0000001-0000-0000-0000-000000000005', 'c0000001-0000-0000-0000-000000000002', 2, 'Picar pepino y pimentón en cubos.'),
  ('e0000001-0000-0000-0000-000000000006', 'c0000001-0000-0000-0000-000000000002', 3, 'Mezclar todo con aceite de oliva, sal y limón.'),
  -- Wrap de Pavo
  ('e0000001-0000-0000-0000-000000000007', 'c0000001-0000-0000-0000-000000000003', 1, 'Calentar el pan integral ligeramente.'),
  ('e0000001-0000-0000-0000-000000000008', 'c0000001-0000-0000-0000-000000000003', 2, 'Colocar pavo y espinaca sobre el pan.'),
  ('e0000001-0000-0000-0000-000000000009', 'c0000001-0000-0000-0000-000000000003', 3, 'Enrollar y cortar por la mitad.'),
  -- Salmón con Brócoli
  ('e0000001-0000-0000-0000-000000000010', 'c0000001-0000-0000-0000-000000000004', 1, 'Precalentar horno a 200°C.'),
  ('e0000001-0000-0000-0000-000000000011', 'c0000001-0000-0000-0000-000000000004', 2, 'Sazonar el salmón y hornear 12-15 minutos.'),
  ('e0000001-0000-0000-0000-000000000012', 'c0000001-0000-0000-0000-000000000004', 3, 'Cocinar brócoli al vapor por 5 minutos.'),
  ('e0000001-0000-0000-0000-000000000013', 'c0000001-0000-0000-0000-000000000004', 4, 'Servir juntos con un toque de aceite de oliva.'),
  -- Arroz con Pollo
  ('e0000001-0000-0000-0000-000000000014', 'c0000001-0000-0000-0000-000000000005', 1, 'Cocinar el arroz según instrucciones del paquete.'),
  ('e0000001-0000-0000-0000-000000000015', 'c0000001-0000-0000-0000-000000000005', 2, 'Sazonar y cocinar la pechuga a la plancha.'),
  ('e0000001-0000-0000-0000-000000000016', 'c0000001-0000-0000-0000-000000000005', 3, 'Servir con aguacate cortado en láminas.'),
  -- Batido Proteico
  ('e0000001-0000-0000-0000-000000000017', 'c0000001-0000-0000-0000-000000000006', 1, 'Agregar todos los ingredientes a la licuadora.'),
  ('e0000001-0000-0000-0000-000000000018', 'c0000001-0000-0000-0000-000000000006', 2, 'Licuar por 60 segundos hasta lograr consistencia suave.'),
  ('e0000001-0000-0000-0000-000000000019', 'c0000001-0000-0000-0000-000000000006', 3, 'Servir inmediatamente después del entrenamiento.'),
  -- Pasta con Carne
  ('e0000001-0000-0000-0000-000000000020', 'c0000001-0000-0000-0000-000000000007', 1, 'Cocinar la pasta según instrucciones del paquete.'),
  ('e0000001-0000-0000-0000-000000000021', 'c0000001-0000-0000-0000-000000000007', 2, 'Sofreír cebolla y tomate, agregar carne molida.'),
  ('e0000001-0000-0000-0000-000000000022', 'c0000001-0000-0000-0000-000000000007', 3, 'Cocinar la carne hasta dorar, sazonar.'),
  ('e0000001-0000-0000-0000-000000000023', 'c0000001-0000-0000-0000-000000000007', 4, 'Mezclar con la pasta escurrida y servir.'),
  -- Tortilla con Avena
  ('e0000001-0000-0000-0000-000000000024', 'c0000001-0000-0000-0000-000000000008', 1, 'Batir los huevos con la avena y espinaca.'),
  ('e0000001-0000-0000-0000-000000000025', 'c0000001-0000-0000-0000-000000000008', 2, 'Verter en sartén caliente con un poco de aceite.'),
  ('e0000001-0000-0000-0000-000000000026', 'c0000001-0000-0000-0000-000000000008', 3, 'Cocinar 3 minutos por lado hasta dorar.'),
  -- Bowl de Quinoa/Arroz
  ('e0000001-0000-0000-0000-000000000027', 'c0000001-0000-0000-0000-000000000009', 1, 'Cocinar el arroz y dejar enfriar ligeramente.'),
  ('e0000001-0000-0000-0000-000000000028', 'c0000001-0000-0000-0000-000000000009', 2, 'Cocinar el pollo a la plancha y cortar en cubos.'),
  ('e0000001-0000-0000-0000-000000000029', 'c0000001-0000-0000-0000-000000000009', 3, 'Armar bowl con arroz, pollo, aguacate y pimentón.'),
  -- Arepa con Huevo
  ('e0000001-0000-0000-0000-000000000030', 'c0000001-0000-0000-0000-000000000010', 1, 'Calentar la arepa en sartén o tostadora.'),
  ('e0000001-0000-0000-0000-000000000031', 'c0000001-0000-0000-0000-000000000010', 2, 'Preparar huevos revueltos o fritos.'),
  ('e0000001-0000-0000-0000-000000000032', 'c0000001-0000-0000-0000-000000000010', 3, 'Servir arepa con huevos y aguacate cortado.'),
  -- Trucha con Papa
  ('e0000001-0000-0000-0000-000000000033', 'c0000001-0000-0000-0000-000000000011', 1, 'Hervir las papas hasta que estén tiernas.'),
  ('e0000001-0000-0000-0000-000000000034', 'c0000001-0000-0000-0000-000000000011', 2, 'Sazonar la trucha y cocinar a la plancha 4 minutos por lado.'),
  ('e0000001-0000-0000-0000-000000000035', 'c0000001-0000-0000-0000-000000000011', 3, 'Preparar ensalada con lechuga y tomate.'),
  ('e0000001-0000-0000-0000-000000000036', 'c0000001-0000-0000-0000-000000000011', 4, 'Servir todo junto en el plato.'),
  -- Yogur con Frutas
  ('e0000001-0000-0000-0000-000000000037', 'c0000001-0000-0000-0000-000000000012', 1, 'Colocar yogur griego en un bowl.'),
  ('e0000001-0000-0000-0000-000000000038', 'c0000001-0000-0000-0000-000000000012', 2, 'Picar fresas y banano en trozos.'),
  ('e0000001-0000-0000-0000-000000000039', 'c0000001-0000-0000-0000-000000000012', 3, 'Agregar frutas y avena encima del yogur.')
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════════
-- 4. WORKOUT TEMPLATES (8 templates)
-- user_id = NULL, is_template = TRUE
-- ════════════════════════════════════════════════════════════════════════════════

INSERT INTO workouts (id, user_id, name, description, goal, difficulty, duration, is_template)
VALUES
  ('f0000001-0000-0000-0000-000000000001', NULL, 'Beginner Full Body', 'Rutina de cuerpo completo 3 días para principiantes.', 'General Fitness', 'Beginner', 45, TRUE),
  ('f0000001-0000-0000-0000-000000000002', NULL, 'Beginner Calisthenics', 'Introducción a la calistenia con movimientos fundamentales.', 'General Fitness', 'Beginner', 40, TRUE),
  ('f0000001-0000-0000-0000-000000000003', NULL, 'Intermediate Calisthenics', 'Progresiones intermedias de calistenia.', 'Strength', 'Intermediate', 50, TRUE),
  ('f0000001-0000-0000-0000-000000000004', NULL, 'Muscle Up Foundation', 'Programa de preparación para muscle ups.', 'Strength', 'Intermediate', 45, TRUE),
  ('f0000001-0000-0000-0000-000000000005', NULL, 'Front Lever Foundation', 'Progresiones hacia el front lever completo.', 'Strength', 'Intermediate', 45, TRUE),
  ('f0000001-0000-0000-0000-000000000006', NULL, 'Back Lever Foundation', 'Programa de progresión para back lever.', 'Strength', 'Intermediate', 40, TRUE),
  ('f0000001-0000-0000-0000-000000000007', NULL, 'Fat Loss Circuit', 'Circuito de alta intensidad para pérdida de grasa.', 'Fat Loss', 'Intermediate', 30, TRUE),
  ('f0000001-0000-0000-0000-000000000008', NULL, 'Strength Foundation', 'Programa 5x5 de fuerza con barbell.', 'Strength', 'Intermediate', 50, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Workout Days
INSERT INTO workout_days (id, workout_id, user_id, day_name, sort_order)
VALUES
  -- Beginner Full Body (3 days)
  ('f1000001-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000001', NULL, 'Monday', 0),
  ('f1000001-0000-0000-0000-000000000002', 'f0000001-0000-0000-0000-000000000001', NULL, 'Wednesday', 1),
  ('f1000001-0000-0000-0000-000000000003', 'f0000001-0000-0000-0000-000000000001', NULL, 'Friday', 2),
  -- Beginner Calisthenics (3 days)
  ('f1000001-0000-0000-0000-000000000004', 'f0000001-0000-0000-0000-000000000002', NULL, 'Monday', 0),
  ('f1000001-0000-0000-0000-000000000005', 'f0000001-0000-0000-0000-000000000002', NULL, 'Wednesday', 1),
  ('f1000001-0000-0000-0000-000000000006', 'f0000001-0000-0000-0000-000000000002', NULL, 'Friday', 2),
  -- Intermediate Calisthenics (3 days)
  ('f1000001-0000-0000-0000-000000000007', 'f0000001-0000-0000-0000-000000000003', NULL, 'Monday', 0),
  ('f1000001-0000-0000-0000-000000000008', 'f0000001-0000-0000-0000-000000000003', NULL, 'Wednesday', 1),
  ('f1000001-0000-0000-0000-000000000009', 'f0000001-0000-0000-0000-000000000003', NULL, 'Friday', 2),
  -- Muscle Up Foundation (3 days)
  ('f1000001-0000-0000-0000-000000000010', 'f0000001-0000-0000-0000-000000000004', NULL, 'Tuesday', 0),
  ('f1000001-0000-0000-0000-000000000011', 'f0000001-0000-0000-0000-000000000004', NULL, 'Thursday', 1),
  ('f1000001-0000-0000-0000-000000000012', 'f0000001-0000-0000-0000-000000000004', NULL, 'Saturday', 2),
  -- Front Lever Foundation (3 days)
  ('f1000001-0000-0000-0000-000000000013', 'f0000001-0000-0000-0000-000000000005', NULL, 'Monday', 0),
  ('f1000001-0000-0000-0000-000000000014', 'f0000001-0000-0000-0000-000000000005', NULL, 'Wednesday', 1),
  ('f1000001-0000-0000-0000-000000000015', 'f0000001-0000-0000-0000-000000000005', NULL, 'Friday', 2),
  -- Back Lever Foundation (3 days)
  ('f1000001-0000-0000-0000-000000000016', 'f0000001-0000-0000-0000-000000000006', NULL, 'Tuesday', 0),
  ('f1000001-0000-0000-0000-000000000017', 'f0000001-0000-0000-0000-000000000006', NULL, 'Thursday', 1),
  ('f1000001-0000-0000-0000-000000000018', 'f0000001-0000-0000-0000-000000000006', NULL, 'Saturday', 2),
  -- Fat Loss Circuit (3 days)
  ('f1000001-0000-0000-0000-000000000019', 'f0000001-0000-0000-0000-000000000007', NULL, 'Monday', 0),
  ('f1000001-0000-0000-0000-000000000020', 'f0000001-0000-0000-0000-000000000007', NULL, 'Wednesday', 1),
  ('f1000001-0000-0000-0000-000000000021', 'f0000001-0000-0000-0000-000000000007', NULL, 'Friday', 2),
  -- Strength Foundation (3 days)
  ('f1000001-0000-0000-0000-000000000022', 'f0000001-0000-0000-0000-000000000008', NULL, 'Monday', 0),
  ('f1000001-0000-0000-0000-000000000023', 'f0000001-0000-0000-0000-000000000008', NULL, 'Wednesday', 1),
  ('f1000001-0000-0000-0000-000000000024', 'f0000001-0000-0000-0000-000000000008', NULL, 'Friday', 2)
ON CONFLICT (id) DO NOTHING;

-- Workout Exercises (abbreviated to key exercises per template)
INSERT INTO workout_exercises (id, workout_day_id, user_id, exercise_id, exercise_name, sets, reps, rest_seconds, sort_order)
VALUES
  -- Beginner Full Body — Monday
  ('f2000001-0000-0000-0000-000000000001', 'f1000001-0000-0000-0000-000000000001', NULL, 'b0000001-0000-0000-0000-000000000004', 'Barbell Squat', 3, 10, 90, 0),
  ('f2000001-0000-0000-0000-000000000002', 'f1000001-0000-0000-0000-000000000001', NULL, 'b0000001-0000-0000-0000-000000000001', 'Barbell Bench Press', 3, 10, 90, 1),
  ('f2000001-0000-0000-0000-000000000003', 'f1000001-0000-0000-0000-000000000001', NULL, 'b0000001-0000-0000-0000-000000000006', 'Barbell Row', 3, 10, 90, 2),
  ('f2000001-0000-0000-0000-000000000004', 'f1000001-0000-0000-0000-000000000001', NULL, 'b0000001-0000-0000-0000-000000000024', 'Plank', 3, 30, 30, 3),
  -- Beginner Full Body — Wednesday
  ('f2000001-0000-0000-0000-000000000005', 'f1000001-0000-0000-0000-000000000002', NULL, 'b0000001-0000-0000-0000-000000000003', 'Deadlift', 3, 8, 120, 0),
  ('f2000001-0000-0000-0000-000000000006', 'f1000001-0000-0000-0000-000000000002', NULL, 'b0000001-0000-0000-0000-000000000005', 'Overhead Press', 3, 10, 90, 1),
  ('f2000001-0000-0000-0000-000000000007', 'f1000001-0000-0000-0000-000000000002', NULL, 'b0000001-0000-0000-0000-000000000012', 'Walking Lunge', 3, 12, 60, 2),
  ('f2000001-0000-0000-0000-000000000008', 'f1000001-0000-0000-0000-000000000002', NULL, 'b0000001-0000-0000-0000-000000000010', 'Barbell Curl', 3, 12, 45, 3),
  -- Beginner Full Body — Friday
  ('f2000001-0000-0000-0000-000000000009', 'f1000001-0000-0000-0000-000000000003', NULL, 'b0000001-0000-0000-0000-000000000008', 'Leg Press', 3, 12, 90, 0),
  ('f2000001-0000-0000-0000-000000000010', 'f1000001-0000-0000-0000-000000000003', NULL, 'b0000001-0000-0000-0000-000000000002', 'Incline Dumbbell Press', 3, 10, 90, 1),
  ('f2000001-0000-0000-0000-000000000011', 'f1000001-0000-0000-0000-000000000003', NULL, 'b0000001-0000-0000-0000-000000000011', 'Skull Crusher', 3, 12, 60, 2),
  ('f2000001-0000-0000-0000-000000000012', 'f1000001-0000-0000-0000-000000000003', NULL, 'b0000001-0000-0000-0000-000000000015', 'Calf Raise', 3, 15, 30, 3),
  -- Beginner Calisthenics — Monday
  ('f2000001-0000-0000-0000-000000000013', 'f1000001-0000-0000-0000-000000000004', NULL, 'b0000001-0000-0000-0000-000000000016', 'Push-Up', 3, 10, 60, 0),
  ('f2000001-0000-0000-0000-000000000014', 'f1000001-0000-0000-0000-000000000004', NULL, 'b0000001-0000-0000-0000-000000000032', 'Australian Pull-Up', 3, 10, 60, 1),
  ('f2000001-0000-0000-0000-000000000015', 'f1000001-0000-0000-0000-000000000004', NULL, 'b0000001-0000-0000-0000-000000000024', 'Plank', 3, 30, 30, 2),
  ('f2000001-0000-0000-0000-000000000016', 'f1000001-0000-0000-0000-000000000004', NULL, 'b0000001-0000-0000-0000-000000000038', 'Jump Squat', 3, 10, 60, 3),
  -- Beginner Calisthenics — Wednesday
  ('f2000001-0000-0000-0000-000000000017', 'f1000001-0000-0000-0000-000000000005', NULL, 'b0000001-0000-0000-0000-000000000031', 'Diamond Push-Up', 3, 8, 60, 0),
  ('f2000001-0000-0000-0000-000000000018', 'f1000001-0000-0000-0000-000000000005', NULL, 'b0000001-0000-0000-0000-000000000032', 'Australian Pull-Up', 3, 12, 60, 1),
  ('f2000001-0000-0000-0000-000000000019', 'f1000001-0000-0000-0000-000000000005', NULL, 'b0000001-0000-0000-0000-000000000025', 'Hollow Hold', 3, 20, 45, 2),
  ('f2000001-0000-0000-0000-000000000020', 'f1000001-0000-0000-0000-000000000005', NULL, 'b0000001-0000-0000-0000-000000000012', 'Walking Lunge', 3, 10, 60, 3),
  -- Beginner Calisthenics — Friday
  ('f2000001-0000-0000-0000-000000000021', 'f1000001-0000-0000-0000-000000000006', NULL, 'b0000001-0000-0000-0000-000000000022', 'Pike Push-Up', 3, 8, 60, 0),
  ('f2000001-0000-0000-0000-000000000022', 'f1000001-0000-0000-0000-000000000006', NULL, 'b0000001-0000-0000-0000-000000000019', 'Dip', 3, 6, 90, 1),
  ('f2000001-0000-0000-0000-000000000023', 'f1000001-0000-0000-0000-000000000006', NULL, 'b0000001-0000-0000-0000-000000000024', 'Plank', 3, 45, 30, 2),
  ('f2000001-0000-0000-0000-000000000024', 'f1000001-0000-0000-0000-000000000006', NULL, 'b0000001-0000-0000-0000-000000000037', 'Mountain Climber', 3, 20, 30, 3),
  -- Intermediate Calisthenics — Monday
  ('f2000001-0000-0000-0000-000000000025', 'f1000001-0000-0000-0000-000000000007', NULL, 'b0000001-0000-0000-0000-000000000017', 'Pull-Up', 4, 8, 90, 0),
  ('f2000001-0000-0000-0000-000000000026', 'f1000001-0000-0000-0000-000000000007', NULL, 'b0000001-0000-0000-0000-000000000019', 'Dip', 4, 10, 60, 1),
  ('f2000001-0000-0000-0000-000000000027', 'f1000001-0000-0000-0000-000000000007', NULL, 'b0000001-0000-0000-0000-000000000023', 'Pistol Squat', 3, 5, 90, 2),
  ('f2000001-0000-0000-0000-000000000028', 'f1000001-0000-0000-0000-000000000007', NULL, 'b0000001-0000-0000-0000-000000000026', 'L-Sit', 3, 15, 60, 3),
  -- Intermediate Calisthenics — Wednesday
  ('f2000001-0000-0000-0000-000000000029', 'f1000001-0000-0000-0000-000000000008', NULL, 'b0000001-0000-0000-0000-000000000018', 'Chin-Up', 4, 8, 90, 0),
  ('f2000001-0000-0000-0000-000000000030', 'f1000001-0000-0000-0000-000000000008', NULL, 'b0000001-0000-0000-0000-000000000021', 'Handstand Push-Up', 3, 5, 120, 1),
  ('f2000001-0000-0000-0000-000000000031', 'f1000001-0000-0000-0000-000000000008', NULL, 'b0000001-0000-0000-0000-000000000025', 'Hollow Hold', 3, 30, 45, 2),
  ('f2000001-0000-0000-0000-000000000032', 'f1000001-0000-0000-0000-000000000008', NULL, 'b0000001-0000-0000-0000-000000000036', 'Burpee', 3, 10, 60, 3),
  -- Intermediate Calisthenics — Friday
  ('f2000001-0000-0000-0000-000000000033', 'f1000001-0000-0000-0000-000000000009', NULL, 'b0000001-0000-0000-0000-000000000017', 'Pull-Up', 4, 10, 90, 0),
  ('f2000001-0000-0000-0000-000000000034', 'f1000001-0000-0000-0000-000000000009', NULL, 'b0000001-0000-0000-0000-000000000027', 'Handstand Hold', 3, 30, 60, 1),
  ('f2000001-0000-0000-0000-000000000035', 'f1000001-0000-0000-0000-000000000009', NULL, 'b0000001-0000-0000-0000-000000000023', 'Pistol Squat', 3, 6, 90, 2),
  ('f2000001-0000-0000-0000-000000000036', 'f1000001-0000-0000-0000-000000000009', NULL, 'b0000001-0000-0000-0000-000000000026', 'L-Sit', 3, 20, 60, 3),
  -- Muscle Up Foundation — Tuesday
  ('f2000001-0000-0000-0000-000000000037', 'f1000001-0000-0000-0000-000000000010', NULL, 'b0000001-0000-0000-0000-000000000017', 'Pull-Up', 5, 5, 120, 0),
  ('f2000001-0000-0000-0000-000000000038', 'f1000001-0000-0000-0000-000000000010', NULL, 'b0000001-0000-0000-0000-000000000019', 'Dip', 4, 8, 90, 1),
  ('f2000001-0000-0000-0000-000000000039', 'f1000001-0000-0000-0000-000000000010', NULL, 'b0000001-0000-0000-0000-000000000033', 'Muscle-Up Transition Drill', 5, 3, 120, 2),
  ('f2000001-0000-0000-0000-000000000040', 'f1000001-0000-0000-0000-000000000010', NULL, 'b0000001-0000-0000-0000-000000000032', 'Australian Pull-Up', 3, 15, 45, 3),
  -- Muscle Up Foundation — Thursday
  ('f2000001-0000-0000-0000-000000000041', 'f1000001-0000-0000-0000-000000000011', NULL, 'b0000001-0000-0000-0000-000000000018', 'Chin-Up', 4, 8, 90, 0),
  ('f2000001-0000-0000-0000-000000000042', 'f1000001-0000-0000-0000-000000000011', NULL, 'b0000001-0000-0000-0000-000000000019', 'Dip', 4, 10, 90, 1),
  ('f2000001-0000-0000-0000-000000000043', 'f1000001-0000-0000-0000-000000000011', NULL, 'b0000001-0000-0000-0000-000000000035', 'Skin the Cat', 3, 5, 90, 2),
  ('f2000001-0000-0000-0000-000000000044', 'f1000001-0000-0000-0000-000000000011', NULL, 'b0000001-0000-0000-0000-000000000016', 'Push-Up', 3, 20, 60, 3),
  -- Muscle Up Foundation — Saturday
  ('f2000001-0000-0000-0000-000000000045', 'f1000001-0000-0000-0000-000000000012', NULL, 'b0000001-0000-0000-0000-000000000020', 'Muscle-Up', 5, 1, 180, 0),
  ('f2000001-0000-0000-0000-000000000046', 'f1000001-0000-0000-0000-000000000012', NULL, 'b0000001-0000-0000-0000-000000000017', 'Pull-Up', 4, 8, 90, 1),
  ('f2000001-0000-0000-0000-000000000047', 'f1000001-0000-0000-0000-000000000012', NULL, 'b0000001-0000-0000-0000-000000000019', 'Dip', 4, 12, 60, 2),
  ('f2000001-0000-0000-0000-000000000048', 'f1000001-0000-0000-0000-000000000012', NULL, 'b0000001-0000-0000-0000-000000000025', 'Hollow Hold', 3, 30, 45, 3),
  -- Front Lever Foundation — Monday
  ('f2000001-0000-0000-0000-000000000049', 'f1000001-0000-0000-0000-000000000013', NULL, 'b0000001-0000-0000-0000-000000000028', 'Front Lever Tuck Hold', 5, 10, 120, 0),
  ('f2000001-0000-0000-0000-000000000050', 'f1000001-0000-0000-0000-000000000013', NULL, 'b0000001-0000-0000-0000-000000000017', 'Pull-Up', 4, 8, 90, 1),
  ('f2000001-0000-0000-0000-000000000051', 'f1000001-0000-0000-0000-000000000013', NULL, 'b0000001-0000-0000-0000-000000000034', 'Tuck Front Lever Pull-Up', 3, 5, 120, 2),
  ('f2000001-0000-0000-0000-000000000052', 'f1000001-0000-0000-0000-000000000013', NULL, 'b0000001-0000-0000-0000-000000000025', 'Hollow Hold', 3, 30, 45, 3),
  -- Front Lever Foundation — Wednesday
  ('f2000001-0000-0000-0000-000000000053', 'f1000001-0000-0000-0000-000000000014', NULL, 'b0000001-0000-0000-0000-000000000029', 'Front Lever Raise', 4, 3, 150, 0),
  ('f2000001-0000-0000-0000-000000000054', 'f1000001-0000-0000-0000-000000000014', NULL, 'b0000001-0000-0000-0000-000000000006', 'Barbell Row', 4, 8, 90, 1),
  ('f2000001-0000-0000-0000-000000000055', 'f1000001-0000-0000-0000-000000000014', NULL, 'b0000001-0000-0000-0000-000000000018', 'Chin-Up', 3, 10, 60, 2),
  ('f2000001-0000-0000-0000-000000000056', 'f1000001-0000-0000-0000-000000000014', NULL, 'b0000001-0000-0000-0000-000000000024', 'Plank', 3, 60, 30, 3),
  -- Front Lever Foundation — Friday
  ('f2000001-0000-0000-0000-000000000057', 'f1000001-0000-0000-0000-000000000015', NULL, 'b0000001-0000-0000-0000-000000000028', 'Front Lever Tuck Hold', 4, 15, 120, 0),
  ('f2000001-0000-0000-0000-000000000058', 'f1000001-0000-0000-0000-000000000015', NULL, 'b0000001-0000-0000-0000-000000000017', 'Pull-Up', 5, 5, 120, 1),
  ('f2000001-0000-0000-0000-000000000059', 'f1000001-0000-0000-0000-000000000015', NULL, 'b0000001-0000-0000-0000-000000000032', 'Australian Pull-Up', 3, 15, 45, 2),
  ('f2000001-0000-0000-0000-000000000060', 'f1000001-0000-0000-0000-000000000015', NULL, 'b0000001-0000-0000-0000-000000000026', 'L-Sit', 3, 15, 60, 3),
  -- Back Lever Foundation — Tuesday
  ('f2000001-0000-0000-0000-000000000061', 'f1000001-0000-0000-0000-000000000016', NULL, 'b0000001-0000-0000-0000-000000000030', 'Back Lever Hold', 5, 8, 120, 0),
  ('f2000001-0000-0000-0000-000000000062', 'f1000001-0000-0000-0000-000000000016', NULL, 'b0000001-0000-0000-0000-000000000035', 'Skin the Cat', 4, 5, 90, 1),
  ('f2000001-0000-0000-0000-000000000063', 'f1000001-0000-0000-0000-000000000016', NULL, 'b0000001-0000-0000-0000-000000000019', 'Dip', 4, 10, 60, 2),
  ('f2000001-0000-0000-0000-000000000064', 'f1000001-0000-0000-0000-000000000016', NULL, 'b0000001-0000-0000-0000-000000000049', 'Shoulder Dislocates', 3, 15, 30, 3),
  -- Back Lever Foundation — Thursday
  ('f2000001-0000-0000-0000-000000000065', 'f1000001-0000-0000-0000-000000000017', NULL, 'b0000001-0000-0000-0000-000000000030', 'Back Lever Hold', 4, 10, 120, 0),
  ('f2000001-0000-0000-0000-000000000066', 'f1000001-0000-0000-0000-000000000017', NULL, 'b0000001-0000-0000-0000-000000000017', 'Pull-Up', 4, 8, 90, 1),
  ('f2000001-0000-0000-0000-000000000067', 'f1000001-0000-0000-0000-000000000017', NULL, 'b0000001-0000-0000-0000-000000000022', 'Pike Push-Up', 3, 10, 60, 2),
  ('f2000001-0000-0000-0000-000000000068', 'f1000001-0000-0000-0000-000000000017', NULL, 'b0000001-0000-0000-0000-000000000027', 'Handstand Hold', 3, 20, 60, 3),
  -- Back Lever Foundation — Saturday
  ('f2000001-0000-0000-0000-000000000069', 'f1000001-0000-0000-0000-000000000018', NULL, 'b0000001-0000-0000-0000-000000000035', 'Skin the Cat', 5, 5, 90, 0),
  ('f2000001-0000-0000-0000-000000000070', 'f1000001-0000-0000-0000-000000000018', NULL, 'b0000001-0000-0000-0000-000000000018', 'Chin-Up', 4, 8, 90, 1),
  ('f2000001-0000-0000-0000-000000000071', 'f1000001-0000-0000-0000-000000000018', NULL, 'b0000001-0000-0000-0000-000000000016', 'Push-Up', 3, 20, 45, 2),
  ('f2000001-0000-0000-0000-000000000072', 'f1000001-0000-0000-0000-000000000018', NULL, 'b0000001-0000-0000-0000-000000000025', 'Hollow Hold', 3, 30, 45, 3),
  -- Fat Loss Circuit — Monday
  ('f2000001-0000-0000-0000-000000000073', 'f1000001-0000-0000-0000-000000000019', NULL, 'b0000001-0000-0000-0000-000000000036', 'Burpee', 4, 10, 30, 0),
  ('f2000001-0000-0000-0000-000000000074', 'f1000001-0000-0000-0000-000000000019', NULL, 'b0000001-0000-0000-0000-000000000038', 'Jump Squat', 4, 15, 30, 1),
  ('f2000001-0000-0000-0000-000000000075', 'f1000001-0000-0000-0000-000000000019', NULL, 'b0000001-0000-0000-0000-000000000016', 'Push-Up', 4, 15, 30, 2),
  ('f2000001-0000-0000-0000-000000000076', 'f1000001-0000-0000-0000-000000000019', NULL, 'b0000001-0000-0000-0000-000000000037', 'Mountain Climber', 4, 20, 30, 3),
  -- Fat Loss Circuit — Wednesday
  ('f2000001-0000-0000-0000-000000000077', 'f1000001-0000-0000-0000-000000000020', NULL, 'b0000001-0000-0000-0000-000000000039', 'Box Jump', 4, 10, 30, 0),
  ('f2000001-0000-0000-0000-000000000078', 'f1000001-0000-0000-0000-000000000020', NULL, 'b0000001-0000-0000-0000-000000000032', 'Australian Pull-Up', 4, 12, 30, 1),
  ('f2000001-0000-0000-0000-000000000079', 'f1000001-0000-0000-0000-000000000020', NULL, 'b0000001-0000-0000-0000-000000000019', 'Dip', 4, 10, 30, 2),
  ('f2000001-0000-0000-0000-000000000080', 'f1000001-0000-0000-0000-000000000020', NULL, 'b0000001-0000-0000-0000-000000000024', 'Plank', 3, 45, 15, 3),
  -- Fat Loss Circuit — Friday
  ('f2000001-0000-0000-0000-000000000081', 'f1000001-0000-0000-0000-000000000021', NULL, 'b0000001-0000-0000-0000-000000000042', 'Kettlebell Swing', 4, 15, 30, 0),
  ('f2000001-0000-0000-0000-000000000082', 'f1000001-0000-0000-0000-000000000021', NULL, 'b0000001-0000-0000-0000-000000000041', 'High Knees', 4, 30, 20, 1),
  ('f2000001-0000-0000-0000-000000000083', 'f1000001-0000-0000-0000-000000000021', NULL, 'b0000001-0000-0000-0000-000000000036', 'Burpee', 3, 12, 30, 2),
  ('f2000001-0000-0000-0000-000000000084', 'f1000001-0000-0000-0000-000000000021', NULL, 'b0000001-0000-0000-0000-000000000040', 'Jumping Jacks', 3, 30, 20, 3),
  -- Strength Foundation — Monday (Workout A)
  ('f2000001-0000-0000-0000-000000000085', 'f1000001-0000-0000-0000-000000000022', NULL, 'b0000001-0000-0000-0000-000000000004', 'Barbell Squat', 5, 5, 180, 0),
  ('f2000001-0000-0000-0000-000000000086', 'f1000001-0000-0000-0000-000000000022', NULL, 'b0000001-0000-0000-0000-000000000001', 'Barbell Bench Press', 5, 5, 180, 1),
  ('f2000001-0000-0000-0000-000000000087', 'f1000001-0000-0000-0000-000000000022', NULL, 'b0000001-0000-0000-0000-000000000006', 'Barbell Row', 5, 5, 180, 2),
  -- Strength Foundation — Wednesday (Workout B)
  ('f2000001-0000-0000-0000-000000000088', 'f1000001-0000-0000-0000-000000000023', NULL, 'b0000001-0000-0000-0000-000000000004', 'Barbell Squat', 5, 5, 180, 0),
  ('f2000001-0000-0000-0000-000000000089', 'f1000001-0000-0000-0000-000000000023', NULL, 'b0000001-0000-0000-0000-000000000005', 'Overhead Press', 5, 5, 180, 1),
  ('f2000001-0000-0000-0000-000000000090', 'f1000001-0000-0000-0000-000000000023', NULL, 'b0000001-0000-0000-0000-000000000003', 'Deadlift', 1, 5, 300, 2),
  -- Strength Foundation — Friday (Workout A)
  ('f2000001-0000-0000-0000-000000000091', 'f1000001-0000-0000-0000-000000000024', NULL, 'b0000001-0000-0000-0000-000000000004', 'Barbell Squat', 5, 5, 180, 0),
  ('f2000001-0000-0000-0000-000000000092', 'f1000001-0000-0000-0000-000000000024', NULL, 'b0000001-0000-0000-0000-000000000001', 'Barbell Bench Press', 5, 5, 180, 1),
  ('f2000001-0000-0000-0000-000000000093', 'f1000001-0000-0000-0000-000000000024', NULL, 'b0000001-0000-0000-0000-000000000006', 'Barbell Row', 5, 5, 180, 2)
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════════
-- 5. RECOMMENDATION RULES (14 items)
-- ════════════════════════════════════════════════════════════════════════════════

INSERT INTO recommendation_rules (id, name, category, description, enabled, priority, evaluator_type)
VALUES
  ('aa000001-0000-0000-0000-000000000001', 'Low Protein Intake', 'Nutrition', 'Se activa cuando la proteína promedio de 3 días está por debajo del 70% del objetivo.', TRUE, 'High', 'rule-based'),
  ('aa000001-0000-0000-0000-000000000002', 'High Calorie Intake', 'Nutrition', 'Se activa cuando las calorías promedio superan el 115% del objetivo por 3+ días.', TRUE, 'High', 'rule-based'),
  ('aa000001-0000-0000-0000-000000000003', 'No Meals Logged', 'Nutrition', 'Se activa cuando no se han registrado comidas hoy.', TRUE, 'Medium', 'rule-based'),
  ('aa000001-0000-0000-0000-000000000004', 'Inactive Week', 'Training', 'Se activa cuando no hay entrenamientos completados en 7 días.', TRUE, 'Critical', 'rule-based'),
  ('aa000001-0000-0000-0000-000000000005', 'Low Training Frequency', 'Training', 'Se activa cuando hay menos de 3 entrenamientos esta semana.', TRUE, 'Medium', 'rule-based'),
  ('aa000001-0000-0000-0000-000000000006', 'Consistency Improvement', 'Consistency', 'Se activa cuando la frecuencia de entrenamiento mejora semana a semana.', TRUE, 'Low', 'rule-based'),
  ('aa000001-0000-0000-0000-000000000007', 'Weight Loss Plateau', 'Weight Management', 'Se activa cuando el peso no cambia significativamente en 21+ días (objetivo: perder grasa).', TRUE, 'High', 'rule-based'),
  ('aa000001-0000-0000-0000-000000000008', 'Rapid Weight Loss', 'Weight Management', 'Se activa cuando se pierde más de 1kg por semana.', TRUE, 'High', 'rule-based'),
  ('aa000001-0000-0000-0000-000000000009', 'Waist Improving', 'Goal Achievement', 'Se activa cuando la medida de cintura está disminuyendo.', TRUE, 'Low', 'rule-based'),
  ('aa000001-0000-0000-0000-000000000010', 'Measurements Stagnant', 'Weight Management', 'Se activa cuando las medidas no cambian en 30+ días.', TRUE, 'Medium', 'rule-based'),
  ('aa000001-0000-0000-0000-000000000011', 'Long Workout Sessions', 'Recovery', 'Se activa cuando las sesiones promedio superan 90 minutos.', TRUE, 'Medium', 'rule-based'),
  ('aa000001-0000-0000-0000-000000000012', 'Overtraining Risk', 'Recovery', 'Se activa cuando se entrena 6+ días por semana consistentemente.', TRUE, 'High', 'rule-based'),
  ('aa000001-0000-0000-0000-000000000013', 'Goal Nearly Reached', 'Motivation', 'Se activa cuando el usuario está a menos de 2kg de su peso objetivo.', TRUE, 'Low', 'rule-based'),
  ('aa000001-0000-0000-0000-000000000014', 'New Streak Milestone', 'Motivation', 'Se activa al alcanzar hitos de racha: 7, 14, 30, 60, 90 días.', TRUE, 'Low', 'rule-based')
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════════
-- 6. PLATFORM SETTINGS
-- ════════════════════════════════════════════════════════════════════════════════

INSERT INTO platform_settings (id, key, value)
VALUES
  ('ab000001-0000-0000-0000-000000000001', 'app_name', '"Movive"'),
  ('ab000001-0000-0000-0000-000000000002', 'support_email', '"soporte@movive.app"'),
  ('ab000001-0000-0000-0000-000000000003', 'free_plan_ai_limit', '20'),
  ('ab000001-0000-0000-0000-000000000004', 'trial_days', '7'),
  ('ab000001-0000-0000-0000-000000000005', 'maintenance_mode', 'false'),
  ('ab000001-0000-0000-0000-000000000006', 'feature_toggles', '{"ai_coach": true, "meal_planner": true, "shopping_lists": true, "progress_photos": true, "analytics": true, "recommendations": true}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ════════════════════════════════════════════════════════════════════════════════
-- 7. SUPER ADMIN BOOTSTRAP
--
-- Idempotent: Updates role if user exists, does nothing if not.
-- The admin auth.users record must be created first via Supabase Dashboard.
-- The auth trigger (00004) will create the public.users row automatically.
-- This UPDATE ensures the role is SUPER_ADMIN regardless of trigger default.
-- ════════════════════════════════════════════════════════════════════════════════

UPDATE users
SET role = 'SUPER_ADMIN', updated_at = NOW()
WHERE email = 'admin@movive.app';

-- If no rows affected, the admin hasn't signed up yet — that's OK.
-- The trigger will create a USER row when they sign up, and this seed
-- should be re-run after admin creation to promote to SUPER_ADMIN.

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════
-- END OF SEED
-- ════════════════════════════════════════════════════════════════════════════════
