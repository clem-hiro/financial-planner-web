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
      "Cash: starts from your cash account balances, then **adds each month** max(0, profile take-home − logged expenses for the **dashboard month**), repeated forward (same as savings-rate surplus). Vehicle modeled proceeds still apply when configured. Liabilities stay at today’s total.",
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
    summary: "Sum of what you track in this app.",
    bullets: [
      "Investments: sum of current values from your investment accounts on the Goals page.",
      "Cash: sum of cash account balances.",
      "CPF: when you save OA/SA/MA (and optional CPFIS notional) on Goals, that total is added as a separate bucket—not liquid cash.",
      "Liabilities: debts you entered are subtracted.",
      "Monthly salary is not added as its own asset line—salary is income. Counting salary plus the cash and CPF you already hold from past pay would double-count.",
      "Motor vehicles (optional): active vehicles on Balances add illustrative body + PARF minus loan to net worth. Do not also list the same car loan under Debts, or you double-count the liability.",
    ],
  },
  {
    id: "savings-rate",
    title: "Savings rate",
    summary: "Take-home relative to this month’s expenses.",
    bullets: [
      "Uses your profile monthly take-home (net) when set.",
      "Expenses are tracked amounts for the dashboard month.",
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
      "Planned trip (**spend cap**): prefer a **monthly** line (e.g. travel) with start/end around the months you save or spend, so it matches usual **monthly** expenses. Use an **annual** line only if you will log trip costs as **annual** spend in that category and year. A savings **target** by date belongs on **Goals**, not budget—you can combine a goal with budget caps if you like.",
    ],
  },
  {
    id: "spend-guidance",
    title: "Spending guidance (blue panel)",
    summary: "Rule-based hints for the selected month.",
    bullets: [
      "Uses logged expenses in that month, monthly budget lines, and your stated take-home when set.",
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
    title: "Goal contributions vs surplus",
    summary: "Compares planned monthly goal contributions to estimated surplus.",
    bullets: [
      "Planned amounts come from your financial goals.",
      "Surplus is take-home minus this month’s tracked expenses when take-home is set on your profile.",
    ],
  },
  {
    id: "goals-eta",
    title: "Goal progress and time-to-goal",
    summary: "Standalone goal math on the Goals page.",
    bullets: [
      "Progress uses current saved amount vs target where applicable.",
      "Time estimates use your entered contributions and return assumptions on that goal or linked investment—simplified and not guaranteed.",
    ],
  },
  {
    id: "cpf-projection",
    title: "CPF projection (OA / SA / MA)",
    summary: "Month-step simulation from balances you enter—not CPFB statements.",
    bullets: [
      "Contributions use your profile gross salary and CPF age band; OW ceilings and the $102k annual ordinary-wage cap are applied month by month within each calendar year.",
      "Optional nominal annual salary growth (profile): on each January strictly after the first projection month, gross is multiplied by (1 + rate). The baseline month always uses your entered gross. This only affects forward CPF inflows—not today’s net worth. Not financial advice; stress-test with 0% if unsure.",
      "Employer plus employee flows are split into OA, SA, and MA using a simplified allocation shape scaled by total contribution rate for your band (approximation).",
      "Bucket crediting: optional annual rates per account; defaults are about OA 2.5% and SA/MA 4% when you leave rates blank.",
      "Optional “CPFIS” block: a fixed monthly transfer from OA into a notional balance with its own return—illustrative only.",
      "Dashboard chart: one line per bucket (OA, SA, MA), optional CPFIS and a dashed total; vertical markers show housing keys / repayment start months mapped to age.",
      "Not modeled: Additional Wages, SPR tiers, RA redirection after 55, MA shielding, or CPF LIFE.",
    ],
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
      "**Motorcycles / no PARF:** set **Current market / listing estimate** — gross asset equals that amount until you change it (check Carousell etc. periodically). PARF/COE and COE-month math are skipped when this field is set.",
      "When gross is **only** from that market field (not PARF+COE / OTR→terminal), **projections do not move the listing into cash at COE**—the vehicle net goes to zero after expiry without a one‑time cash inflow, so charts do not assume a rebate you may not get.",
      "**No OneMotoring PARF/COE and ARF for PARF blank** (with first registration + COE expiry, and no market shortcut): modelled gross is **tapered to zero by COE** and **no cash** is added to projections at COE — so bikes without PARF-style cash back are not treated as if you bank sale proceeds.",
      "Recommended when you have OneMotoring figures: **PARF + COE (+ scrap) today**, **first registration**, **COE expiry**, and **expected total back at COE expiry** (e.g. ~$6k rebates+body). Gross asset = terminal + (rebates today − terminal) × (months remaining to COE expiry ÷ months from first reg to COE expiry). Each calendar month remaining drops by one, so the asset moves toward terminal; **instalment does not drive this** (it only affects loan PV / net equity).",
      "If you do not use PARF/COE rows: optional purchase schedule from **OTR / paid** at first reg to the same terminal at COE expiry (straight line). When PARF+COE+terminal+first reg+COE expiry are all set, the rebate ramp above wins over the OTR line.",
      "Loan: monthly instalment + **loan end month** (or months remaining) → **PV** for net equity (rate blank ≈ 2.78% nominal), or tick **instalment × months left** to skip PV and use payment × months (closer to mental math). **Typed loan balance** is only used when you tick that mode. Dealer “cash back” / ~6k quotes are **rebates** (PARF+COE / terminal at COE), separate from the loan side.",
      "Fallback when both PARF and COE “today” are left blank: illustrative PARF from ARF + first registration (10% per full year, up to 10 years) plus body value straight‑lined over the years you set (default 10). “Body depreciate years” only applies to this fallback.",
      "Net vehicle equity (gross − loan) is added to headline net worth and to the simplified by‑age chart as a flat offset.",
      "Planned future vehicles: stored for notes and budget OTR; they do not affect net worth until you switch status to Active.",
      "Expenses you tag as car loan payments are cash‑flow only—they do not automatically reduce the loan balance here; update loan end month or balance periodically.",
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
