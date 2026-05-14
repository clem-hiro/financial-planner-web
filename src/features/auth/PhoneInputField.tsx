"use client";

import PhoneInput, { type Value } from "react-phone-number-input";
import type { CSSProperties, SelectHTMLAttributes } from "react";

type CountryOption = {
  value?: string;
  label: string;
  divider?: boolean;
};

type CountrySelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "onChange" | "value"
> & {
  value?: string;
  onChange: (value?: string) => void;
  options: CountryOption[];
  readOnly?: boolean;
  iconComponent?: unknown;
  getIconAspectRatio?: unknown;
  arrowComponent?: unknown;
  unicodeFlags?: unknown;
  controlClassName?: string;
  flagClassName?: string;
  selectClassName?: string;
};

type PhoneInputVariant = "prominent" | "auth";

const phoneInputLayoutStyle = {
  alignItems: "center",
  display: "grid",
  gap: "0.5rem",
  gridTemplateColumns: "clamp(7.5rem, 28vw, 11rem) minmax(0, 1fr)",
  width: "100%",
} satisfies CSSProperties;

const variantClasses: Record<
  PhoneInputVariant,
  {
    countryControl: string;
    flag: string;
    input: string;
    select: string;
  }
> = {
  prominent: {
    countryControl:
      "grid min-h-11 w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-slate-400 bg-white px-3 py-2 text-slate-900 shadow-sm transition focus-within:border-emerald-500/75 focus-within:ring-2 focus-within:ring-emerald-500/20",
    flag:
      "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-50 text-[0.78rem] leading-none",
    input:
      "min-h-11 w-full min-w-0 rounded-lg border border-slate-400 bg-white px-3 py-2 text-[15px] leading-5 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500/75 focus:ring-2 focus:ring-emerald-500/20",
    select:
      "min-w-0 cursor-pointer appearance-auto border-0 bg-white text-sm font-medium leading-5 text-slate-900 outline-none disabled:text-slate-500",
  },
  auth: {
    countryControl:
      "grid min-h-11 w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm transition focus-within:border-emerald-500/60 focus-within:ring-2 focus-within:ring-emerald-500/20",
    flag:
      "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-50 text-[0.78rem] leading-none",
    input:
      "min-h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-5 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20",
    select:
      "min-w-0 cursor-pointer appearance-auto border-0 bg-white text-sm font-medium leading-5 text-slate-900 outline-none disabled:text-slate-500",
  },
};

function flagEmoji(country?: string): string {
  if (!country || !/^[A-Z]{2}$/.test(country)) return "🌐";
  const codePoints = country
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function VisibleCountrySelect({
  value,
  onChange,
  options,
  disabled,
  readOnly,
  className,
  iconComponent,
  getIconAspectRatio,
  arrowComponent,
  unicodeFlags,
  controlClassName,
  flagClassName,
  selectClassName,
  ...rest
}: CountrySelectProps) {
  void className;
  void iconComponent;
  void getIconAspectRatio;
  void arrowComponent;
  void unicodeFlags;

  return (
    <div className={controlClassName ?? variantClasses.prominent.countryControl}>
      <select
        {...rest}
        disabled={disabled || readOnly}
        value={value ?? "ZZ"}
        onChange={(event) =>
          onChange(event.target.value === "ZZ" ? undefined : event.target.value)
        }
        className={selectClassName ?? variantClasses.prominent.select}
        aria-label="Country code"
      >
        {options.map((option) => (
          <option
            key={option.divider ? "|" : option.value ?? "ZZ"}
            value={option.divider ? "|" : option.value ?? "ZZ"}
            disabled={option.divider}
          >
            {option.label}
          </option>
        ))}
      </select>
      <span
        className={flagClassName ?? variantClasses.prominent.flag}
        aria-hidden
      >
        {flagEmoji(value)}
      </span>
    </div>
  );
}

export function PhoneInputField({
  value,
  onChange,
  id,
  required,
  variant = "prominent",
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  variant?: PhoneInputVariant;
}) {
  const classes = variantClasses[variant];

  return (
    <PhoneInput
      id={id}
      value={value}
      onChange={(next?: Value) => onChange(next ?? "")}
      defaultCountry="SG"
      international
      countryCallingCodeEditable={false}
      countrySelectComponent={VisibleCountrySelect}
      countrySelectProps={{
        controlClassName: classes.countryControl,
        flagClassName: classes.flag,
        selectClassName: classes.select,
      }}
      numberInputProps={{
        className: classes.input,
      }}
      required={required}
      autoComplete="tel"
      className="text-slate-900"
      style={phoneInputLayoutStyle}
    />
  );
}
