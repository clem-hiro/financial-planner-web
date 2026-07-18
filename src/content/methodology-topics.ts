export type MethodologyTopicId =
  | "retirement-fv"
  | "retirement-dividends"
  | "retirement-four-percent"
  | "budget-cash-flow-allocation"
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

/** Trust / math notes only — UI how-tos live as inline copy or short (?) tooltips. */
export const METHODOLOGY_TOPICS: MethodologyTopic[] = [
  {
    id: "retirement-fv",
    title: "Your money over time (the age chart)",
    summary:
      "A picture of what your money could add up to at different ages, based on what you've entered. It's an estimate to help you explore ideas — not a promise or advice.",
    bullets: [
      "Your investments grow over time. We start from what each account holds today, add the monthly amount you put in, and apply the growth rate you expect. Leftover pay isn't invested automatically — if you want that counted, add it as a monthly contribution.",
      "For each age on the chart, we simply fast-forward your money by the number of years between now and then.",
      "Your cash builds up from today's balance plus whatever you have left each month (take-home pay minus spending minus money set aside for goals). It never drops below zero, and it stops growing once you reach your target retirement age. Each January we nudge your pay up by your salary-growth rate and your spending up by your cost-of-living rate (2% by default).",
      "We don't check whether the amounts you contribute are realistic for your income — please sanity-check that yourself.",
      "At your target retirement age your cash stops piling up, which is why the chart and the retirement headline match there. We don't yet model spending your savings down after you retire.",
      "The retirement headline is roughly your investments plus cash, minus any debt, at that age — plus your CPF once you've added CPF details.",
    ],
    formulas: [
      "≈ FV(investments) + cash path − debt (+ CPF when enabled); months ≈ (age − current age) × 12",
    ],
    footnote:
      "Rough estimates only — not tax or investment advice. Your spending and spend goal rise with prices each year (2% by default); investment returns, CPF, and vehicle values aren't given that same yearly bump.",
  },
  {
    id: "retirement-dividends",
    title: "Can dividends cover your monthly spending?",
    summary:
      "This checks whether the income your investments pay out (dividends) could cover the monthly spending you're aiming for in retirement. Set your dividend rate and spending goal in Setup → Goals. The Home screen now shows 'Projected wealth (runway)' as the main view instead of a separate dividend card.",
    bullets: [
      "This check assumes you've stopped working, so there's no salary coming in.",
      "Only your investments pay dividends here — your cash doesn't.",
      "We use the dividend rate from your profile, or 2% a year if you leave it blank. In this particular check, your cash doesn't earn interest.",
      "If your dividends fall short of your goal, we show how much extra you'd need from cash each month, plus a 'runway' — roughly how many months your cash could fill that gap.",
    ],
    formulas: [
      "monthly dividends ≈ investments × yield ÷ 12",
      "need invested (dividends only) ≈ (monthly goal × 12) ÷ yield",
      "cash per month ≈ max(0, goal − monthly dividends)",
    ],
    footnote:
      "Your spending goal is adjusted for rising prices up to your retirement year (2% by default). The dividend rate isn't adjusted for inflation or tax.",
  },
  {
    id: "retirement-four-percent",
    title: "The '4% rule' check (optional)",
    summary:
      "A popular rule of thumb: each year you spend a small fixed percentage of everything you've saved. This check applies that idea to your total savings at retirement.",
    bullets: [
      "Unlike the dividends check, this one counts everything: your investments plus cash, minus debt, plus your projected CPF if you've added it.",
      "We show the monthly spending this could support, and compare it to your goal if you've set one.",
      "The percentage comes from your profile (many people use around 4% as a starting point).",
    ],
    formulas: ["sustainable / month ≈ net worth × rate ÷ 12"],
  },
  {
    id: "budget-cash-flow-allocation",
    title: "Money left over (free cash flow)",
    summary:
      "What's left of your take-home pay after this month's planned spending — money you're free to save, invest, or use however you like.",
    bullets: [
      "Take-home is your pay after CPF is taken out (when you've entered a gross salary in your Profile).",
      "Planned spending adds up all the budget categories you've switched on for the month.",
      "Money you've marked as savings or investments isn't counted as 'spent', so it stays part of your leftover.",
      "Money set aside for goals is tracked on its own. 'After goals' is your leftover minus those goal amounts.",
      "'Left in plan' is a different number: your planned budget minus what you've actually spent so far.",
    ],
    formulas: [
      "Free cash flow ≈ take-home − planned spending + planned savings & investments",
      "After goals ≈ free cash flow − monthly goal contributions",
    ],
  },
  {
    id: "cpf-projection",
    title: "Your CPF over time (OA, SA, MA, RA)",
    summary:
      "A simple forecast of your CPF savings over the years, based on your current balances, salary, and settings. CPF has four pots: OA (housing and general use), SA (retirement), MA (healthcare), and RA (created at 55 for retirement payouts).",
    bullets: [
      "The year you turn 55, we move money from your SA first, then your OA, into a new Retirement Account (RA), up to your retirement target.",
      "After 55, new CPF contributions are split between OA, RA, and MA based on your age. In this simple model, RA grows at the same illustrative rate as SA.",
      "Your MA (healthcare pot) has a yearly ceiling called the Basic Healthcare Sum. Once it's full, extra money flows into SA (before 55) or RA (from 55).",
      "We use the official healthcare ceilings up to 2026 ($79,000 for 2026). After that, we estimate a 4% rise each year until the official figures are announced.",
      "If you've already turned 65, we lock in the ceiling from the year you turned 65; otherwise we use the current year's estimate.",
    ],
    footnote: "For learning only — not tax, legal, or financial advice.",
  },
  {
    id: "cpf-retirement-projection",
    title: "CPF retirement targets (BRS, FRS, ERS) at 55",
    summary:
      "A simple look at your CPF retirement targets and how your Retirement Account (RA) forms at 55. These are illustrations, not official CPF LIFE payout quotes or advice.",
    bullets: [
      "There are three targets: the Full Retirement Sum (FRS), the Basic (BRS, half of FRS), and the Enhanced (ERS, double the FRS). The one you pick decides how much is set aside in your RA at 55.",
      "We start from the published FRS for your age group, then grow it a little each year until you turn 55 — unless you type in your own figure.",
      "Your OA and SA balances just before 55 come from the CPF-over-time forecast above.",
      "At 55, your SA fills the RA first, then your OA tops it up to your target. Anything left in OA stays put. A 'shortfall' means your CPF is below the target you chose.",
      "The estimated monthly CPF LIFE payout is a rough range (a yearly payout rate on your RA, divided by 12, give or take 10%) — not an exact quote.",
      "The example scenarios are just teaching numbers — they don't change your own saved data.",
    ],
    formulas: [
      "projected FRS ≈ baseline FRS × (1 + growth %)^years to 55",
      "monthly CPF LIFE band ≈ (RA × payout %) ÷ 12, with ±10% around the midpoint",
    ],
    footnote:
      "Double-check your balances and CPF settings in Setup → CPF when asked. Review again after any CPF rule changes — these figures are estimates, not guaranteed income.",
  },
  {
    id: "cpf-housing-mortgage",
    title: "Your home loan and CPF",
    summary:
      "Standard home-loan maths: the same payment every month, with your CPF OA covering its share as long as there's cap room and enough in the account.",
    bullets: [
      "Your lender (HDB, a bank, or other) is just a label — what really matters is the interest rate, the loan length, and how much you still owe.",
      "'Starting balance' is what you still owe when regular payments begin. The other loan fields are just for reference unless you keep them matching that amount.",
      "In the month you collect the keys, your OA drops by the downpayment and fees you pay from it (never below zero).",
      "After that, each payment is part interest and part repayment. Your OA pays its share until it hits the monthly limit, the cap, or simply runs out.",
      "We assume you borrow the whole loan at once when payments start — we don't yet model HDB's step-by-step payouts.",
    ],
    formulas: [
      "Monthly payment (r = annual rate ÷ 12, n = months): PMT = P × r × (1+r)^n / ((1+r)^n − 1); if r = 0, PMT = P / n",
    ],
    footnote: "Any part you pay in cash (outside CPF) isn't modelled here.",
  },
  {
    id: "vehicles-sg",
    title: "Your vehicle's value (Singapore estimate)",
    summary:
      "A rough value for your vehicle and its loan, so it can count towards your net worth — not a dealer quote. You can enter a listing price, let the value fall to its rebate value over time, or use a simple straight-line drop.",
    bullets: [
      "For motorbikes or anything without a PARF rebate: just enter a market or listing price; the step-by-step COE/PARF calculation is turned off.",
      "A listing-only value won't add a lump sum of cash at the end of the car's life unless you enter rebate amounts yourself.",
      "If you add registration dates, we estimate today's PARF+COE value and glide it smoothly down to the cash you expect back when the COE expires.",
      "No PARF details? We just draw a straight line from today's price down to a final value.",
      "The car loan is tracked separately (worked out from your instalment and the months left). Logging expenses won't reduce it on its own.",
      "Net worth counts the vehicle's value minus its loan. Vehicles marked 'planned' are left out until you set them to 'Active'.",
    ],
    footnote:
      "Estimates only — real rebates and resale prices vary. Not tax, legal, or financial advice.",
  },
  {
    id: "sg-income-tax-ya2026",
    title: "Singapore income tax (YA 2026)",
    summary:
      "How we turn your income, reliefs, and rebate choice into an estimated tax bill — paid either monthly by GIRO or as a single yearly amount.",
    bullets: [
      "Your yearly income = monthly salary × 12 + your annual bonus.",
      "Your total reliefs = an automatic earned-income relief based on age (under 55: $1,000; 55–59: $6,000; 60+: $8,000) + your compulsory employee CPF + any reliefs you type in.",
      "Reliefs are capped at $80,000. Your taxable income = yearly income minus reliefs (after the cap).",
      "We apply Singapore's resident tax rates (from 0% on the first $20,000 up to 24% above $1 million).",
      "If you claim a rebate, it's a percentage of your tax up to a dollar limit you set. Your final tax is the tax minus that rebate (never below zero).",
      "How you pay changes your monthly view: GIRO spreads the tax over 12 months; one-time shows it as a single yearly payment.",
    ],
    formulas: [
      "chargeable = max(annual_income − min(total_reliefs, $80k), 0)",
      "net_tax = max(gross_tax − min(percent × gross_tax, cap), 0)",
    ],
    footnote:
      "Singapore's YA 2024 tax rates still apply for YA 2025 and YA 2026. Not tax advice.",
  },
];

export function methodologyTopic(
  id: MethodologyTopicId
): MethodologyTopic | undefined {
  return METHODOLOGY_TOPICS.find((t) => t.id === id);
}
