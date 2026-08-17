import { createClient, type User } from '@supabase/supabase-js';
import type { PlannerConfig, PlannerState, SharePayload } from '../types';
import { defaultPlannerConfig } from '../data/presets';
import { hydratePlannerState, normalizePlannerConfig } from './planner';

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

export const getCurrentUser = async () => {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
};

export const isSupabaseAdminUser = (user: User | null | undefined) => user?.app_metadata?.role === 'admin';

export interface EditableUserProfile {
  email: string;
  fullName: string;
  studentProgram: string;
  expectedGraduationYear: number | null;
}

export const loadCurrentUserProfile = async (): Promise<EditableUserProfile | null> => {
  if (!supabase) return null;
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('email, full_name, student_program, expected_graduation_year')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;

  return {
    email: data?.email ?? user.email ?? '',
    fullName: data?.full_name ?? (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : ''),
    studentProgram: data?.student_program ?? '',
    expectedGraduationYear: data?.expected_graduation_year ?? null,
  };
};

export const updateCurrentUserProfile = async (profile: Omit<EditableUserProfile, 'email'>) => {
  if (!supabase) return;
  const user = await getCurrentUser();
  if (!user) return;

  const fullName = profile.fullName.trim();
  const { error: metadataError } = await supabase.auth.updateUser({
    data: { full_name: fullName || null },
  });
  if (metadataError) throw metadataError;

  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email ?? `${user.id}@user.supabase.local`,
    full_name: fullName || null,
    student_program: profile.studentProgram || null,
    expected_graduation_year: profile.expectedGraduationYear,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
};

export const signInWithPassword = async (email: string, password: string) => {
  if (!supabase) throw new Error('Supabase is not configured. Sandbox Mode is active.');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
};

export const signUpWithPassword = async (email: string, password: string, fullName: string) => {
  if (!supabase) throw new Error('Supabase is not configured. Sandbox Mode is active.');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${window.location.origin}/app`,
    },
  });
  if (error) throw error;
  if (data.session && data.user) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      email: data.user.email ?? email,
      full_name: fullName.trim() || null,
      updated_at: new Date().toISOString(),
    });
    if (profileError) throw profileError;
  }
  return { hasSession: Boolean(data.session), email: data.user?.email ?? email };
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
  const user = await getCurrentUser();
  if (!user) return;

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email ?? `${user.id}@user.supabase.local`,
    full_name: state.studentName || null,
    student_program: state.yearlyBudgets[1]?.program ?? null,
  });
  if (profileError) throw profileError;

  const row = {
    user_id: user.id,
    title: state.title,
    degree_years_count: state.degreeYearsCount,
    tuition_inflation_rate: state.tuitionInflationRate,
    plan_snapshot: state,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: existingError } = await supabase
    .from('budget_plans')
    .select('id')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;

  const query = existing?.id
    ? supabase.from('budget_plans').update(row).eq('id', existing.id).select('id').single()
    : supabase.from('budget_plans').insert(row).select('id').single();

  const { data, error } = await query;

  if (error) throw error;
  return data?.id as string | undefined;
};

export const loadRemotePlanSnapshot = async () => {
  if (!supabase) return null;
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('budget_plans')
    .select('plan_snapshot')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.plan_snapshot) return null;
  return hydratePlannerState(data.plan_snapshot as PlannerState);
};

export const createRemoteShare = async (state: PlannerState, token: string, payload: SharePayload) => {
  if (!supabase) return;
  const user = await getCurrentUser();
  if (!user) return;
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
  if (!supabase) return false;
  const user = await getCurrentUser();
  return isSupabaseAdminUser(user);
};

export const loadRemotePlannerConfig = async () => {
  if (!supabase) return defaultPlannerConfig;
  const { data, error } = await supabase
    .from('planner_config')
    .select('config')
    .eq('key', 'default')
    .maybeSingle();
  if (error || !data?.config) return defaultPlannerConfig;
  return normalizePlannerConfig(data.config as Partial<PlannerConfig>);
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
