"use client";

import {
  BONUS_MONTH_PRESETS,
  type BonusMonthPresetId,
} from "@/domain/finance/onboarding-income";
import { onboardingChoiceChipClass } from "@/features/onboarding/onboarding-ui";
import { fpInputClass } from "@/ui/input-classes";

type Props = {
  preset: BonusMonthPresetId;
  customAmount: string;
  onPresetChange: (preset: BonusMonthPresetId) => void;
  onCustomAmountChange: (value: string) => void;
  disabled?: boolean;
};

export function BonusMonthSelector({
  preset,
  customAmount,
  onPresetChange,
  onCustomAmountChange,
  disabled = false,
}: Props) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-slate-500">
        Annual bonus{" "}
        <span className="font-normal text-slate-400">(optional)</span>
      </span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Bonus months">
        {BONUS_MONTH_PRESETS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            onClick={() => onPresetChange(opt.id)}
            className={`${onboardingChoiceChipClass(preset === opt.id)} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <label className="block space-y-1">
          <span className="text-xs text-slate-500">Custom annual bonus (gross)</span>
          <input
            className={fpInputClass}
            type="number"
            min={0}
            step="0.01"
            disabled={disabled}
            value={customAmount}
            onChange={(e) => onCustomAmountChange(e.target.value)}
            placeholder="e.g. 15000"
          />
        </label>
      )}
    </div>
  );
}
