import { describe, expect, it } from 'vitest';
import { createPlannerCsv, createSharePayload, decodeSharePayload, encodeSharePayload } from './exports';
import {
  calculateDegreeAnalysis,
  calculateTermTotals,
  createInitialPlannerState,
  createInitialYearBudget,
  normalizeHouseholdRatios,
} from './planner';

describe('planner calculations', () => {
  it('calculates standard budget totals and shortfall', () => {
    const budget = createInitialYearBudget(1);
    const totals = calculateTermTotals(budget, 'academic');

    expect(totals.totalFunding).toBeGreaterThan(0);
    expect(totals.totalExpensesCost).toBeGreaterThan(totals.totalFunding);
    expect(totals.netStudentDeficit).toBe(totals.myShareExpenses - totals.totalFunding);
  });

  it('aggregates semester mode from fall and winter lists', () => {
    const budget = { ...createInitialYearBudget(1), planningMode: 'semester' as const };
    const totals = calculateTermTotals(budget, 'fall');

    expect(totals.academicFunding).toBe(totals.fallFunding + totals.winterFunding);
    expect(totals.academicExpenses).toBe(totals.fallExpenses + totals.winterExpenses);
    expect(totals.totalFunding).toBe(totals.fallFunding);
  });

  it('carries summer surplus into savings runway', () => {
    const state = createInitialPlannerState();
    state.yearlyBudgets[1] = {
      ...state.yearlyBudgets[1],
      includeSummer: true,
      summerFundingSources: [{ id: 'summer-income', name: 'Summer Job', amount: 10000, category: 'Employment' }],
      summerExpenses: [{ id: 'summer-cost', name: 'Summer Rent', totalAmount: 4000, coveredByOthers: 0, category: 'Housing' }],
    };

    const analysis = calculateDegreeAnalysis(state);

    expect(analysis.totalSummerSurplusGenerated).toBe(6000);
    expect(analysis.yearlyBreakdowns[0].savingsStart).toBeGreaterThan(5000);
  });

  it('models RESP depletion across years', () => {
    const state = createInitialPlannerState();
    const analysis = calculateDegreeAnalysis(state);

    expect(analysis.yearlyBreakdowns[0].respStart).toBe(25000);
    expect(analysis.finalRespRemaining).toBeLessThan(25000);
    expect(analysis.grandTotalRespDrawn).toBeGreaterThan(0);
  });

  it('normalizes household ratios to 100 percent', () => {
    const normalized = normalizeHouseholdRatios(
      [
        { id: 'a', name: 'A', ratio: 70 },
        { id: 'b', name: 'B', ratio: 20 },
        { id: 'c', name: 'C', ratio: 10 },
      ],
      'a',
      60,
    );

    expect(normalized.reduce((sum, household) => sum + household.ratio, 0)).toBe(100);
    expect(normalized.find((household) => household.id === 'a')?.ratio).toBe(60);
  });

  it('serializes CSV and share payloads', () => {
    const state = createInitialPlannerState();
    const csv = createPlannerCsv(state);
    const payload = createSharePayload(state);
    const encoded = encodeSharePayload(payload);
    const decoded = decodeSharePayload(encoded);

    expect(csv).toContain('Income');
    expect(csv).toContain('Expense');
    expect(decoded?.plan.title).toBe(state.title);
  });
});
