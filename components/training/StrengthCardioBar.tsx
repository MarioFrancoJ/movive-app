"use client";

export interface StrengthCardioBarProps {
  strengthPct: number;
  cardioPct: number;
  labels: {
    title: string;
    strength: string;
    cardio: string;
  };
}

export default function StrengthCardioBar({
  strengthPct,
  cardioPct,
  labels,
}: StrengthCardioBarProps) {
  if (strengthPct === 0 && cardioPct === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-zinc-900">{labels.title}</p>

      <div className="mt-3 flex items-center justify-between text-xs font-medium">
        <span className="inline-flex items-center gap-1.5 text-zinc-700">
          <span aria-hidden="true">💪</span>
          <span>{labels.strength}</span>
          <span className="font-bold text-zinc-900">{strengthPct}%</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-zinc-700">
          <span aria-hidden="true">❤️</span>
          <span>{labels.cardio}</span>
          <span className="font-bold text-zinc-900">{cardioPct}%</span>
        </span>
      </div>

      {/* Barra apilada — verde Movive para Fuerza, naranja para Cardio */}
      <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        {strengthPct > 0 && (
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${strengthPct}%` }}
            aria-label={`${labels.strength}: ${strengthPct}%`}
          />
        )}
        {cardioPct > 0 && (
          <div
            className="h-full bg-orange-500 transition-all"
            style={{ width: `${cardioPct}%` }}
            aria-label={`${labels.cardio}: ${cardioPct}%`}
          />
        )}
      </div>
    </div>
  );
}
