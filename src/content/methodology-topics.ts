export type MethodologyTopicId =
  | "retirement-fv"
  | "retirement-dividends"
  | "retirement-four-percent"
  | "net-worth"
  | "savings-rate"
  | "monthly-budget-check"
  | "spend-guidance"
  | "investment-projection-36m"
  | "goal-surplus"
  | "goals-eta"
  | "expenses-month"
  | "budget-lines"
  | "cpf-projection"
  | "cpf-housing-mortgage"
  | "vehicles-sg";

export type MethodologyTopic = {
  id: MethodologyTopicId;
  title: string;
  summary: string;
  bullets: string[];
  formulas?: string[];
  footnote?: string;
};

export const METHODOLOGY_TOPICS: MethodologyTopic[] = [
  {
    id: "retirement-fv",
    title: "Retirement path / projected net worth by age",
    summary:
      "Illustrative net worth at future ages from your inputs—not a forecast or advice.",
    bullets: [
      "Investments grow from each account’s balance, monthly contribution, and expected return (blended by size). Spare take-home is not auto-invested—type contributions if you want that.",
      "Each age uses about that many years of monthly compounding from today: (age − your current age) × 12 months.",
      "Cash starts at your balances, then adds (monthly surplus × months ahead). Surplus is take-home − spending − goal plans for your dashboard month—spending uses logged expenses if any, otherwise the monthly budget—and is never below zero. That same rate repeats every month in the chart. Debt stays flat; vehicle proceeds apply if configured.",
      "Huge contributions won’t be checked against that surplus—sanity-check cash flow yourself.",
      "After your retirement age the curve still goes up; the app doesn’t stop contributions or model living off assets yet.",
      "Retirement headline ≈ investments + cash − debt at that age, plus CPF when you’ve saved CPF data.",
    ],
    formulas: [
      "≈ FV(investments) + cash path − debt (+ CPF when enabled); months ≈ (age − current age) × 12",
    ],
    footnote:
      "Rough only—not tax, inflation, or portfolio advice.",
  },
  {
    id: "retirement-dividends",
    title: "Dividends vs monthly spend goal",
    summary:
      "At your target retirement age, we compare dividend income on investments only to your optional monthly spend goal.",
    bullets: [
      "No salary after retirement in this check.",
      "Dividends apply only to projected investment value at retirement—not cash.",
      "Yield comes from your profile; if blank we use 2% per year. Aside from surplus accrual on the by-age chart, cash does not earn interest in this check.",
      "If dividends fall short of the goal, we show a monthly “extra from cash” and a runway: today’s cash ÷ that monthly gap (capped in the app).",
    ],
    formulas: [
      "monthly dividends ≈ investments × yield ÷ 12",
      "need invested (dividends only) ≈ (monthly goal × 12) ÷ yield",
      "cash per month ≈ max(0, goal − monthly dividends)",
    ],
    footnote: "Not tax or inflation adjusted.",
  },
  {
    id: "retirement-four-percent",
    title: "Optional “4% rule” lens",
    summary:
      "A second check: constant annual withdrawal rate on total projected net worth at retirement.",
    bullets: [
      "Unlike the dividend block, this uses investments + cash − debt plus projected CPF when modeled (whole projected net worth at retirement).",
      "We show implied sustainable monthly spend ≈ balance × rate ÷ 12, and compare to your goal if set.",
      "The rate comes from your profile assumption (often around 4% as a rule-of-thumb).",
    ],
    formulas: ["sustainable / month ≈ net worth × rate ÷ 12"],
  },
  {
    id: "net-worth",
    title: "Net worth",
    summary:
      "Net worth here is investments + cash + optional CPF and vehicle equity minus debts, while the dashboard headline shows the same figure excluding CPF.",
    bullets: [],
  },
  {
    id: "savings-rate",
    title: "Savings rate",
    summary:
      "Share of take-home left after this month’s expenses and your planned monthly goal contributions.",
    bullets: [
      "Uses your profile monthly take-home (net) when set.",
      "Spend side matches by-age cash: **logged** expenses for the dashboard month when you have entered any; otherwise the **planned** total from active monthly budget lines (forecast until expenses confirm).",
      "Subtracts the sum of **monthly contribution** on each financial goal (Setup → Goals tab). Those amounts are commitments, not read from the expense list—if you also log the same transfer as an expense, you double-count in real life; here goals always reduce the rate when set.",
    ],
  },
  {
    id: "monthly-budget-check",
    title: "Monthly budget check (dashboard)",
    summary:
      "For the selected month, compares active monthly budget caps to monthly-tagged spending by category.",
    bullets: [
      "Includes only monthly budget lines that are in effect that month.",
      "Spending is expenses tagged monthly and tied to those categories.",
      "Over cap means that category’s actuals beat its planned amount.",
      "Travel and trips: this view is monthly-only—add a monthly line (with dates around the trip) so those costs roll in; annual-tagged spend is not part of this check.",
    ],
  },
  {
    id: "budget-lines",
    title: "Budget lines and overrides",
    summary:
      "Planned caps by category: monthly or yearly amounts, optional active ranges, and one-off month tweaks.",
    bullets: [
      "Each line is a category plus an amount on a monthly or annual schedule. Monthly lines can start and stop in specific months (YYYY-MM); annual lines attach to one calendar year.",
      "For monthly lines only, you can set a different amount for a single month without changing the default.",
      "The month screen shows monthly lines that are active that month. The annual area compares yearly lines to annual-tagged expenses in the same categories for that year.",
      "Trips: a monthly travel line with start/end around the trip usually fits normal monthly expenses. Use an annual line only if you record that spend as annual. Date-based savings targets live under Setup → Goals (you can still pair them with budget caps).",
    ],
  },
  {
    id: "spend-guidance",
    title: "Spending guidance (blue panel)",
    summary: "Rule-based hints for the selected month.",
    bullets: [
      "Uses the same monthly spend basis as the dashboard (logged when any expense in the month, else planned monthly budget), budget lines, and your stated take-home when set.",
      "Lines are plain-text suggestions, not predictions of the future.",
    ],
  },
  {
    id: "investment-projection-36m",
    title: "Investment projection (36 months)",
    summary: "Short forward curve for investment accounts only.",
    bullets: [
      "Excludes cash and debt.",
      "End-of-month contributions; blended expected return weighted by current value across accounts.",
      "Uses only stated monthly contributions on each investment account—no automatic add of take-home minus expenses.",
    ],
  },
  {
    id: "goal-surplus",
    title: "Goals & monthly cash flow",
    summary:
      "Take-home, minus that month’s spending, minus the monthly amounts you set on each goal.",
    bullets: [
      "Goal contributions are the monthly figures on Setup → Goals—not inferred from expenses.",
      "Month spending is whatever you logged (same basis as savings rate on the dashboard).",
      "Surplus for the month = take-home − spending − all goal monthly amounts. It can be negative.",
      "The by-age cash line repeats that each month: if you logged any expense, spend uses actuals; if not, it uses your planned monthly budget. Months below zero add nothing to the running total.",
      "Don’t log a transfer as an expense and also count it on a goal—you’d double-count. Use one or the other.",
    ],
  },
  {
    id: "goals-eta",
    title: "Goal progress and time-to-goal",
    summary: "Standalone goal math on the Setup → Goals tab.",
    bullets: [
      "Progress uses current saved amount vs target where applicable.",
      "Time estimates use your entered contributions and return assumptions on that goal or linked investment—simplified and not guaranteed.",
    ],
  },
  {
    id: "cpf-projection",
    title: "CPF projection (OA / SA / MA)",
    summary:
      "This is a simplified CPF forecast using your entered balances, salary assumptions, and contribution settings to project OA/SA/MA over time.",
    bullets: [],
    footnote: "Educational illustration only—not tax, legal, or financial advice.",
  },
  {
    id: "cpf-housing-mortgage",
    title: "Housing loan in CPF projection",
    summary:
      "Standard fixed-rate mortgage math: equal monthly payments, with OA covering your share up to any cap and available balance.",
    bullets: [
      "Lender (HDB, bank, other) is just a label—the numbers that matter are rate, term, and starting balance.",
      "Starting balance is what you still owe when regular payments begin; other loan fields are for reference unless you keep them aligned with that figure.",
      "In the completion month, OA falls by downpayment and fees paid from OA (never below zero).",
      "After that, each payment splits into interest and principal; OA pays your OA portion until the instalment, monthly cap, or OA runs out.",
      "The model assumes the full loan is drawn when payments start—step-by-step HDB disbursements are not included yet.",
    ],
    formulas: [
      "Monthly payment (r = annual rate ÷ 12, n = months): PMT = P × r × (1+r)^n / ((1+r)^n − 1); if r = 0, PMT = P / n",
    ],
    footnote: "Cash you pay outside OA is not simulated here.",
  },
  {
    id: "vehicles-sg",
    title: "Vehicles (Singapore, illustrative)",
    summary:
      "Ballpark vehicle value and loan for net worth—not dealer quotes. Use a listing estimate, a dated PARF/COE decline to expiry, or a simple OTR-to-terminal line.",
    bullets: [
      "Bikes or anything without PARF: use a market or listing number; stepped COE/PARF math is off.",
      "Listing-only values do not create a big cash-in at COE end unless you add rebate-style amounts.",
      "With registration dates: PARF+COE today, first reg, COE expiry, and expected cash back at expiry produce a smooth monthly path to that end value.",
      "No PARF fields? OTR now to a terminal value is a straight-line shortcut.",
      "Loan is its own balance (from instalment × months or PV). Expense entries do not reduce it automatically.",
      "Net worth uses value minus loan. Planned vehicles stay out until status is Active.",
    ],
    footnote:
      "Illustrative only; real rebates and resale prices differ. Not tax, legal, or financial advice.",
  },
  {
    id: "expenses-month",
    title: "Expenses by month",
    summary: "The Expenses page is scoped to one calendar month at a time.",
    bullets: [
      "Pick a month—totals and charts follow it.",
      "Each budget category allows one monthly expense row per month; edit or delete it instead of duplicating.",
      "Monthly expenses attach to budget lines when categories match.",
      "Add any real outflow (tax instalments, fees, etc.) so reported spend matches cash leaving your accounts.",
    ],
  },
];

export function methodologyTopic(
  id: MethodologyTopicId
): MethodologyTopic | undefined {
  return METHODOLOGY_TOPICS.find((t) => t.id === id);
}
