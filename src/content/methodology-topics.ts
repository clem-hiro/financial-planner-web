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
      "The chart and table show a simplified net worth at each future age—not financial advice.",
    bullets: [
      "Investments: we use every investment row you entered: balances, monthly contributions, and expected annual return. Returns are blended by current value across accounts. Take-home minus expenses is **not** merged into investment FV—enter what you invest on each account.",
      "For an age A, we compound for about (A − your age today) × 12 months from today.",
      "Cash: starts from your cash account balances, then **adds each month** max(0, profile take-home − **spend basis** − sum of planned monthly goal contributions for the **dashboard month**), repeated forward (same basis as the savings rate). **Spend basis** = sum of logged expenses in that month when **any** expense exists there; otherwise the sum of **active monthly budget** planned amounts (including month overrides). Vehicle modeled proceeds still apply when configured. Liabilities stay at today’s total.",
      "If you also enter large monthly investment contributions, sanity-check that they fit your real cash flow—the chart does not net contributions against surplus-to-cash automatically.",
      "The line after your target retirement age still rises for illustration only—contributions are not turned off in the chart yet, and we do not model spending down balances.",
      "Total at retirement (headline “simplified path”) is projected investments at that age plus projected cash minus debt (debt held flat), plus projected CPF totals when you have CPF balances saved.",
    ],
    formulas: [
      "net worth row ≈ FV(investments, months) + cash(balances + surplus×months + vehicle proceeds) − debt",
      "months ≈ (age − current age) × 12",
      "CPF line (when saved): separate month-step simulation; headline at retirement adds that total when CPF is configured.",
    ],
    footnote:
      "Rough estimate only—not tax, inflation, or real portfolio advice.",
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
    summary: "Compares monthly budget lines to expenses tagged as monthly.",
    bullets: [
      "Only budget lines with monthly cadence that apply in the selected month count.",
      "Spend side uses expenses linked to monthly budget behavior for those categories.",
      "“Over cap” lists categories where spend exceeded that category’s own planned cap.",
      "Planned trips: this check only sees **monthly** lines and **monthly**-tagged spend—use a monthly budget line (optionally with start/end months around trip months) so flight, hotel, etc. in those months roll up here.",
    ],
  },
  {
    id: "budget-lines",
    title: "Budget lines and overrides",
    summary: "How planned amounts work on the Budget page.",
    bullets: [
      "Each line has a category, cadence (**monthly** or **annual**), and amount. Monthly lines can set **start** and **end** months (`YYYY-MM`); annual lines set the **calendar year** they apply to.",
      "Month overrides can replace the default amount for a specific month (monthly lines only).",
      "The month view includes monthly lines that apply to the month you’re viewing; the annual section for a calendar year includes annual lines for that year vs **annual**-tagged expenses in matching categories.",
      "Planned trip (**spend cap**): prefer a **monthly** line (e.g. travel) with start/end around the months you save or spend, so it matches usual **monthly** expenses. Use an **annual** line only if you will log trip costs as **annual** spend in that category and year. A savings **target** by date belongs under **Setup → Goals**, not budget—you can combine a goal with budget caps if you like.",
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
      "Take-home minus logged expenses, then minus the sum of planned monthly amounts on your goals.",
    bullets: [
      "Planned monthly amounts come from each financial goal (Setup → Goals tab)—they are not read from the expense list.",
      "After expenses: take-home minus every expense logged for that month (same basis as savings rate).",
      "True balance for the month: after expenses minus the sum of those planned goal contributions. This figure can be negative.",
      "Projected cash on the by-age chart accrues using the same surplus idea (take-home minus spend basis minus goals, floored at zero each month; spend basis = logged when any expense in the month, else planned monthly budget).",
      "If you also log the same cash movement as an expense, you would double-count—pick either expenses or the goal plan for that transfer, not both.",
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
    summary: "Fixed-rate level payments plus OA draws.",
    bullets: [
      "Lender type (HDB / bank / other) is for your notes only; the math uses the rate and term you enter.",
      "Outstanding principal is the balance still owed when scheduled repayments begin—that drives the amortization. Optional original facility amount and principal already repaid are shown in the list but do not change the schedule unless you align outstanding yourself.",
      "On the completion month you set, OA is reduced by downpayment + fees from OA (cannot go below zero).",
      "From the first payment month, each amortized instalment splits into interest and principal; OA pays up to your OA share of the instalment, optional monthly OA cap, and available OA balance.",
      "Principal is assumed fully drawn at the first payment month; progressive HDB disbursements are not modeled in v1.",
    ],
    formulas: [
      "level payment (r = annual/12, n = term months): PMT = P × r × (1+r)^n / ((1+r)^n − 1), or P/n when r = 0",
    ],
    footnote: "Cash portions of payments are not tracked in the CPF simulation.",
  },
  {
    id: "vehicles-sg",
    title: "Vehicles (Singapore, illustrative)",
    summary:
      "Optional motor vehicles: **current market estimate** (e.g. motorcycles), or PARF+COE ramping to a fixed total at COE expiry, or OTR→terminal, or rough PARF+body. Loan netted for net worth—not binding quotes.",
    bullets: [
      "**Motorcycle / no PARF:** use **Current market / listing estimate**. That value is used as gross asset until you update it. PARF/COE math is skipped.",
      "If value comes only from listing estimate, the model **does not add a cash payout at COE**. Vehicle value goes to zero after expiry unless you entered rebate-style fields.",
      "Best setup (if you have OneMotoring data): fill **PARF+COE today**, **first registration**, **COE expiry**, and **expected total back at COE expiry**. Value then steps down toward terminal value month by month.",
      "If PARF/COE is not filled, you can use **OTR/paid to terminal** as a simple straight-line estimate.",
      "**Loan side is separate:** instalment + months left gives estimated loan (PV by default, or instalment x months). Loan payments logged in Expenses do not auto-reduce this balance.",
      "Dashboard uses **net vehicle equity = gross - loan**. Planned/future vehicles do not count until status is Active.",
    ],
    footnote:
      "Educational model only—real deregistration rebates, COE recovery, and market prices differ. Not tax, legal, or financial advice.",
  },
  {
    id: "expenses-month",
    title: "Expenses by month",
    summary: "What you see on the Expenses page.",
    bullets: [
      "Totals and charts filter to the selected calendar month.",
      "Budget shortcuts: at most one monthly-tagged expense per budget category per month; edit or delete that row before adding again.",
      "Budget locking ties monthly-tagged expenses to active monthly budget lines when category keys match.",
      "Anything you treat as cash outflow can be a line item—including income tax instalments, property tax, or GST—so take-home vs spend can reflect tax you already track.",
    ],
  },
];

export function methodologyTopic(
  id: MethodologyTopicId
): MethodologyTopic | undefined {
  return METHODOLOGY_TOPICS.find((t) => t.id === id);
}
