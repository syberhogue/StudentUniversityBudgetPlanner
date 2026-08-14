import { defaultDeadlines, defaultPlannerConfig } from '../data/presets';
import type {
  DegreeAnalysis,
  ExpenseItem,
  Household,
  LivingSituation,
  MealPlanKey,
  MoneyItem,
  PlannerConfig,
  PlannerState,
  ProgramKey,
  Term,
  TermTotals,
  YearBudget,
} from '../types';
import { clamp, uid } from './format';

const firstKey = <T extends Record<string, unknown>>(record: T, fallback: string) => Object.keys(record)[0] ?? fallback;

const getProgramPreset = (config: PlannerConfig, program: ProgramKey) =>
  config.programs[program] ?? Object.values(config.programs)[0] ?? {
    label: 'Custom Program',
    tuition: 0,
    ancillary: 0,
    category: 'Other',
  };

const getHousingPreset = (config: PlannerConfig, livingSituation: LivingSituation) =>
  config.housing[livingSituation] ?? Object.values(config.housing)[0] ?? {
    label: 'Custom Housing',
    housing: 0,
    food: 0,
    utilities: 0,
    description: 'Custom living cost option.',
  };

const getMealPlanPreset = (config: PlannerConfig, mealPlan: MealPlanKey) =>
  config.mealPlans[mealPlan] ?? config.mealPlans.none ?? Object.values(config.mealPlans)[0] ?? {
    label: 'No Meal Plan',
    cost: 0,
    description: 'Use estimated groceries instead.',
  };

export const normalizePlannerConfig = (partial?: Partial<PlannerConfig>): PlannerConfig => {
  const programsSource =
    partial?.programs && Object.keys(partial.programs).length > 0 ? partial.programs : defaultPlannerConfig.programs;
  const housingSource =
    partial?.housing && Object.keys(partial.housing).length > 0 ? partial.housing : defaultPlannerConfig.housing;
  const mealPlansSource =
    partial?.mealPlans && Object.keys(partial.mealPlans).length > 0 ? partial.mealPlans : defaultPlannerConfig.mealPlans;

  return {
    programs: Object.fromEntries(
      Object.entries(programsSource).map(([key, value]) => [
        key,
        {
          label: value.label,
          tuition: Number(value.tuition || 0),
          ancillary: Number(value.ancillary || 0),
          category: value.category || 'Other',
        },
      ]),
    ),
    housing: Object.fromEntries(
      Object.entries(housingSource).map(([key, value]) => [
        key,
        {
          label: value.label,
          housing: Number(value.housing || 0),
          food: Number(value.food || 0),
          utilities: Number(value.utilities || 0),
          description: value.description || 'Custom living cost option.',
        },
      ]),
    ),
    mealPlans: Object.fromEntries(
      Object.entries(mealPlansSource).map(([key, value]) => [
        key,
        {
          label: value.label,
          cost: Number(value.cost || 0),
          description: value.description || 'Custom meal plan option.',
        },
      ]),
    ),
  };
};

const splitMoneyItems = (items: MoneyItem[], term: 'fall' | 'winter') =>
  items.map((item) => {
    const fallAmount = Math.round(item.amount / 2);
    return {
      ...item,
      id: `${item.id}-${term}`,
      name: `${item.name} (${term === 'fall' ? 'Fall' : 'Winter'})`,
      amount: term === 'fall' ? fallAmount : item.amount - fallAmount,
    };
  });

const splitExpenseItems = (items: ExpenseItem[], term: 'fall' | 'winter') =>
  items.map((item) => {
    const fallCovered = Math.round(item.coveredByOthers / 2);
    return {
      ...item,
      id: `${item.id}-${term}`,
      name: `${item.name} (${term === 'fall' ? 'Fall' : 'Winter'})`,
      coveredByOthers: term === 'fall' ? fallCovered : item.coveredByOthers - fallCovered,
    };
  });

const normalizeExpenseItems = (items: ExpenseItem[] = [], term: Term): ExpenseItem[] =>
  items.map((item) => {
    if (item.amountBasis === 'semester') return item;
    const legacyItem = item as ExpenseItem & { isMonthly?: boolean };
    const totalAmount = legacyItem.isMonthly
      ? Number(legacyItem.totalAmount || 0) * 4
      : term === 'academic'
        ? Math.round(Number(legacyItem.totalAmount || 0) / 2)
        : Number(legacyItem.totalAmount || 0);
    return {
      ...item,
      totalAmount,
      amountBasis: 'semester' as const,
    };
  });

export const createInitialYearBudget = (
  yearNum: number,
  tuitionInflationRate = 3,
  program: ProgramKey = yearNum === 1 ? 'comprehensiveEngineering' : 'healthSci',
  livingSituation: LivingSituation = yearNum === 1 ? 'on-campus' : 'off-campus',
  config: PlannerConfig = defaultPlannerConfig,
  mealPlan: MealPlanKey = livingSituation === 'on-campus' || livingSituation === 'south-village' ? 'standard' : 'none',
  monthlyGroceries = livingSituation === 'home' ? 250 : 475,
): YearBudget => {
  const tuitionMultiplier = Math.pow(1 + tuitionInflationRate / 100, yearNum - 1);
  const programKey = config.programs[program] ? program : firstKey(config.programs, 'custom-program');
  const livingKey = config.housing[livingSituation] ? livingSituation : firstKey(config.housing, 'custom-housing');
  const mealPlanKey = config.mealPlans[mealPlan] ? mealPlan : config.mealPlans.none ? 'none' : firstKey(config.mealPlans, 'none');
  const programPreset = getProgramPreset(config, programKey);
  const housingPreset = getHousingPreset(config, livingKey);
  const foodCost = mealPlanKey === 'none' ? monthlyGroceries * 8 : getMealPlanPreset(config, mealPlanKey).cost;

  const fundingSources: MoneyItem[] = [
    {
      id: `funding-resp-${yearNum}`,
      name: 'RESP Draw (EAP + PSE)',
      amount: Math.max(3000, Math.round(8500 * Math.pow(0.93, yearNum - 1))),
      category: 'RESP/Savings',
      savingsSourceId: 's-resp',
    },
    {
      id: `funding-grant-${yearNum}`,
      name: 'OSAP Grants & Aid',
      amount: yearNum === 1 ? 3800 : 2800,
      category: 'Government Aid',
    },
    {
      id: `funding-loan-${yearNum}`,
      name: 'OSAP Student Loans',
      amount: livingSituation === 'home' ? 3000 : 4800,
      category: 'Government Aid',
    },
    {
      id: `funding-award-${yearNum}`,
      name: yearNum === 1 ? 'Ontario Tech Entrance Scholarship' : 'Ontario Tech Continuing Award',
      amount: yearNum === 1 ? 2000 : 1000,
      category: 'Scholarships',
    },
    {
      id: `funding-work-${yearNum}`,
      name: yearNum === 1 ? 'Summer Savings / Part-Time Work' : 'Campus Work-Study / Part-Time Job',
      amount: Math.round((yearNum === 1 ? 4800 : 5200) * (1 + 0.04 * (yearNum - 1))),
      category: 'Employment',
    },
  ];

  const expenses: ExpenseItem[] = [
    {
      id: `expense-tuition-${yearNum}`,
      name: `${programPreset.label} Tuition Fees`,
      totalAmount: Math.round((programPreset.tuition * tuitionMultiplier) / 2),
      coveredByOthers: 0,
      category: 'Academic',
      amountBasis: 'semester' as const,
    },
    {
      id: `expense-fees-${yearNum}`,
      name: 'Ontario Tech Ancillary & SAFA Fees',
      totalAmount: Math.round((programPreset.ancillary * tuitionMultiplier) / 2),
      coveredByOthers: 0,
      category: 'Academic',
      amountBasis: 'semester' as const,
    },
    {
      id: `expense-books-${yearNum}`,
      name: 'Textbooks, Digital Codes & Software',
      totalAmount: Math.round((900 * tuitionMultiplier) / 2),
      coveredByOthers: 0,
      category: 'Academic',
      amountBasis: 'semester' as const,
    },
    {
      id: `expense-housing-${yearNum}`,
      name: housingPreset.label,
      totalAmount: Math.round((housingPreset.housing * tuitionMultiplier) / 2),
      coveredByOthers: 0,
      category: 'Housing',
      amountBasis: 'semester' as const,
    },
    {
      id: `expense-food-${yearNum}`,
      name: livingSituation === 'home' ? 'Groceries & Commuter Meals' : 'Meal Plan / Groceries',
      totalAmount: Math.round((foodCost * tuitionMultiplier) / 2),
      coveredByOthers: 0,
      category: 'Food',
      amountBasis: 'semester' as const,
    },
    {
      id: `expense-utilities-${yearNum}`,
      name: 'Utilities & High-Speed Internet',
      totalAmount: Math.round((housingPreset.utilities * tuitionMultiplier) / 2),
      coveredByOthers: 0,
      category: 'Housing',
      amountBasis: 'semester' as const,
    },
    {
      id: `expense-phone-${yearNum}`,
      name: 'Cell Phone Plan',
      totalAmount: 260,
      coveredByOthers: 0,
      category: 'Lifestyle',
      amountBasis: 'semester' as const,
    },
    {
      id: `expense-transit-${yearNum}`,
      name: 'Durham Transit / GO Travel',
      totalAmount: livingSituation === 'home' ? 600 : 325,
      coveredByOthers: 0,
      category: 'Lifestyle',
      amountBasis: 'semester' as const,
    },
    {
      id: `expense-personal-${yearNum}`,
      name: 'Personal Care & Recreation',
      totalAmount: livingSituation === 'home' ? 500 : 725,
      coveredByOthers: 0,
      category: 'Lifestyle',
      amountBasis: 'semester' as const,
    },
  ].filter((item) => item.totalAmount > 0);

  return {
    planningMode: 'standard',
    livingSituation: livingKey,
    program: programKey,
    mealPlan: mealPlanKey,
    monthlyGroceries,
    fundingSources,
    expenses,
    fallFundingSources: splitMoneyItems(fundingSources, 'fall'),
    winterFundingSources: splitMoneyItems(fundingSources, 'winter'),
    fallExpenses: splitExpenseItems(expenses, 'fall'),
    winterExpenses: splitExpenseItems(expenses, 'winter'),
    includeSummer: false,
    summerFundingSources: [
      { id: `summer-job-${yearNum}`, name: 'Summer Full-Time Job', amount: 6500, category: 'Employment' },
    ],
    summerExpenses: [
      {
        id: `summer-rent-${yearNum}`,
        name: 'Summer Rent / Housing',
        totalAmount: livingSituation === 'home' ? 0 : Math.round(housingPreset.housing / 2),
        coveredByOthers: 0,
        category: 'Housing',
        amountBasis: 'semester' as const,
      },
      {
        id: `summer-food-${yearNum}`,
        name: 'Summer Groceries',
        totalAmount: Math.round(monthlyGroceries * 4),
        coveredByOthers: 0,
        category: 'Food',
        amountBasis: 'semester' as const,
      },
      {
        id: `summer-misc-${yearNum}`,
        name: 'Summer Living & Miscellaneous',
        totalAmount: 900,
        coveredByOthers: 0,
        category: 'Lifestyle',
        amountBasis: 'semester' as const,
      },
    ].filter((item) => item.totalAmount > 0),
  };
};

export const createInitialPlannerState = (): PlannerState => ({
  title: 'My Ontario Tech Plan',
  studentName: '',
  studentId: '',
  degreeYearsCount: 4,
  tuitionInflationRate: 3,
  selectedYear: 1,
  activeTerm: 'academic',
  yearlyBudgets: {
    1: createInitialYearBudget(1),
    2: createInitialYearBudget(2),
    3: createInitialYearBudget(3),
    4: createInitialYearBudget(4),
  },
  savingsSources: [
    { id: 's-resp', name: 'Family RESP Account', amount: 25000, type: 'RESP' },
    { id: 's-personal', name: 'Personal High-Interest Savings', amount: 5000, type: 'Savings' },
  ],
  households: [
    { id: 'h-mom', name: 'Household 1', ratio: 50 },
    { id: 'h-dad', name: 'Household 2', ratio: 50 },
  ],
  deadlines: defaultDeadlines,
  config: defaultPlannerConfig,
  wizardCompleted: false,
  updatedAt: new Date().toISOString(),
});

export const hydratePlannerState = (partial: Partial<PlannerState>): PlannerState => {
  const base = createInitialPlannerState();
  const config = normalizePlannerConfig(partial.config);
  const yearlyBudgets = { ...base.yearlyBudgets, ...partial.yearlyBudgets };
  Object.entries(yearlyBudgets).forEach(([year, budget]) => {
    yearlyBudgets[Number(year)] = {
      ...budget,
      program: config.programs[budget.program] ? budget.program : firstKey(config.programs, 'custom-program'),
      livingSituation: config.housing[budget.livingSituation]
        ? budget.livingSituation
        : firstKey(config.housing, 'custom-housing'),
      mealPlan: config.mealPlans[budget.mealPlan]
        ? budget.mealPlan
        : config.mealPlans.none
          ? 'none'
          : firstKey(config.mealPlans, 'none'),
      monthlyGroceries: budget.monthlyGroceries ?? (budget.livingSituation === 'home' ? 250 : 475),
      expenses: normalizeExpenseItems(budget.expenses, 'academic'),
      fallExpenses: normalizeExpenseItems(budget.fallExpenses, 'fall'),
      winterExpenses: normalizeExpenseItems(budget.winterExpenses, 'winter'),
      summerExpenses: normalizeExpenseItems(budget.summerExpenses, 'summer'),
    };
  });

  return {
    ...base,
    ...partial,
    config,
    yearlyBudgets,
    wizardCompleted: partial.wizardCompleted ?? false,
  };
};

const sumFunding = (items: MoneyItem[]) => items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
export const getExpenseEffectiveTotal = (item: ExpenseItem, term: Term) =>
  Number(item.totalAmount || 0) * (term === 'academic' ? 2 : 1);
const sumExpenses = (items: ExpenseItem[], term: Term) =>
  items.reduce((sum, item) => sum + getExpenseEffectiveTotal(item, term), 0);
const sumMyShare = (items: ExpenseItem[], term: Term) =>
  items.reduce((sum, item) => sum + Math.max(0, getExpenseEffectiveTotal(item, term) - Number(item.coveredByOthers || 0)), 0);

export const getBudgetLists = (budget: YearBudget, term: Term) => {
  if (term === 'fall') return { funding: budget.fallFundingSources, expenses: budget.fallExpenses };
  if (term === 'winter') return { funding: budget.winterFundingSources, expenses: budget.winterExpenses };
  if (term === 'summer') return { funding: budget.summerFundingSources, expenses: budget.summerExpenses };
  return { funding: budget.fundingSources, expenses: budget.expenses };
};

export const getFundingKey = (term: Term) => {
  if (term === 'fall') return 'fallFundingSources';
  if (term === 'winter') return 'winterFundingSources';
  if (term === 'summer') return 'summerFundingSources';
  return 'fundingSources';
};

export const getExpenseKey = (term: Term) => {
  if (term === 'fall') return 'fallExpenses';
  if (term === 'winter') return 'winterExpenses';
  if (term === 'summer') return 'summerExpenses';
  return 'expenses';
};

const getSavingsDrawFunding = (budget: YearBudget) => [
  ...(budget.planningMode === 'semester' ? [...budget.fallFundingSources, ...budget.winterFundingSources] : budget.fundingSources),
  ...budget.summerFundingSources,
];

const getLinkedSavingsAccount = (state: PlannerState, source: MoneyItem) =>
  source.savingsSourceId
    ? state.savingsSources.find((account) => account.id === source.savingsSourceId) ?? state.savingsSources[0]
    : state.savingsSources[0];

export const getSavingsAccountOpeningBalance = (state: PlannerState, accountId: string, selectedYear: number) => {
  const account = state.savingsSources.find((source) => source.id === accountId);
  if (!account) return 0;

  const priorDraws = Object.entries(state.yearlyBudgets)
    .filter(([yearNumber]) => Number(yearNumber) < selectedYear)
    .flatMap(([, budget]) => getSavingsDrawFunding(budget))
    .filter((source) => source.category === 'RESP/Savings' && getLinkedSavingsAccount(state, source)?.id === accountId)
    .reduce((sum, source) => sum + Number(source.amount || 0), 0);

  return account.amount - priorDraws;
};

export const calculateTermTotals = (budget: YearBudget, activeTerm: Term): TermTotals => {
  const fallFunding = sumFunding(budget.fallFundingSources);
  const fallExpenses = sumMyShare(budget.fallExpenses, 'fall');
  const fallTotalExpenses = sumExpenses(budget.fallExpenses, 'fall');
  const winterFunding = sumFunding(budget.winterFundingSources);
  const winterExpenses = sumMyShare(budget.winterExpenses, 'winter');
  const winterTotalExpenses = sumExpenses(budget.winterExpenses, 'winter');
  const standardFunding = sumFunding(budget.fundingSources);
  const standardExpenses = sumMyShare(budget.expenses, 'academic');
  const standardTotalExpenses = sumExpenses(budget.expenses, 'academic');

  const academicFunding = budget.planningMode === 'semester' ? fallFunding + winterFunding : standardFunding;
  const academicExpenses = budget.planningMode === 'semester' ? fallExpenses + winterExpenses : standardExpenses;
  const academicTotalExpenses =
    budget.planningMode === 'semester' ? fallTotalExpenses + winterTotalExpenses : standardTotalExpenses;

  const summerFunding = sumFunding(budget.summerFundingSources);
  const summerExpensesTotal = sumMyShare(budget.summerExpenses, 'summer');
  const summerTotalExpenses = sumExpenses(budget.summerExpenses, 'summer');
  const summerSurplusThisYear = Math.max(0, summerFunding - summerExpensesTotal);

  const termValues =
    activeTerm === 'fall'
      ? { funding: fallFunding, totalExpenses: fallTotalExpenses, myShare: fallExpenses }
      : activeTerm === 'winter'
        ? { funding: winterFunding, totalExpenses: winterTotalExpenses, myShare: winterExpenses }
        : activeTerm === 'summer'
          ? { funding: summerFunding, totalExpenses: summerTotalExpenses, myShare: summerExpensesTotal }
          : { funding: academicFunding, totalExpenses: academicTotalExpenses, myShare: academicExpenses };

  return {
    totalFunding: termValues.funding,
    totalExpensesCost: termValues.totalExpenses,
    myShareExpenses: termValues.myShare,
    netStudentDeficit: Math.max(0, academicExpenses + summerExpensesTotal - academicFunding - summerFunding),
    academicFunding,
    academicExpenses,
    fallFunding,
    fallExpenses,
    winterFunding,
    winterExpenses,
    summerFunding,
    summerExpensesTotal,
    summerSurplusThisYear,
  };
};

export const calculateDegreeAnalysis = (state: PlannerState): DegreeAnalysis => {
  let currentRespPool = state.savingsSources
    .filter((source) => source.type === 'RESP')
    .reduce((sum, source) => sum + source.amount, 0);
  let currentSavingsPool = state.savingsSources
    .filter((source) => source.type === 'Savings')
    .reduce((sum, source) => sum + source.amount, 0);
  let totalSummerSurplusGenerated = 0;

  const yearlyBreakdowns = Array.from({ length: state.degreeYearsCount }, (_, index) => {
    const yearNum = index + 1;
    const budget =
      state.yearlyBudgets[yearNum] ?? createInitialYearBudget(yearNum, state.tuitionInflationRate, 'healthSci', 'off-campus', state.config);
    const academicExpenseGroups =
      budget.planningMode === 'semester'
        ? [
            { term: 'fall' as Term, items: budget.fallExpenses },
            { term: 'winter' as Term, items: budget.winterExpenses },
          ]
        : [{ term: 'academic' as Term, items: budget.expenses }];
    const academicFunding =
      budget.planningMode === 'semester'
        ? [...budget.fallFundingSources, ...budget.winterFundingSources]
        : budget.fundingSources;

    const sumAcademicExpenses = (predicate: (expense: ExpenseItem) => boolean) =>
      academicExpenseGroups.reduce(
        (sum, group) =>
          sum +
          group.items
            .filter(predicate)
            .reduce((groupSum, expense) => groupSum + getExpenseEffectiveTotal(expense, group.term), 0),
        0,
      );

    const tuitionAndAcademic = sumAcademicExpenses((expense) => expense.category === 'Academic');
    const livingAndFood = sumAcademicExpenses((expense) => expense.category === 'Housing' || expense.category === 'Food');
    const lifestyleAndMisc = sumAcademicExpenses(
      (expense) => expense.category !== 'Academic' && expense.category !== 'Housing' && expense.category !== 'Food',
    );

    const summerCost = sumExpenses(budget.summerExpenses, 'summer');
    const summerIncome = sumFunding(budget.summerFundingSources);
    const summerSurplus = Math.max(0, summerIncome - summerCost);
    if (summerSurplus > 0) {
      currentSavingsPool += summerSurplus;
      totalSummerSurplusGenerated += summerSurplus;
    }

    const summerFunding = budget.summerFundingSources;
    const allFunding = [...academicFunding, ...summerFunding];
    const respDraw = allFunding
      .filter((source) => source.category === 'RESP/Savings' && getLinkedSavingsAccount(state, source)?.type === 'RESP')
      .reduce((sum, source) => sum + source.amount, 0);
    const personalSavingsDraw = allFunding
      .filter((source) => source.category === 'RESP/Savings' && getLinkedSavingsAccount(state, source)?.type === 'Savings')
      .reduce((sum, source) => sum + source.amount, 0);
    const grantsAndScholarships = allFunding
      .filter((source) => source.category === 'Government Aid' || source.category === 'Scholarships')
      .reduce((sum, source) => sum + source.amount, 0);
    const employmentIncome = allFunding
      .filter((source) => source.category === 'Employment')
      .reduce((sum, source) => sum + source.amount, 0);

    const academicCost = tuitionAndAcademic + livingAndFood + lifestyleAndMisc;
    const netSummerExpense = Math.max(0, summerCost - summerIncome);
    const totalCost = academicCost + netSummerExpense;
    const totalEarnedAndAid = grantsAndScholarships + employmentIncome;
    const parentCoverageNeeded = Math.max(0, totalCost - totalEarnedAndAid - respDraw - personalSavingsDraw);

    const respStart = currentRespPool;
    currentRespPool = Math.max(0, currentRespPool - respDraw);
    const savingsStart = currentSavingsPool;
    currentSavingsPool = Math.max(0, currentSavingsPool - personalSavingsDraw);

    return {
      yearNum,
      planningMode: budget.planningMode,
      livingSituation: budget.livingSituation,
      tuitionAndAcademic,
      livingAndFood,
      lifestyleAndMisc,
      summerCost,
      summerIncome,
      summerSurplus,
      respDraw,
      personalSavingsDraw,
      grantsAndScholarships,
      employmentIncome,
      totalCost,
      totalEarnedAndAid,
      parentCoverageNeeded,
      respStart,
      respEnd: currentRespPool,
      savingsStart,
      savingsEnd: currentSavingsPool,
    };
  });

  return {
    yearlyBreakdowns,
    grandTotalCost: yearlyBreakdowns.reduce((sum, year) => sum + year.totalCost, 0),
    grandTotalRespDrawn: yearlyBreakdowns.reduce((sum, year) => sum + year.respDraw, 0),
    grandTotalSavingsDrawn: yearlyBreakdowns.reduce((sum, year) => sum + year.personalSavingsDraw, 0),
    grandTotalWorkAndAid: yearlyBreakdowns.reduce((sum, year) => sum + year.totalEarnedAndAid, 0),
    grandTotalParentSupportNeeded: yearlyBreakdowns.reduce((sum, year) => sum + year.parentCoverageNeeded, 0),
    totalSummerSurplusGenerated,
    finalRespRemaining: currentRespPool,
    finalSavingsRemaining: currentSavingsPool,
  };
};

export const normalizeHouseholdRatios = (households: Household[], changedId?: string, nextRatio?: number): Household[] => {
  if (households.length === 0) return [];
  if (households.length === 1) return [{ ...households[0], ratio: 100 }];

  let draft = households.map((household) => ({ ...household }));
  if (changedId && nextRatio !== undefined) {
    const index = draft.findIndex((household) => household.id === changedId);
    if (index >= 0) {
      draft[index].ratio = clamp(Math.round(nextRatio), 0, 100);
      const remaining = 100 - draft[index].ratio;
      const others = draft.filter((_, otherIndex) => otherIndex !== index);
      const otherTotal = others.reduce((sum, household) => sum + household.ratio, 0);
      draft = draft.map((household, householdIndex) => {
        if (householdIndex === index) return household;
        const ratio =
          otherTotal > 0 ? Math.round((household.ratio / otherTotal) * remaining) : Math.floor(remaining / others.length);
        return { ...household, ratio };
      });
      const correctionIndex = draft.findIndex((_, householdIndex) => householdIndex !== index);
      if (correctionIndex >= 0) {
        draft[correctionIndex].ratio += 100 - draft.reduce((sum, household) => sum + household.ratio, 0);
      }
      return draft;
    }
  }

  const total = draft.reduce((sum, household) => sum + household.ratio, 0);
  if (total <= 0) {
    const equal = Math.floor(100 / draft.length);
    return draft.map((household, index) => ({ ...household, ratio: index === 0 ? 100 - equal * (draft.length - 1) : equal }));
  }
  let allocated = 0;
  const normalized = draft.map((household, index) => {
    const ratio = index === draft.length - 1 ? 100 - allocated : Math.round((household.ratio / total) * 100);
    allocated += ratio;
    return { ...household, ratio };
  });
  return normalized;
};

export const addHousehold = (households: Household[]) =>
  normalizeHouseholdRatios([...households, { id: uid('household'), name: `Household ${households.length + 1}`, ratio: 0 }]);

export const removeHousehold = (households: Household[], id: string) =>
  normalizeHouseholdRatios(households.filter((household) => household.id !== id));
