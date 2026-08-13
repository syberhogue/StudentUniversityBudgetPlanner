import type { DeadlineEvent, LivingSituation, MealPlanKey, PlannerConfig, ProgramKey } from '../types';

export const defaultPlannerConfig: PlannerConfig = {
  programs: {
    engineering: { label: 'Engineering', tuition: 9200, ancillary: 1350 },
    computerScience: { label: 'Computer Science', tuition: 8600, ancillary: 1300 },
    healthSci: { label: 'Health Sciences', tuition: 7900, ancillary: 1225 },
    nursing: { label: 'Nursing', tuition: 8300, ancillary: 1250 },
    arts: { label: 'Arts & General Studies', tuition: 7000, ancillary: 1125 },
  },
  housing: {
    'on-campus': {
      label: 'Simcoe Village Residence',
      housing: 9800,
      food: 5900,
      utilities: 0,
      description: 'Residence and campus dining for first-year planning.',
    },
    'south-village': {
      label: 'South Village Residence',
      housing: 10800,
      food: 5600,
      utilities: 0,
      description: 'Residence-style housing with meal plan support.',
    },
    'off-campus': {
      label: 'Off-Campus Oshawa Rental',
      housing: 8800,
      food: 3800,
      utilities: 1050,
      description: 'Shared Oshawa rental benchmark with utilities.',
    },
    home: {
      label: 'Living at Home',
      housing: 0,
      food: 1800,
      utilities: 0,
      description: 'Commuter plan with reduced housing costs.',
    },
  },
  mealPlans: {
    none: { label: 'No Meal Plan', cost: 0, description: 'Use estimated groceries instead.' },
    light: { label: 'Light Meal Plan', cost: 3600, description: 'Reduced campus dining support.' },
    standard: { label: 'Standard Meal Plan', cost: 5900, description: 'Default first-year campus dining estimate.' },
    full: { label: 'Full Meal Plan', cost: 7200, description: 'Higher campus dining usage estimate.' },
  },
};

export const programPresets: Record<ProgramKey, { label: string; tuition: number; ancillary: number }> =
  defaultPlannerConfig.programs;
export const housingPresets: Record<
  LivingSituation,
  { label: string; housing: number; food: number; utilities: number; description: string }
> = defaultPlannerConfig.housing;
export const mealPlanPresets: Record<MealPlanKey, { label: string; cost: number; description: string }> =
  defaultPlannerConfig.mealPlans;

export const incomeCategories = ['RESP/Savings', 'Government Aid', 'Scholarships', 'Employment'];
export const expenseCategories = ['Academic', 'Housing', 'Food', 'Lifestyle'];

export const defaultDeadlines: DeadlineEvent[] = [
  {
    id: 'deadline-osap-fall',
    title: 'OSAP application and document review',
    date: '2026-06-30',
    category: 'OSAP',
    notes: 'Submit early enough for fall funding release timing.',
    completed: false,
  },
  {
    id: 'deadline-fall-fees',
    title: 'Fall tuition and SAFA fees due',
    date: '2026-09-08',
    category: 'Tuition',
    notes: 'Use this as the first semester payment planning anchor.',
    completed: false,
  },
  {
    id: 'deadline-scholarship',
    title: 'SAFA scholarship window review',
    date: '2026-10-15',
    category: 'Scholarship',
    notes: 'Check awards and bursaries for continuing students.',
    completed: false,
  },
  {
    id: 'deadline-winter-fees',
    title: 'Winter tuition payment planning',
    date: '2027-01-08',
    category: 'Tuition',
    notes: 'Confirm OSAP winter release and household installment split.',
    completed: false,
  },
];
