export type PlanningMode = 'standard' | 'semester';
export type Term = 'academic' | 'fall' | 'winter' | 'summer';
export type LivingSituation = string;
export type AccountType = 'RESP' | 'Savings';
export type MealPlanKey = string;

export interface MoneyItem {
  id: string;
  name: string;
  amount: number;
  category: string;
  savingsSourceId?: string;
}

export interface ExpenseItem {
  id: string;
  name: string;
  totalAmount: number;
  coveredByOthers: number;
  category: string;
  amountBasis?: 'semester';
}

export interface YearBudget {
  planningMode: PlanningMode;
  livingSituation: LivingSituation;
  program: ProgramKey;
  mealPlan: MealPlanKey;
  monthlyGroceries: number;
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

export type RowPresetKind = 'savings' | 'funding' | 'expenses' | 'households' | 'deadlines';

export type RowPresetItem = SavingsAccount | MoneyItem | ExpenseItem | Household | DeadlineEvent;

export interface RowPreset {
  id: string;
  kind: RowPresetKind;
  name: string;
  items: RowPresetItem[];
  createdAt: string;
  updatedAt: string;
}

export type ProgramKey = string;

export interface ProgramPreset {
  label: string;
  tuition: number;
  ancillary: number;
  category: string;
}

export interface HousingPreset {
  label: string;
  housing: number;
  food: number;
  utilities: number;
  description: string;
}

export interface MealPlanPreset {
  label: string;
  cost: number;
  description: string;
}

export interface PlannerConfig {
  programs: Record<ProgramKey, ProgramPreset>;
  housing: Record<LivingSituation, HousingPreset>;
  mealPlans: Record<MealPlanKey, MealPlanPreset>;
}

export interface PlannerState {
  title: string;
  studentName: string;
  studentId: string;
  academicYear: string;
  degreeYearsCount: number;
  tuitionInflationRate: number;
  selectedYear: number;
  activeTerm: Term;
  yearlyBudgets: Record<number, YearBudget>;
  savingsSources: SavingsAccount[];
  households: Household[];
  deadlines: DeadlineEvent[];
  studentDeadlines: DeadlineEvent[];
  rowPresets: RowPreset[];
  config: PlannerConfig;
  wizardCompleted: boolean;
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
