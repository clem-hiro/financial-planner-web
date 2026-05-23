export type MethodologyTopicId =
  | "retirement-fv"
  | "retirement-dividends"
  | "retirement-four-percent"
  | "net-worth"
  | "savings-rate"
  | "monthly-budget-check"
  | "budget-cash-flow-allocation"
  | "spend-guidance"
  | "investment-projection-36m"
  | "goal-surplus"
  | "goals-eta"
  | "expenses-month"
  | "budget-lines"
  | "cpf-projection"
  | "cpf-retirement-projection"
  | "cpf-housing-mortgage"
  | "vehicles-sg"
  | "sg-income-tax-ya2026";

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
      "Cash starts at your balances, then adds monthly surplus up to your target retirement age—it stops accruing after that. Surplus is take-home − spending − goal plans for your dashboard month—spending uses logged expenses if any, otherwise the monthly budget—and is never below zero. Each January, income and bonus grow by your salary-growth rate and spending by your expense-growth rate (2% default). Debt stays flat; vehicle proceeds apply if configured.",
      "Huge contributions won’t be checked against that surplus—sanity-check cash flow yourself.",
      "At your target retirement age the cash surplus stops accruing, so the curve and the retirement headline agree there; the app doesn’t model drawdown / living off assets yet.",
      "Retirement headline ≈ investments + cash − debt at that age, plus CPF when you’ve saved CPF data.",
    ],
    formulas: [
      "≈ FV(investments) + cash path − debt (+ CPF when enabled); months ≈ (age − current age) × 12",
    ],
    footnote:
      "Rough only—not tax or portfolio advice. Expenses and the spend goal inflate at your set rate (2% default); investment returns, CPF and vehicles stay nominal.",
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
    footnote:
      "Spend goal is inflated to retirement-year dollars at your set rate (2% default); dividend yield is nominal and not tax adjusted.",
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
    id: "budget-cash-flow-allocation",
    title: "Unallocated cash (budget hero)",
    summary:
      "How much take-home is left after your monthly budget lines—and how goals and investments relate.",
    bullets: [
      "Take-home uses salary-only employee CPF when gross and age band are set on your profile; otherwise stored monthly income.",
      "Monthly planned is the sum of active monthly budget lines for the month you are viewing (including one-off overrides).",
      "Unallocated = take-home − monthly planned. This is cash not assigned to any budget category yet.",
      "Goals and investment accounts keep their own monthly contribution fields. They are shown separately so you do not double-count—if you budget “investments” as a line and also set account contributions, align the numbers.",
      "After goals & investments = take-home − monthly planned − goal monthly amounts − investment monthly amounts active that month (respecting contribution start/end dates when set).",
      "Left in plan is different: planned minus logged spend within budgeted categories only.",
    ],
    formulas: [
      "unallocated = take-home − Σ(monthly budget lines)",
      "after commitments = take-home − Σ(budget lines) − Σ(goals) − Σ(investments active this month)",
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
    id: "cpf-retirement-projection",
    title: "CPF retirement projection (FRS / BRS / ERS & age 55)",
    summary:
      "Educational illustration of retirement sums and Retirement Account (RA) formation at age 55—not actuarial CPF LIFE quotes or regulated advice.",
    bullets: [
      "FRS at 55 starts from the published Full Retirement Sum for your cohort year (app baseline), then compounds by the FRS growth % until you reach 55 unless you override it manually.",
      "BRS is 50% of projected FRS; ERS is 200% of projected FRS. Your retirement target (BRS, FRS, or ERS) sets how much OA+SA must be set aside at 55 in the RA flow.",
      "Your personalised age-55 OA/SA come from the blue CPF-by-age chart above (same salary, contribution, and housing assumptions).",
      "RA simulation: SA funds RA first, then OA tops up to the target; remaining OA stays in the illustration. Shortfalls mean total CPF is below the chosen sum.",
      "CPF LIFE monthly range is a simplified band (annual payout % of RA ÷ 12, ±10%)—not plan-specific actuarial payouts.",
      "Example scenarios (high SA, mostly OA, below FRS) are fixed teaching numbers and do not change your saved data.",
    ],
    formulas: [
      "projected FRS ≈ baseline FRS × (1 + growth %)^years to 55",
      "monthly CPF LIFE band ≈ (RA × payout %) ÷ 12, with ±10% around the midpoint",
    ],
    footnote:
      "Confirm balances and policy constants in Setup → CPF when prompted. Re-check after CPF policy updates—outputs are illustrative, not guaranteed income.",
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
    id: "sg-income-tax-ya2026",
    title: "Singapore income tax (YA 2026)",
    summary:
      "How the calculator turns your reliefs and rebate choice into a monthly GIRO or one-time tax burden.",
    bullets: [
      "Annual income = monthly gross salary × 12 + annual bonus.",
      "Total reliefs = earned-income relief (auto from age: <55 $1k, 55–59 $6k, 60+ $8k) + mandatory employee CPF + your typed reliefs.",
      "Total reliefs are capped at $80,000; chargeable income = annual income − reliefs (after cap).",
      "Gross tax uses the resident progressive bracket table in force from YA 2024 ($0–20k @ 0% up to >$1M @ 24%).",
      "Optional rebate: percent × gross tax, capped at the dollar cap you set. Net tax = max(gross − rebate, 0).",
      "Payment method controls cashflow: monthly GIRO = net tax ÷ 12; one-time = net tax shown as a single annual outflow.",
    ],
    formulas: [
      "chargeable = max(annual_income − min(total_reliefs, $80k), 0)",
      "net_tax = max(gross_tax − min(percent × gross_tax, cap), 0)",
    ],
    footnote:
      "IRAS bracket table YA 2024+ stays in force for YA 2025 and YA 2026. Not tax advice.",
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
