import type { PlannerState, SharePayload } from '../types';
import { createInitialPlannerState, hydratePlannerState } from './planner';

export const PLAN_STORAGE_KEY = 'otu-financial-planner-plan';
export const SHARE_STORAGE_PREFIX = 'otu-financial-planner-share-';

export const loadLocalPlan = (): PlannerState => {
  if (typeof window === 'undefined') return createInitialPlannerState();
  const raw = window.localStorage.getItem(PLAN_STORAGE_KEY);
  if (!raw) return createInitialPlannerState();
  try {
    const parsed = JSON.parse(raw) as PlannerState;
    return hydratePlannerState(parsed);
  } catch {
    return createInitialPlannerState();
  }
};

export const saveLocalPlan = (plan: PlannerState) => {
  window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify({ ...plan, updatedAt: new Date().toISOString() }));
};

export const saveLocalShare = (token: string, plan: PlannerState) => {
  const payload: SharePayload = { version: 1, createdAt: new Date().toISOString(), plan };
  window.localStorage.setItem(`${SHARE_STORAGE_PREFIX}${token}`, JSON.stringify(payload));
};

export const loadLocalShare = (token: string): SharePayload | null => {
  const raw = window.localStorage.getItem(`${SHARE_STORAGE_PREFIX}${token}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SharePayload;
  } catch {
    return null;
  }
};
