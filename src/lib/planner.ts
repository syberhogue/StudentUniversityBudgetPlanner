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
    const fallAmount = Math.round(item.totalAmount / 2);
    const fallCovered = Math.round(item.coveredByOthers / 2);
    return {
      ...item,
      id: `${item.id}-${term}`,
      name: `${item.name} (${term === 'fall' ? 'Fall' : 'Winter'})`,
      totalAmount: term === 'fall' ? fallAmount : item.totalAmount - fallAmount,
      coveredByOthers: term === 'fall' ? fallCovered : item.coveredByOthers - fallCovered,
    };
  });

export const createInitialYearBudget = (
  yearNum: number,
  tuitionInflationRate = 3,
  program: ProgramKey = yearNum === 1 ? 'engineering' : 'healthSci',
  livingSituation: LivingSituation = yearNum === 1 ? 'on-campus' : 'off-campus',
  config: PlannerConfig = defaultPlannerConfig,
  mealPlan: MealPlanKey = livingSituation === 'on-campus' || livingSituation === 'south-village' ? 'standard' : 'none',
  monthlyGroceries = livingSituation === 'home' ? 250 : 475,
): YearBudget => {
  const tuitionMultiplier = Math.pow(1 + tuitionInflationRate / 100, yearNum - 1);
  const programPreset = config.programs[program];
  const housingPreset = config.housing[livingSituation];
  const foodCost = mealPlan === 'none' ? monthlyGroceries * 8 : config.mealPlans[mealPlan].cost;

  const fundingSources: MoneyItem[] = [
    {
      id: `funding-resp-${yearNum}`,
      name: 'RESP Draw (EAP + PSE)',
      amount: Math.max(3000, Math.round(8500 * Math.pow(0.93, yearNum - 1))),
      category: 'RESP/Savings',
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
      totalAmount: Math.round(programPreset.tuition * tuitionMultiplier),
      coveredByOthers: 0,
      category: 'Academic',
    },
    {
      id: `expense-fees-${yearNum}`,
      name: 'Ontario Tech Ancillary & SAFA Fees',
      totalAmount: Math.round(programPreset.ancillary * tuitionMultiplier),
      coveredByOthers: 0,
      category: 'Academic',
    },
    {
      id: `expense-books-${yearNum}`,
      name: 'Textbooks, Digital Codes & Software',
      totalAmount: Math.round(900 * tuitionMultiplier),
      coveredByOthers: 0,
      category: 'Academic',
    },
    {
      id: `expense-housing-${yearNum}`,
      name: housingPreset.label,
      totalAmount: Math.round(housingPreset.housing * tuitionMultiplier),
      coveredByOthers: 0,
      category: 'Housing',
    },
    {
      id: `expense-food-${yearNum}`,
      name: livingSituation === 'home' ? 'Groceries & Commuter Meals' : 'Meal Plan / Groceries',
      totalAmount: Math.round(foodCost * tuitionMultiplier),
      coveredByOthers: 0,
      category: 'Food',
    },
    {
      id: `expense-utilities-${yearNum}`,
      name: 'Utilities & High-Speed Internet',
      totalAmount: Math.round(housingPreset.utilities * tuitionMultiplier),
      coveredByOthers: 0,
      category: 'Housing',
    },
    {
      id: `expense-phone-${yearNum}`,
      name: 'Cell Phone Plan',
      totalAmount: 520,
      coveredByOthers: 0,
      category: 'Lifestyle',
    },
    {
      id: `expense-transit-${yearNum}`,
      name: 'Durham Transit / GO Travel',
      totalAmount: livingSituation === 'home' ? 1200 : 650,
      coveredByOthers: 0,
      category: 'Lifestyle',
    },
    {
      id: `expense-personal-${yearNum}`,
      name: 'Personal Care & Recreation',
      totalAmount: livingSituation === 'home' ? 1000 : 1450,
      coveredByOthers: 0,
      category: 'Lifestyle',
    },
  ].filter((item) => item.totalAmount > 0);

  return {
    planningMode: 'standard',
    livingSituation,
    program,
    mealPlan,
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
      },
      {
        id: `summer-food-${yearNum}`,
        name: 'Summer Groceries',
        totalAmount: Math.round(monthlyGroceries * 4),
        coveredByOthers: 0,
        category: 'Food',
      },
      {
        id: `summer-misc-${yearNum}`,
        name: 'Summer Living & Miscellaneous',
        totalAmount: 900,
        coveredByOthers: 0,
        category: 'Lifestyle',
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
  const config: PlannerConfig = {
    programs: { ...base.config.programs, ...partial.config?.programs },
    housing: { ...base.config.housing, ...partial.config?.housing },
    mealPlans: { ...base.config.mealPlans, ...partial.config?.mealPlans },
  };
  const yearlyBudgets = { ...base.yearlyBudgets, ...partial.yearlyBudgets };
  Object.entries(yearlyBudgets).forEach(([year, budget]) => {
    yearlyBudgets[Number(year)] = {
      ...budget,
      mealPlan: budget.mealPlan ?? (budget.livingSituation === 'on-campus' || budget.livingSituation === 'south-village' ? 'standard' : 'none'),
      monthlyGroceries: budget.monthlyGroceries ?? (budget.livingSituation === 'home' ? 250 : 475),
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
const sumExpenses = (items: ExpenseItem[]) =>
  items.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
const sumMyShare = (items: ExpenseItem[]) =>
  items.reduce((sum, item) => sum + Math.max(0, Number(item.totalAmount || 0) - Number(item.coveredByOthers || 0)), 0);

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

export const calculateTermTotals = (budget: YearBudget, activeTerm: Term): TermTotals => {
  const fallFunding = sumFunding(budget.fallFundingSources);
  const fallExpenses = sumMyShare(budget.fallExpenses);
  const fallTotalExpenses = sumExpenses(budget.fallExpenses);
  const winterFunding = sumFunding(budget.winterFundingSources);
  const winterExpenses = sumMyShare(budget.winterExpenses);
  const winterTotalExpenses = sumExpenses(budget.winterExpenses);
  const standardFunding = sumFunding(budget.fundingSources);
  const standardExpenses = sumMyShare(budget.expenses);
  const standardTotalExpenses = sumExpenses(budget.expenses);

  const academicFunding = budget.planningMode === 'semester' ? fallFunding + winterFunding : standardFunding;
  const academicExpenses = budget.planningMode === 'semester' ? fallExpenses + winterExpenses : standardExpenses;
  const academicTotalExpenses =
    budget.planningMode === 'semester' ? fallTotalExpenses + winterTotalExpenses : standardTotalExpenses;

  const summerFunding = sumFunding(budget.summerFundingSources);
  const summerExpensesTotal = sumMyShare(budget.summerExpenses);
  const summerTotalExpenses = sumExpenses(budget.summerExpenses);
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
    const academicExpenses =
      budget.planningMode === 'semester'
        ? [...budget.fallExpenses, ...budget.winterExpenses]
        : budget.expenses;
    const academicFunding =
      budget.planningMode === 'semester'
        ? [...budget.fallFundingSources, ...budget.winterFundingSources]
        : budget.fundingSources;

    const tuitionAndAcademic = academicExpenses
      .filter((expense) => expense.category === 'Academic')
      .reduce((sum, expense) => sum + expense.totalAmount, 0);
    const livingAndFood = academicExpenses
      .filter((expense) => expense.category === 'Housing' || expense.category === 'Food')
      .reduce((sum, expense) => sum + expense.totalAmount, 0);
    const lifestyleAndMisc = academicExpenses
      .filter((expense) => expense.category !== 'Academic' && expense.category !== 'Housing' && expense.category !== 'Food')
      .reduce((sum, expense) => sum + expense.totalAmount, 0);

    const summerCost = sumExpenses(budget.summerExpenses);
    const summerIncome = sumFunding(budget.summerFundingSources);
    const summerSurplus = Math.max(0, summerIncome - summerCost);
    if (summerSurplus > 0) {
      currentSavingsPool += summerSurplus;
      totalSummerSurplusGenerated += summerSurplus;
    }

    const summerFunding = budget.summerFundingSources;
    const allFunding = [...academicFunding, ...summerFunding];
    const respDraw = allFunding
      .filter((source) => source.name.toLowerCase().includes('resp'))
      .reduce((sum, source) => sum + source.amount, 0);
    const personalSavingsDraw = allFunding
      .filter((source) => source.category === 'RESP/Savings' && !source.name.toLowerCase().includes('resp'))
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
