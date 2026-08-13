export type PlanningMode = 'standard' | 'semester';
export type Term = 'academic' | 'fall' | 'winter' | 'summer';
export type LivingSituation = 'on-campus' | 'south-village' | 'off-campus' | 'home';
export type AccountType = 'RESP' | 'Savings';

export interface MoneyItem {
  id: string;
  name: string;
  amount: number;
  category: string;
}

export interface ExpenseItem {
  id: string;
  name: string;
  totalAmount: number;
  coveredByOthers: number;
  category: string;
}

export interface YearBudget {
  planningMode: PlanningMode;
  livingSituation: LivingSituation;
  program: ProgramKey;
  fundingSources: MoneyItem[];
  expenses: ExpenseItem[];
  fallFundingSources: MoneyItem[];
  winterFundingSources: MoneyItem[];
  fallExpenses: ExpenseItem[];
  winterExpenses: ExpenseItem[];
  includeSummer: boolean;
  summerFundingSources: MoneyItem[];
  summerExpenses: ExpenseItem[];
}

export interface SavingsAccount {
  id: string;
  name: string;
  amount: number;
  type: AccountType;
}

export interface Household {
  id: string;
  name: string;
  ratio: number;
}

export interface DeadlineEvent {
  id: string;
  title: string;
  date: string;
  category: 'OSAP' | 'Tuition' | 'SAFA' | 'Scholarship' | 'Custom';
  notes: string;
  completed: boolean;
}

export type ProgramKey = 'engineering' | 'computerScience' | 'healthSci' | 'nursing' | 'arts';

export interface PlannerState {
  title: string;
  studentName: string;
  studentId: string;
  degreeYearsCount: number;
  tuitionInflationRate: number;
  selectedYear: number;
  activeTerm: Term;
  yearlyBudgets: Record<number, YearBudget>;
  savingsSources: SavingsAccount[];
  households: Household[];
  deadlines: DeadlineEvent[];
  updatedAt: string;
}

export interface YearAnalysis {
  yearNum: number;
  planningMode: PlanningMode;
  livingSituation: LivingSituation;
  tuitionAndAcademic: number;
  livingAndFood: number;
  lifestyleAndMisc: number;
  summerCost: number;
  summerIncome: number;
  summerSurplus: number;
  respDraw: number;
  personalSavingsDraw: number;
  grantsAndScholarships: number;
  employmentIncome: number;
  totalCost: number;
  totalEarnedAndAid: number;
  parentCoverageNeeded: number;
  respStart: number;
  respEnd: number;
  savingsStart: number;
  savingsEnd: number;
}

export interface DegreeAnalysis {
  yearlyBreakdowns: YearAnalysis[];
  grandTotalCost: number;
  grandTotalRespDrawn: number;
  grandTotalSavingsDrawn: number;
  grandTotalWorkAndAid: number;
  grandTotalParentSupportNeeded: number;
  totalSummerSurplusGenerated: number;
  finalRespRemaining: number;
  finalSavingsRemaining: number;
}

export interface TermTotals {
  totalFunding: number;
  totalExpensesCost: number;
  myShareExpenses: number;
  netStudentDeficit: number;
  academicFunding: number;
  academicExpenses: number;
  fallFunding: number;
  fallExpenses: number;
  winterFunding: number;
  winterExpenses: number;
  summerFunding: number;
  summerExpensesTotal: number;
  summerSurplusThisYear: number;
}

export interface SharePayload {
  version: 1;
  createdAt: string;
  plan: PlannerState;
}
