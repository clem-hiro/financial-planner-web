"use client";

export type ContributionMode = "until_retirement" | "fixed_duration";
export type FixedScheduleMode = "duration_years" | "calendar_dates";

export function InvestmentContributionScheduleFields({
  contributionMode,
  onContributionModeChange,
  fixedScheduleMode,
  onFixedScheduleModeChange,
  durationYearsRaw,
  onDurationYearsChange,
  startDateRaw,
  onStartDateChange,
  endDateRaw,
  onEndDateChange,
  inputClassName,
}: {
  contributionMode: ContributionMode;
  onContributionModeChange: (mode: ContributionMode) => void;
  fixedScheduleMode: FixedScheduleMode;
  onFixedScheduleModeChange: (mode: FixedScheduleMode) => void;
  durationYearsRaw: string;
  onDurationYearsChange: (value: string) => void;
  startDateRaw: string;
  onStartDateChange: (value: string) => void;
  endDateRaw: string;
  onEndDateChange: (value: string) => void;
  inputClassName: string;
}) {
  return (
    <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
      <legend className="text-sm font-medium text-slate-800">
        How long will you contribute monthly?
      </legend>
      <p className="mt-1 text-xs text-slate-500">
        After this phase, we still grow what you already built—we only stop adding
        new monthly deposits. For ILPs and endowments, use calendar dates when you
        know premium start and end.
      </p>
      <div className="mt-3 space-y-2.5">
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
          <input
            type="radio"
            name="contribution_type"
            value="until_retirement"
            className="mt-0.5"
            checked={contributionMode === "until_retirement"}
            onChange={() => onContributionModeChange("until_retirement")}
          />
          <span>
            <span className="font-medium text-slate-900">Until retirement</span>
            <span className="mt-0.5 block text-xs font-normal text-slate-500">
              Uses your profile retirement age when set; otherwise the full
              projection window.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
          <input
            type="radio"
            name="contribution_type"
            value="fixed_duration"
            className="mt-0.5"
            checked={contributionMode === "fixed_duration"}
            onChange={() => onContributionModeChange("fixed_duration")}
          />
          <span>
            <span className="font-medium text-slate-900">Fixed period</span>
            <span className="mt-0.5 block text-xs font-normal text-slate-500">
              Time-bound premiums (ILPs, education plans, endowments).
            </span>
          </span>
        </label>
      </div>

      {contributionMode === "fixed_duration" ? (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium text-slate-700">Premium window</p>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 has-[:checked]:border-emerald-300 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-900">
              <input
                type="radio"
                name="contribution_schedule_mode"
                value="duration_years"
                className="sr-only"
                checked={fixedScheduleMode === "duration_years"}
                onChange={() => onFixedScheduleModeChange("duration_years")}
              />
              By years from today
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 has-[:checked]:border-emerald-300 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-900">
              <input
                type="radio"
                name="contribution_schedule_mode"
                value="calendar_dates"
                className="sr-only"
                checked={fixedScheduleMode === "calendar_dates"}
                onChange={() => onFixedScheduleModeChange("calendar_dates")}
              />
              By start / end dates
            </label>
          </div>

          {fixedScheduleMode === "duration_years" ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-800">
                Contribution duration (years)
              </span>
              <input
                name="contribution_duration_years"
                type="number"
                min={0.25}
                max={80}
                step={0.25}
                required
                value={durationYearsRaw}
                onChange={(e) => onDurationYearsChange(e.target.value)}
                className={`${inputClassName} max-w-xs`}
              />
            </label>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-800">
                  Premium start (optional)
                </span>
                <input
                  name="contribution_start_date"
                  type="date"
                  value={startDateRaw}
                  onChange={(e) => onStartDateChange(e.target.value)}
                  className={inputClassName}
                />
                <span className="mt-1 block text-[11px] text-slate-500">
                  Leave blank if you are already paying premiums today.
                </span>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-800">
                  Premium / contribution end
                </span>
                <input
                  name="contribution_end_date"
                  type="date"
                  required
                  value={endDateRaw}
                  onChange={(e) => onEndDateChange(e.target.value)}
                  className={inputClassName}
                />
              </label>
            </div>
          )}
        </div>
      ) : null}
    </fieldset>
  );
}
