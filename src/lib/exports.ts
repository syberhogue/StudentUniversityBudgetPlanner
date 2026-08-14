import type { PlannerState, SharePayload, Term } from '../types';
import { calculateDegreeAnalysis, calculateTermTotals, getExpenseEffectiveTotal } from './planner';
import { formatCAD } from './format';

const csvCell = (value: string | number) => `"${String(value).split('"').join('""')}"`;

export const createPlannerCsv = (state: PlannerState) => {
  const rows = [
    ['Section', 'Year', 'Term', 'Name', 'Category', 'Amount', 'Monthly Amount', 'Semester Amount', 'Period Total', 'Covered By Others'],
  ];

  Object.entries(state.yearlyBudgets).forEach(([year, budget]) => {
    const groups = [
      ['Income', 'Academic', budget.fundingSources],
      ['Income', 'Fall', budget.fallFundingSources],
      ['Income', 'Winter', budget.winterFundingSources],
      ['Income', 'Summer', budget.summerFundingSources],
    ] as const;
    groups.forEach(([section, term, items]) => {
      items.forEach((item) => rows.push([section, year, term, item.name, item.category, item.amount.toString(), '', '', item.amount.toString(), '']));
    });

    const expenseGroups = [
      ['Expense', 'Academic', budget.expenses],
      ['Expense', 'Fall', budget.fallExpenses],
      ['Expense', 'Winter', budget.winterExpenses],
      ['Expense', 'Summer', budget.summerExpenses],
    ] as const;
    expenseGroups.forEach(([section, term, items]) => {
      items.forEach((item) =>
        rows.push([
          section,
          year,
          term,
          item.name,
          item.category,
          item.totalAmount.toString(),
          Math.round(item.totalAmount / 4).toString(),
          item.totalAmount.toString(),
          getExpenseEffectiveTotal(item, term.toLowerCase() as Term).toString(),
          item.coveredByOthers.toString(),
        ]),
      );
    });
  });

  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
};

export const downloadTextFile = (fileName: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export const createSharePayload = (state: PlannerState): SharePayload => ({
  version: 1,
  createdAt: new Date().toISOString(),
  plan: state,
});

export const encodeSharePayload = (payload: SharePayload) => btoa(unescape(encodeURIComponent(JSON.stringify(payload))));

export const decodeSharePayload = (encoded: string): SharePayload | null => {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(encoded)))) as SharePayload;
  } catch {
    return null;
  }
};

export const createDeadlineIcs = (state: PlannerState) => {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ontario Tech Financial Planner//EN'];
  state.deadlines
    .filter((deadline) => !deadline.completed)
    .forEach((deadline) => {
      const date = deadline.date.split('-').join('');
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${deadline.id}@otu-financial-planner`);
      lines.push(`DTSTAMP:${new Date().toISOString().split('-').join('').split(':').join('').split('.')[0]}Z`);
      lines.push(`DTSTART;VALUE=DATE:${date}`);
      lines.push(`SUMMARY:${deadline.title}`);
      lines.push(`DESCRIPTION:${deadline.notes}`);
      lines.push('END:VEVENT');
    });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
};

export const createPrintableSummary = (state: PlannerState) => {
  const budget = state.yearlyBudgets[state.selectedYear];
  const totals = calculateTermTotals(budget, state.activeTerm);
  const degree = calculateDegreeAnalysis(state);
  return [
    'Ontario Tech Student Financial Planner Summary',
    `Plan: ${state.title}`,
    `Student: ${state.studentName || 'Sandbox student'}`,
    `Year ${state.selectedYear} support gap: ${formatCAD(totals.netStudentDeficit)}`,
    `Program total projection: ${formatCAD(degree.grandTotalCost)}`,
    `Parent support projection: ${formatCAD(degree.grandTotalParentSupportNeeded)}`,
    '',
    'Household contribution split:',
    ...state.households.map((household) => {
      const share = totals.netStudentDeficit * (household.ratio / 100);
      return `${household.name}: ${household.ratio}% | ${formatCAD(share)} total | ${formatCAD(share / 2)} per semester | ${formatCAD(share / 8)} monthly`;
    }),
  ].join('\n');
};
