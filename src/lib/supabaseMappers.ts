import type { ExpenseItem, MoneyItem, PlannerState, Term } from '../types';

const fundingGroups = [
  ['academic', 'fundingSources'],
  ['fall', 'fallFundingSources'],
  ['winter', 'winterFundingSources'],
  ['summer', 'summerFundingSources'],
] as const;

const expenseGroups = [
  ['academic', 'expenses'],
  ['fall', 'fallExpenses'],
  ['winter', 'winterExpenses'],
  ['summer', 'summerExpenses'],
] as const;

export const toBudgetPlanRow = (state: PlannerState, userId: string) => ({
  user_id: userId,
  title: state.title,
  degree_years_count: state.degreeYearsCount,
  tuition_inflation_rate: state.tuitionInflationRate,
  plan_snapshot: state,
});

export const toSavingsRows = (state: PlannerState, planId: string) =>
  state.savingsSources.map((source) => ({
    plan_id: planId,
    account_name: source.name,
    starting_balance: source.amount,
    account_type: source.type,
  }));

export const toYearlyBudgetRows = (state: PlannerState, planId: string) =>
  Object.entries(state.yearlyBudgets).map(([yearNumber, budget]) => ({
    plan_id: planId,
    year_number: Number(yearNumber),
    planning_mode: budget.planningMode,
    living_situation: budget.livingSituation,
    student_program: budget.program,
    include_summer: budget.includeSummer,
  }));

export const toIncomeRows = (state: PlannerState, yearlyBudgetIds: Record<number, string>) =>
  Object.entries(state.yearlyBudgets).flatMap(([yearNumber, budget]) => {
    const yearly_budget_id = yearlyBudgetIds[Number(yearNumber)];
    return fundingGroups.flatMap(([term, key]) =>
      (budget[key] as MoneyItem[]).map((item) => ({
        yearly_budget_id,
        term: term as Term,
        name: item.name,
        amount: item.amount,
        category: item.category,
      })),
    );
  });

export const toExpenseRows = (state: PlannerState, yearlyBudgetIds: Record<number, string>) =>
  Object.entries(state.yearlyBudgets).flatMap(([yearNumber, budget]) => {
    const yearly_budget_id = yearlyBudgetIds[Number(yearNumber)];
    return expenseGroups.flatMap(([term, key]) =>
      (budget[key] as ExpenseItem[]).map((item) => ({
        yearly_budget_id,
        term: term as Term,
        name: item.name,
        total_amount: item.totalAmount,
        covered_by_others: item.coveredByOthers,
        category: item.category,
      })),
    );
  });

export const toHouseholdRows = (state: PlannerState, planId: string) =>
  state.households.map((household) => ({
    plan_id: planId,
    household_name: household.name,
    ratio_percent: household.ratio,
  }));

export const toDeadlineRows = (state: PlannerState, planId: string) =>
  state.deadlines.map((deadline) => ({
    plan_id: planId,
    title: deadline.title,
    event_date: deadline.date,
    category: deadline.category,
    notes: deadline.notes,
    completed: deadline.completed,
  }));
