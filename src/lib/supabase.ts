import { createClient } from '@supabase/supabase-js';
import type { PlannerConfig, PlannerState, SharePayload } from '../types';
import { defaultPlannerConfig } from '../data/presets';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const getCurrentSession = async () => {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

export const signInWithPassword = async (email: string, password: string) => {
  if (!supabase) throw new Error('Supabase is not configured. Sandbox Mode is active.');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
};

export const signUpWithPassword = async (email: string, password: string, fullName: string) => {
  if (!supabase) throw new Error('Supabase is not configured. Sandbox Mode is active.');
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${window.location.origin}/app`,
    },
  });
  if (error) throw error;
};

export const sendMagicLink = async (email: string) => {
  if (!supabase) throw new Error('Supabase is not configured. Sandbox Mode is active.');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/app` },
  });
  if (error) throw error;
};

export const signOut = async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const saveRemotePlanSnapshot = async (state: PlannerState) => {
  if (!supabase) return;
  const session = await getCurrentSession();
  if (!session) return;

  await supabase.from('profiles').upsert({
    id: session.user.id,
    email: session.user.email,
    full_name: state.studentName || null,
    student_program: state.yearlyBudgets[1]?.program ?? null,
  });

  const { data, error } = await supabase
    .from('budget_plans')
    .upsert({
      user_id: session.user.id,
      title: state.title,
      degree_years_count: state.degreeYearsCount,
      tuition_inflation_rate: state.tuitionInflationRate,
      plan_snapshot: state,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw error;
  return data?.id as string | undefined;
};

export const createRemoteShare = async (state: PlannerState, token: string, payload: SharePayload) => {
  if (!supabase) return;
  const session = await getCurrentSession();
  if (!session) return;
  const planId = await saveRemotePlanSnapshot(state);
  if (!planId) return;
  const { error } = await supabase.from('share_links').insert({
    token,
    plan_id: planId,
    access_level: 'read',
    payload,
    expires_at: null,
  });
  if (error) throw error;
};

export const loadRemoteShare = async (token: string) => {
  if (!supabase) return null;
  const { data, error } = await supabase.from('share_links').select('payload').eq('token', token).single();
  if (error || !data) return null;
  return data.payload as SharePayload;
};

export const getCurrentUserIsAdmin = async () => {
  if (!supabase) return true;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return false;
  return data.user.app_metadata?.role === 'admin';
};

export const loadRemotePlannerConfig = async () => {
  if (!supabase) return defaultPlannerConfig;
  const { data, error } = await supabase
    .from('planner_config')
    .select('config')
    .eq('key', 'default')
    .maybeSingle();
  if (error || !data?.config) return defaultPlannerConfig;
  return data.config as PlannerConfig;
};

export const saveRemotePlannerConfig = async (config: PlannerConfig) => {
  if (!supabase) return;
  const isAdmin = await getCurrentUserIsAdmin();
  if (!isAdmin) throw new Error('Admin access is required to update planner presets.');
  const { error } = await supabase.from('planner_config').upsert({
    key: 'default',
    config,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
};
