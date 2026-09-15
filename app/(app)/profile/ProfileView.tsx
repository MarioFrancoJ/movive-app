"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

type ProfileDict = ReturnType<typeof useDictionary>["dict"]["account"]["profile"];

interface PersonalInfo {
  fullName: string;
  email: string;
  gender: string;
  dateOfBirth: string;
  height: string;
  activityLevel: string;
  fitnessGoal: string;
}

interface WeightInfo {
  currentWeight: string;
  goalWeight: string;
  startingWeight: string;
}

interface BodyMeasurements {
  neck: string;
  chest: string;
  waist: string;
  hips: string;
  leftArm: string;
  rightArm: string;
  leftThigh: string;
  rightThigh: string;
  leftCalf: string;
  rightCalf: string;
}

interface MeasurementRecord {
  id: string;
  date: string;
  weight: string;
  measurements: BodyMeasurements;
}

interface ProfileData {
  personalInfo: PersonalInfo;
  weight: WeightInfo;
  measurements: BodyMeasurements;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GENDERS = ["Male", "Female", "Other"];
const ACTIVITY_LEVELS = ["Sedentary", "Lightly Active", "Moderately Active", "Very Active", "Athlete"];
const FITNESS_GOALS = ["Lose Fat", "Build Muscle", "Maintain Weight", "Improve Performance", "Calisthenics Skills"];

// ── Enum label helpers (value = logic key stored in DB, display via dict) ───────

function genderLabel(value: string, t: ProfileDict): string {
  switch (value) {
    case "Male":   return t.genderMale;
    case "Female": return t.genderFemale;
    case "Other":  return t.genderOther;
    default:       return value;
  }
}

function activityLabel(value: string, t: ProfileDict): string {
  switch (value) {
    case "Sedentary":         return t.activitySedentary;
    case "Lightly Active":    return t.activityLightlyActive;
    case "Moderately Active": return t.activityModeratelyActive;
    case "Very Active":       return t.activityVeryActive;
    case "Athlete":           return t.activityAthlete;
    default:                  return value;
  }
}

function goalLabel(value: string, t: ProfileDict): string {
  switch (value) {
    case "Lose Fat":            return t.goalLoseFat;
    case "Build Muscle":        return t.goalBuildMuscle;
    case "Maintain Weight":     return t.goalMaintainWeight;
    case "Improve Performance": return t.goalImprovePerformance;
    case "Calisthenics Skills": return t.goalCalisthenics;
    default:                    return value;
  }
}

function photoAngleLabel(value: "Front" | "Side" | "Back", t: ProfileDict): string {
  switch (value) {
    case "Front": return t.photoFront;
    case "Side":  return t.photoSide;
    case "Back":  return t.photoBack;
  }
}

const EMPTY_PERSONAL: PersonalInfo = {
  fullName: "",
  email: "",
  gender: "",
  dateOfBirth: "",
  height: "",
  activityLevel: "",
  fitnessGoal: "",
};

const EMPTY_WEIGHT: WeightInfo = {
  currentWeight: "",
  goalWeight: "",
  startingWeight: "",
};

const EMPTY_MEASUREMENTS: BodyMeasurements = {
  neck: "",
  chest: "",
  waist: "",
  hips: "",
  leftArm: "",
  rightArm: "",
  leftThigh: "",
  rightThigh: "",
  leftCalf: "",
  rightCalf: "",
};

// ── Storage helpers ───────────────────────────────────────────────────────────

async function loadProfileFromSupabase(): Promise<ProfileData> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { personalInfo: EMPTY_PERSONAL, weight: EMPTY_WEIGHT, measurements: EMPTY_MEASUREMENTS };

  const { data } = await supabase
    .from("users")
    .select("name, email, gender, date_of_birth, height_cm, weight_kg, goal_weight_kg, activity_level, fitness_goal")
    .eq("id", user.id)
    .single();

  if (!data) return { personalInfo: EMPTY_PERSONAL, weight: EMPTY_WEIGHT, measurements: EMPTY_MEASUREMENTS };

  return {
    personalInfo: {
      fullName: data.name || "",
      email: data.email || "",
      gender: data.gender || "",
      dateOfBirth: data.date_of_birth || "",
      height: data.height_cm?.toString() || "",
      activityLevel: data.activity_level || "",
      fitnessGoal: data.fitness_goal || "",
    },
    weight: {
      currentWeight: data.weight_kg?.toString() || "",
      goalWeight: data.goal_weight_kg?.toString() || "",
      startingWeight: "",
    },
    measurements: EMPTY_MEASUREMENTS,
  };
}

async function saveProfileToSupabase(data: ProfileData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("users")
    .update({
      name: data.personalInfo.fullName || undefined,
      gender: data.personalInfo.gender || undefined,
      date_of_birth: data.personalInfo.dateOfBirth || undefined,
      height_cm: data.personalInfo.height ? parseFloat(data.personalInfo.height) : undefined,
      activity_level: data.personalInfo.activityLevel || undefined,
      fitness_goal: data.personalInfo.fitnessGoal || undefined,
      weight_kg: data.weight.currentWeight ? parseFloat(data.weight.currentWeight) : undefined,
      goal_weight_kg: data.weight.goalWeight ? parseFloat(data.weight.goalWeight) : undefined,
    })
    .eq("id", user.id);
}

async function loadHistoryFromSupabase(): Promise<MeasurementRecord[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("measurement_entries")
    .select("id, date, weight_kg, neck_cm, chest_cm, waist_cm, hips_cm, left_arm_cm, right_arm_cm, left_thigh_cm, right_thigh_cm, left_calf_cm, right_calf_cm")
    .order("date", { ascending: false });

  if (!data) return [];

  return data.map((row) => ({
    id: row.id,
    date: row.date,
    weight: row.weight_kg?.toString() || "",
    measurements: {
      neck: row.neck_cm?.toString() || "",
      chest: row.chest_cm?.toString() || "",
      waist: row.waist_cm?.toString() || "",
      hips: row.hips_cm?.toString() || "",
      leftArm: row.left_arm_cm?.toString() || "",
      rightArm: row.right_arm_cm?.toString() || "",
      leftThigh: row.left_thigh_cm?.toString() || "",
      rightThigh: row.right_thigh_cm?.toString() || "",
      leftCalf: row.left_calf_cm?.toString() || "",
      rightCalf: row.right_calf_cm?.toString() || "",
    },
  }));
}

async function saveMeasurementToSupabase(measurements: BodyMeasurements, weightKg: string): Promise<MeasurementRecord | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date().toISOString().split("T")[0];

  const { data: inserted } = await supabase
    .from("measurement_entries")
    .insert({
      user_id: user.id,
      date: today,
      weight_kg: weightKg ? parseFloat(weightKg) : null,
      neck_cm: measurements.neck ? parseFloat(measurements.neck) : null,
      chest_cm: measurements.chest ? parseFloat(measurements.chest) : null,
      waist_cm: measurements.waist ? parseFloat(measurements.waist) : null,
      hips_cm: measurements.hips ? parseFloat(measurements.hips) : null,
      left_arm_cm: measurements.leftArm ? parseFloat(measurements.leftArm) : null,
      right_arm_cm: measurements.rightArm ? parseFloat(measurements.rightArm) : null,
      left_thigh_cm: measurements.leftThigh ? parseFloat(measurements.leftThigh) : null,
      right_thigh_cm: measurements.rightThigh ? parseFloat(measurements.rightThigh) : null,
      left_calf_cm: measurements.leftCalf ? parseFloat(measurements.leftCalf) : null,
      right_calf_cm: measurements.rightCalf ? parseFloat(measurements.rightCalf) : null,
    })
    .select("id, date")
    .single();

  if (!inserted) return null;

  return {
    id: inserted.id,
    date: inserted.date,
    weight: weightKg,
    measurements: { ...measurements },
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateNumeric(value: string, min: number, max: number, t: ProfileDict): string | undefined {
  if (!value) return undefined;
  const n = parseFloat(value);
  if (isNaN(n)) return t.validationNumber;
  if (n < min) return t.validationMin.replace("{n}", String(min));
  if (n > max) return t.validationMax.replace("{n}", String(max));
  return undefined;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-border-brand bg-white px-5 py-3.5 shadow-lg"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success-light">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-success" aria-hidden="true">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
        </svg>
      </span>
      <p className="text-sm font-medium text-zinc-800">{message}</p>
      <button type="button" onClick={onClose} aria-label="Dismiss" className="ml-1 text-zinc-400 hover:text-zinc-600 focus-visible:outline-none">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-900">{title}</p>
          {description && <p className="mt-0.5 text-xs text-zinc-400">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfileView() {
  const { dict } = useDictionary();
  const t = dict.account.profile;
  const { success: showToast } = useToast();
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>(EMPTY_PERSONAL);
  const [weight, setWeight] = useState<WeightInfo>(EMPTY_WEIGHT);
  const [measurements, setMeasurements] = useState<BodyMeasurements>(EMPTY_MEASUREMENTS);
  const [history, setHistory] = useState<MeasurementRecord[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});


  // Hydrate
  useEffect(() => {
    async function loadAll() {
      const [profile, measurementHistory] = await Promise.all([
        loadProfileFromSupabase(),
        loadHistoryFromSupabase(),
      ]);
      setPersonalInfo(profile.personalInfo);
      setWeight(profile.weight);
      setMeasurements(profile.measurements);
      setHistory(measurementHistory);
      setHydrated(true);
    }
    loadAll();
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────────

  function validate(): boolean {
    const e: Record<string, string | undefined> = {};
    e.height = validateNumeric(personalInfo.height, 50, 300, t);
    e.currentWeight = validateNumeric(weight.currentWeight, 20, 500, t);
    e.goalWeight = validateNumeric(weight.goalWeight, 20, 500, t);
    e.startingWeight = validateNumeric(weight.startingWeight, 20, 500, t);
    e.neck = validateNumeric(measurements.neck, 10, 100, t);
    e.chest = validateNumeric(measurements.chest, 30, 200, t);
    e.waist = validateNumeric(measurements.waist, 30, 200, t);
    e.hips = validateNumeric(measurements.hips, 30, 200, t);
    e.leftArm = validateNumeric(measurements.leftArm, 10, 100, t);
    e.rightArm = validateNumeric(measurements.rightArm, 10, 100, t);
    e.leftThigh = validateNumeric(measurements.leftThigh, 15, 120, t);
    e.rightThigh = validateNumeric(measurements.rightThigh, 15, 120, t);
    e.leftCalf = validateNumeric(measurements.leftCalf, 10, 80, t);
    e.rightCalf = validateNumeric(measurements.rightCalf, 10, 80, t);
    setErrors(e);
    return !Object.values(e).some(Boolean);
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const data: ProfileData = { personalInfo, weight, measurements };
    await saveProfileToSupabase(data);

    // Add measurement record to history via Supabase
    const hasAnyMeasurement = Object.values(measurements).some((v) => v !== "");
    if (hasAnyMeasurement || weight.currentWeight) {
      const record = await saveMeasurementToSupabase(measurements, weight.currentWeight);
      if (record) {
        setHistory((prev) => [record, ...prev]);
      }
    }

    setEditMode(false);
    showToast(t.toastSaved);
  }

  function handleCancel() {
    Promise.all([loadProfileFromSupabase(), loadHistoryFromSupabase()]).then(
      ([profile, measurementHistory]) => {
        setPersonalInfo(profile.personalInfo);
        setWeight(profile.weight);
        setMeasurements(profile.measurements);
        setHistory(measurementHistory);
        setErrors({});
        setEditMode(false);
      }
    );
  }

  // ── Weight change indicator ────────────────────────────────────────────────

  const current = weight.currentWeight ? parseFloat(weight.currentWeight) : null;
  const starting = weight.startingWeight ? parseFloat(weight.startingWeight) : null;
  const goal = weight.goalWeight ? parseFloat(weight.goalWeight) : null;
  const weightChange = current !== null && starting !== null ? current - starting : null;

  if (!hydrated) return null;

  const disabled = !editMode;

  return (
    <>
      <form onSubmit={handleSave} className="flex flex-col gap-6">
        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {t.subtitle}
            </p>
          </div>
          <div className="flex gap-2">
            {editMode ? (
              <>
                <Button type="button" variant="secondary" onClick={handleCancel}>
                  {dict.common.cancel}
                </Button>
                <Button type="submit">{dict.common.save}</Button>
              </>
            ) : (
              <Button type="button" onClick={() => setEditMode(true)}>
                {t.editProfile}
              </Button>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            1. PERSONAL INFORMATION
        ═══════════════════════════════════════════════════════════════════════ */}
        <Section title={t.sectionPersonalInfo} description={t.sectionPersonalInfoDesc}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              id="fullName"
              label={t.fieldFullName}
              value={personalInfo.fullName}
              onChange={(e) => setPersonalInfo((p) => ({ ...p, fullName: e.target.value }))}
              placeholder={t.fieldFullNamePlaceholder}
              disabled={disabled}
            />
            <Input
              id="email"
              label={t.fieldEmail}
              type="email"
              value={personalInfo.email}
              onChange={(e) => setPersonalInfo((p) => ({ ...p, email: e.target.value }))}
              placeholder={t.fieldEmailPlaceholder}
              disabled
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="gender" className="text-sm font-medium text-zinc-700">{t.fieldGender}</label>
              <select
                id="gender"
                value={personalInfo.gender}
                onChange={(e) => setPersonalInfo((p) => ({ ...p, gender: e.target.value }))}
                disabled={disabled}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">{dict.common.select}</option>
                {GENDERS.map((g) => <option key={g} value={g}>{genderLabel(g, t)}</option>)}
              </select>
            </div>
            <Input
              id="dateOfBirth"
              label={t.fieldDateOfBirth}
              type="date"
              value={personalInfo.dateOfBirth}
              onChange={(e) => setPersonalInfo((p) => ({ ...p, dateOfBirth: e.target.value }))}
              disabled={disabled}
            />
            <Input
              id="height"
              label={t.fieldHeight}
              type="number"
              value={personalInfo.height}
              onChange={(e) => setPersonalInfo((p) => ({ ...p, height: e.target.value }))}
              placeholder={t.fieldHeightPlaceholder}
              step={0.1}
              min={50}
              max={300}
              disabled={disabled}
              error={errors.height}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="activityLevel" className="text-sm font-medium text-zinc-700">{t.fieldActivityLevel}</label>
              <select
                id="activityLevel"
                value={personalInfo.activityLevel}
                onChange={(e) => setPersonalInfo((p) => ({ ...p, activityLevel: e.target.value }))}
                disabled={disabled}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">{dict.common.select}</option>
                {ACTIVITY_LEVELS.map((a) => <option key={a} value={a}>{activityLabel(a, t)}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fitnessGoal" className="text-sm font-medium text-zinc-700">{t.fieldFitnessGoal}</label>
              <select
                id="fitnessGoal"
                value={personalInfo.fitnessGoal}
                onChange={(e) => setPersonalInfo((p) => ({ ...p, fitnessGoal: e.target.value }))}
                disabled={disabled}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">{dict.common.select}</option>
                {FITNESS_GOALS.map((g) => <option key={g} value={g}>{goalLabel(g, t)}</option>)}
              </select>
            </div>
          </div>
        </Section>

        {/* ═══════════════════════════════════════════════════════════════════════
            2. WEIGHT MANAGEMENT
        ═══════════════════════════════════════════════════════════════════════ */}
        <Section title={t.sectionWeight} description={t.sectionWeightDesc}>
          {/* Summary cards */}
          <div className="mb-5 grid gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-1 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
              <p className="text-xs font-medium text-zinc-400">{t.weightCurrent}</p>
              <p className="text-xl font-bold text-zinc-900">
                {current !== null ? `${current} kg` : "—"}
              </p>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
              <p className="text-xs font-medium text-zinc-400">{t.weightGoal}</p>
              <p className="text-xl font-bold text-zinc-900">
                {goal !== null ? `${goal} kg` : "—"}
              </p>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
              <p className="text-xs font-medium text-zinc-400">{t.weightStarting}</p>
              <p className="text-xl font-bold text-zinc-900">
                {starting !== null ? `${starting} kg` : "—"}
              </p>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
              <p className="text-xs font-medium text-zinc-400">{t.weightChange}</p>
              <p
                className={[
                  "text-xl font-bold",
                  weightChange !== null && weightChange < 0
                    ? "text-success"
                    : weightChange !== null && weightChange > 0
                    ? "text-red-500"
                    : "text-zinc-900",
                ].join(" ")}
              >
                {weightChange !== null
                  ? `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} kg`
                  : "—"}
              </p>
            </div>
          </div>

          {/* Inputs */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              id="currentWeight"
              label={t.fieldCurrentWeight}
              type="number"
              value={weight.currentWeight}
              onChange={(e) => setWeight((w) => ({ ...w, currentWeight: e.target.value }))}
              placeholder={t.fieldCurrentWeightPlaceholder}
              step={0.1}
              min={20}
              max={500}
              disabled={disabled}
              error={errors.currentWeight}
            />
            <Input
              id="goalWeight"
              label={t.fieldGoalWeight}
              type="number"
              value={weight.goalWeight}
              onChange={(e) => setWeight((w) => ({ ...w, goalWeight: e.target.value }))}
              placeholder={t.fieldGoalWeightPlaceholder}
              step={0.1}
              min={20}
              max={500}
              disabled={disabled}
              error={errors.goalWeight}
            />
            <Input
              id="startingWeight"
              label={t.fieldStartingWeight}
              type="number"
              value={weight.startingWeight}
              onChange={(e) => setWeight((w) => ({ ...w, startingWeight: e.target.value }))}
              placeholder={t.fieldStartingWeightPlaceholder}
              step={0.1}
              min={20}
              max={500}
              disabled={disabled}
              error={errors.startingWeight}
            />
          </div>
        </Section>

        {/* ═══════════════════════════════════════════════════════════════════════
            3. BODY MEASUREMENTS
        ═══════════════════════════════════════════════════════════════════════ */}
        <Section title={t.sectionBodyMeasurements} description={t.sectionBodyMeasurementsDesc}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Input
              id="neck" label={t.measureNeck} type="number" value={measurements.neck}
              onChange={(e) => setMeasurements((m) => ({ ...m, neck: e.target.value }))}
              placeholder="38" step={0.1} min={10} max={100} disabled={disabled} error={errors.neck}
            />
            <Input
              id="chest" label={t.measureChest} type="number" value={measurements.chest}
              onChange={(e) => setMeasurements((m) => ({ ...m, chest: e.target.value }))}
              placeholder="100" step={0.1} min={30} max={200} disabled={disabled} error={errors.chest}
            />
            <Input
              id="waist" label={t.measureWaist} type="number" value={measurements.waist}
              onChange={(e) => setMeasurements((m) => ({ ...m, waist: e.target.value }))}
              placeholder="80" step={0.1} min={30} max={200} disabled={disabled} error={errors.waist}
            />
            <Input
              id="hips" label={t.measureHips} type="number" value={measurements.hips}
              onChange={(e) => setMeasurements((m) => ({ ...m, hips: e.target.value }))}
              placeholder="95" step={0.1} min={30} max={200} disabled={disabled} error={errors.hips}
            />
            <Input
              id="leftArm" label={t.measureLeftArm} type="number" value={measurements.leftArm}
              onChange={(e) => setMeasurements((m) => ({ ...m, leftArm: e.target.value }))}
              placeholder="35" step={0.1} min={10} max={100} disabled={disabled} error={errors.leftArm}
            />
            <Input
              id="rightArm" label={t.measureRightArm} type="number" value={measurements.rightArm}
              onChange={(e) => setMeasurements((m) => ({ ...m, rightArm: e.target.value }))}
              placeholder="35" step={0.1} min={10} max={100} disabled={disabled} error={errors.rightArm}
            />
            <Input
              id="leftThigh" label={t.measureLeftThigh} type="number" value={measurements.leftThigh}
              onChange={(e) => setMeasurements((m) => ({ ...m, leftThigh: e.target.value }))}
              placeholder="55" step={0.1} min={15} max={120} disabled={disabled} error={errors.leftThigh}
            />
            <Input
              id="rightThigh" label={t.measureRightThigh} type="number" value={measurements.rightThigh}
              onChange={(e) => setMeasurements((m) => ({ ...m, rightThigh: e.target.value }))}
              placeholder="55" step={0.1} min={15} max={120} disabled={disabled} error={errors.rightThigh}
            />
            <Input
              id="leftCalf" label={t.measureLeftCalf} type="number" value={measurements.leftCalf}
              onChange={(e) => setMeasurements((m) => ({ ...m, leftCalf: e.target.value }))}
              placeholder="38" step={0.1} min={10} max={80} disabled={disabled} error={errors.leftCalf}
            />
            <Input
              id="rightCalf" label={t.measureRightCalf} type="number" value={measurements.rightCalf}
              onChange={(e) => setMeasurements((m) => ({ ...m, rightCalf: e.target.value }))}
              placeholder="38" step={0.1} min={10} max={80} disabled={disabled} error={errors.rightCalf}
            />
          </div>
        </Section>

        {/* ═══════════════════════════════════════════════════════════════════════
            4. PROGRESS PHOTOS
        ═══════════════════════════════════════════════════════════════════════ */}
        <Section title={t.sectionProgressPhotos} description={t.sectionProgressPhotosDesc}>
          <div className="grid gap-4 sm:grid-cols-3">
            {(["Front", "Side", "Back"] as const).map((angle) => (
              <div key={angle} className="flex flex-col items-center gap-3">
                {/* Placeholder image */}
                <div className="flex h-48 w-full items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50">
                  <div className="flex flex-col items-center gap-2 text-zinc-400">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-8 w-8" aria-hidden="true">
                      <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.219a.75.75 0 0 0-1.06 0l-1.91 1.909-4.97-4.969a.75.75 0 0 0-1.06 0L2.5 11.06Zm12.22-4.81a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs font-medium">{t.photoLabel.replace("{angle}", photoAngleLabel(angle, t))}</span>
                  </div>
                </div>
                <p className="text-xs font-medium text-zinc-500">{photoAngleLabel(angle, t)}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-zinc-400">
            {t.photoUploadNote}
          </p>
        </Section>
      </form>

      {/* ═══════════════════════════════════════════════════════════════════════
          5. HISTORY
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="mt-6 rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <p className="text-sm font-semibold text-zinc-900">
            {t.historyHeading}
            <span className="ml-2 text-xs font-normal text-zinc-400">
              {t.historyRecordCount.replace("{n}", String(history.length))}
            </span>
          </p>
        </div>

        {history.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-zinc-400">{t.historyEmpty}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.colDate}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.colWeight}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.colNeck}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.colChest}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.colWaist}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.colHips}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.colLArm}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.colRArm}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.colLThigh}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.colRThigh}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.colLCalf}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">{t.colRCalf}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {history.map((record) => (
                  <tr key={record.id} className="hover:bg-zinc-50">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-900">{record.date}</td>
                    <td className="px-4 py-3 text-zinc-600">{record.weight ? `${record.weight} kg` : "—"}</td>
                    <td className="px-4 py-3 text-zinc-600">{record.measurements.neck || "—"}</td>
                    <td className="px-4 py-3 text-zinc-600">{record.measurements.chest || "—"}</td>
                    <td className="px-4 py-3 text-zinc-600">{record.measurements.waist || "—"}</td>
                    <td className="px-4 py-3 text-zinc-600">{record.measurements.hips || "—"}</td>
                    <td className="px-4 py-3 text-zinc-600">{record.measurements.leftArm || "—"}</td>
                    <td className="px-4 py-3 text-zinc-600">{record.measurements.rightArm || "—"}</td>
                    <td className="px-4 py-3 text-zinc-600">{record.measurements.leftThigh || "—"}</td>
                    <td className="px-4 py-3 text-zinc-600">{record.measurements.rightThigh || "—"}</td>
                    <td className="px-4 py-3 text-zinc-600">{record.measurements.leftCalf || "—"}</td>
                    <td className="px-4 py-3 text-zinc-600">{record.measurements.rightCalf || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Toast */}
    </>
  );
}
