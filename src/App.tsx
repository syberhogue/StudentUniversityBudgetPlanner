import {
  ArrowRight,
  CalendarDays,
  Check,
  Clipboard,
  Download,
  GraduationCap,
  Home,
  Landmark,
  Link,
  Moon,
  PiggyBank,
  Plus,
  Printer,
  Save,
  Share2,
  Shield,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { defaultDeadlines, defaultPlannerConfig, expenseCategories, housingPresets, incomeCategories, programPresets } from './data/presets';
import {
  createDeadlineIcs,
  createPlannerCsv,
  createPrintableSummary,
  createSharePayload,
  decodeSharePayload,
  downloadTextFile,
  encodeSharePayload,
} from './lib/exports';
import { formatCAD, parseCurrencyInput, slugify, uid } from './lib/format';
import {
  addHousehold,
  calculateDegreeAnalysis,
  calculateTermTotals,
  createInitialYearBudget,
  getBudgetLists,
  getExpenseKey,
  getFundingKey,
  getSavingsAccountOpeningBalance,
  normalizeHouseholdRatios,
  removeHousehold,
} from './lib/planner';
import { loadLocalPlan, loadLocalShare, saveLocalPlan, saveLocalShare } from './lib/storage';
import {
  createRemoteShare,
  getCurrentUserIsAdmin,
  isSupabaseConfigured,
  loadRemotePlannerConfig,
  loadRemoteShare,
  saveRemotePlanSnapshot,
  saveRemotePlannerConfig,
  sendMagicLink,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  supabase,
} from './lib/supabase';
import type {
  DeadlineEvent,
  ExpenseItem,
  LivingSituation,
  MealPlanKey,
  MoneyItem,
  PlannerConfig,
  PlannerState,
  ProgramKey,
  RowPreset,
  RowPresetItem,
  RowPresetKind,
  SavingsAccount,
  Term,
  YearBudget,
} from './types';

type Route = 'landing' | 'auth' | 'app' | 'share';
type DashboardTab = 'budget' | 'split' | 'degree' | 'deadlines' | 'admin';
type BudgetCard = 'savings' | 'funding' | 'expenses';

const rowPresetKindLabels: Record<RowPresetKind, string> = {
  savings: 'Savings',
  funding: 'Income & Aid',
  expenses: 'Expenses',
  households: 'Household Split',
  deadlines: 'Deadlines',
};

const getRowPresets = (state: PlannerState, kind: RowPresetKind) =>
  state.rowPresets.filter((preset) => preset.kind === kind);

const cloneRowPresetItems = (kind: RowPresetKind, items: RowPresetItem[]): RowPresetItem[] => {
  if (kind === 'savings') {
    return items.map((item) => {
      const source = item as SavingsAccount;
      return {
        id: uid('savings'),
        name: source.name,
        amount: Number(source.amount || 0),
        type: source.type === 'RESP' ? 'RESP' : 'Savings',
      };
    });
  }

  if (kind === 'funding') {
    return items.map((item) => {
      const source = item as MoneyItem;
      return {
        id: uid('income'),
        name: source.name,
        amount: Number(source.amount || 0),
        category: source.category,
        savingsSourceId: source.savingsSourceId,
      };
    });
  }

  if (kind === 'expenses') {
    return items.map((item) => {
      const expense = item as ExpenseItem;
      return {
        id: uid('expense'),
        name: expense.name,
        totalAmount: Number(expense.totalAmount || 0),
        coveredByOthers: Number(expense.coveredByOthers || 0),
        category: expense.category,
        amountBasis: 'semester' as const,
      };
    });
  }

  if (kind === 'households') {
    return normalizeHouseholdRatios(
      items.map((item) => {
        const household = item as { name: string; ratio: number };
        return {
          id: uid('household'),
          name: household.name,
          ratio: Number(household.ratio || 0),
        };
      }),
    );
  }

  return items.map((item) => {
    const deadline = item as DeadlineEvent;
    return {
      id: uid('deadline'),
      title: deadline.title,
      date: deadline.date,
      category: deadline.category,
      notes: deadline.notes,
      completed: Boolean(deadline.completed),
    };
  });
};

const getRoute = (): { route: Route; token?: string } => {
  const path = window.location.pathname;
  if (path.startsWith('/auth')) return { route: 'auth' };
  if (path.startsWith('/app')) return { route: 'app' };
  if (path.startsWith('/share/')) return { route: 'share', token: decodeURIComponent(path.replace('/share/', '')) };
  return { route: 'landing' };
};

const makeUniqueOptionKey = (label: string, record: Record<string, unknown>) => {
  const base = slugify(label) || 'option';
  let key = base;
  let suffix = 2;
  while (record[key]) {
    key = `${base}-${suffix}`;
    suffix += 1;
  }
  return key;
};

const parseDateValue = (date: string) => {
  const timestamp = new Date(`${date}T12:00:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : Date.now();
};

const formatShortDate = (date: string) =>
  new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`));

const useRouter = () => {
  const [location, setLocation] = useState(getRoute);
  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setLocation(getRoute());
  };

  useEffect(() => {
    const onPopState = () => setLocation(getRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return { ...location, navigate };
};

const Stat = ({ label, value, tone = 'blue' }: { label: string; value: string; tone?: 'blue' | 'green' | 'orange' | 'red' }) => {
  const toneClass = {
    blue: 'text-otu-blue dark:text-otu-sky',
    green: 'text-emerald-600',
    orange: 'text-otu-orange',
    red: 'text-rose-600',
  }[tone];
  return (
    <div className="panel p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
};

function WizardOptionCard({
  active,
  description,
  label,
  onClick,
}: {
  active: boolean;
  description?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-4 text-left transition ${
        active
          ? 'border-otu-orange bg-orange-50 shadow-soft ring-2 ring-otu-orange/20 dark:bg-orange-950/30'
          : 'border-slate-200 bg-white hover:border-otu-sky hover:bg-blue-50/60 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-otu-sky dark:hover:bg-slate-900'
      }`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-sm font-black leading-5 text-slate-900 dark:text-white">{label}</span>
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
            active ? 'border-otu-orange bg-otu-orange text-white' : 'border-slate-300 dark:border-slate-600'
          }`}
        >
          {active && <Check size={13} />}
        </span>
      </span>
      {description && <span className="mt-2 block text-sm leading-5 text-slate-600 dark:text-slate-300">{description}</span>}
    </button>
  );
}

function WizardMoneyField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold dark:border-slate-800 dark:bg-slate-950">
      <span className="text-slate-700 dark:text-slate-200">{label}</span>
      <span className="mt-3 flex items-center rounded-md border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
        <span className="text-sm font-black text-slate-400">$</span>
        <input
          className="w-full bg-transparent pl-2 text-lg font-black text-slate-900 focus:outline-none dark:text-white"
          type="number"
          value={value}
          onChange={(event) => onChange(parseCurrencyInput(event.target.value))}
        />
      </span>
    </label>
  );
}

const NavButton = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition ${
      active
        ? 'bg-otu-orange text-white shadow-sm'
        : 'text-blue-50 hover:bg-white/10 hover:text-white dark:text-slate-200'
    }`}
  >
    {children}
  </button>
);

function LandingPage({ navigate }: { navigate: (path: string) => void }) {
  const [program, setProgram] = useState<ProgramKey>('comprehensiveEngineering');
  const [housing, setHousing] = useState<keyof typeof housingPresets>('on-campus');
  const [resp, setResp] = useState(8500);
  const teaserBudget = createInitialYearBudget(1, 3, program, housing);
  const teaserTotal = calculateTermTotals(teaserBudget, 'academic').totalExpensesCost;
  const teaserAid = teaserBudget.fundingSources.reduce((sum, source) => sum + source.amount, 0) + resp - 8500;

  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-otu-orange text-white">
              <GraduationCap size={24} />
            </div>
            <div>
              <p className="font-black text-otu-blue dark:text-white">Ontario Tech</p>
              <p className="text-xs font-semibold text-slate-500">Student Financial Planner</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="secondary-button" onClick={() => navigate('/auth')}>
              Sign in
            </button>
            <button type="button" className="primary-button" onClick={() => navigate('/app')}>
              Try Sandbox <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-otu-blue text-white">
          <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(120deg,#003C71_0%,#003C71_45%,#00A3E0_100%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-14 md:grid-cols-[1.05fr_0.95fr] md:items-center md:py-20">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-otu-sky">Oshawa student cost planning</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-normal md:text-6xl">
                Master Your Ontario Tech Finances Together
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-blue-50">
                Plan tuition, SAFA fees, residence, Oshawa rentals, OSAP timing, RESP drawdowns, and household support
                across a full degree.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button type="button" className="primary-button" onClick={() => navigate('/auth')}>
                  Get Started Free
                </button>
                <button type="button" className="secondary-button border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => navigate('/app')}>
                  Try Sandbox Mode
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-white/15 bg-white p-4 text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-slate-100">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Estimated Costs" value={formatCAD(teaserTotal)} tone="blue" />
                <Stat label="Aid & Savings" value={formatCAD(teaserAid)} tone="green" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="text-sm font-bold">
                  Program
                  <select className="field mt-1" value={program} onChange={(event) => setProgram(event.target.value as ProgramKey)}>
                    {Object.entries(programPresets).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-bold">
                  Housing
                  <select className="field mt-1" value={housing} onChange={(event) => setHousing(event.target.value as keyof typeof housingPresets)}>
                    {Object.entries(housingPresets).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-bold">
                  RESP draw
                  <input className="field mt-1" type="number" value={resp} onChange={(event) => setResp(parseCurrencyInput(event.target.value))} />
                </label>
              </div>
              <div className="mt-4 rounded-lg bg-slate-100 p-4 dark:bg-slate-800">
                <p className="text-xs font-bold uppercase text-slate-500">First-year support gap</p>
                <p className={`mt-1 text-3xl font-black ${teaserTotal > teaserAid ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {formatCAD(Math.abs(teaserTotal - teaserAid))}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-4 px-4 py-10 md:grid-cols-3">
          {[
            ['Ontario Tech Presets', 'Tuition, SAFA fees, Simcoe Village, South Village, and Oshawa rental benchmarks.'],
            ['Multi-Household Splitter', 'Transparent support splits for separated, blended, or shared households.'],
            ['RESP Runway Calculator', 'Year-by-year depletion modeling with summer income carryover.'],
          ].map(([title, copy]) => (
            <div key={title} className="panel p-5">
              <Check className="text-otu-orange" />
              <h2 className="mt-4 text-lg font-black">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{copy}</p>
            </div>
          ))}
        </section>

        <section className="border-t border-slate-200 bg-white py-10 dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 md:grid-cols-3">
            {[
              ['SAFA advisor workflow', 'The semester split makes fee timing and family transfers much easier to discuss.'],
              ['Parent conversation', 'The print summary gives everyone the same numbers before support decisions.'],
              ['Upper-year planning', 'The RESP runway view shows when savings stop covering rent and tuition.'],
            ].map(([title, quote]) => (
              <figure key={title} className="rounded-lg border border-slate-200 p-5 dark:border-slate-700">
                <blockquote className="text-sm leading-6 text-slate-700 dark:text-slate-200">"{quote}"</blockquote>
                <figcaption className="mt-3 text-xs font-bold uppercase text-otu-blue dark:text-otu-sky">{title}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function AuthPage({ navigate }: { navigate: (path: string) => void }) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'magic'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    try {
      if (!isSupabaseConfigured) {
        setStatus('Sandbox Mode is active because Supabase environment variables are not configured.');
        navigate('/app');
        return;
      }
      if (mode === 'signin') {
        await signInWithPassword(email, password);
        navigate('/app');
      } else if (mode === 'signup') {
        await signUpWithPassword(email, password, fullName);
        setStatus('Check your email to confirm the account, then return to sign in.');
      } else {
        await sendMagicLink(email);
        setStatus('Magic link sent. Check your inbox.');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 dark:bg-slate-950">
      <div className="panel w-full max-w-md p-6">
        <button type="button" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-otu-blue dark:text-otu-sky" onClick={() => navigate('/')}>
          <Home size={16} /> Home
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-otu-orange text-white">
            <Shield size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black">Account Access</h1>
            <p className="text-sm text-slate-500">{isSupabaseConfigured ? 'Supabase Auth enabled' : 'Sandbox Mode available'}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {[
            ['signin', 'Sign in'],
            ['signup', 'Sign up'],
            ['magic', 'Magic link'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key as typeof mode)}
              className={`rounded-md px-3 py-2 text-xs font-black ${mode === key ? 'bg-white text-otu-blue shadow-sm dark:bg-slate-950 dark:text-white' : 'text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          {mode === 'signup' && (
            <label className="block text-sm font-bold">
              Display name
              <input className="field mt-1" value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </label>
          )}
          <label className="block text-sm font-bold">
            Email
            <input className="field mt-1" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          {mode !== 'magic' && (
            <label className="block text-sm font-bold">
              Password
              <input className="field mt-1" type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
          )}
          <button type="submit" className="primary-button w-full" disabled={busy}>
            {busy ? 'Working...' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send magic link'}
          </button>
        </form>

        {status && <p className="mt-4 rounded-md bg-blue-50 p-3 text-sm font-semibold text-otu-blue dark:bg-blue-950 dark:text-blue-100">{status}</p>}
      </div>
    </div>
  );
}

function DashboardPage({ navigate }: { navigate: (path: string) => void }) {
  const [state, setState] = useState<PlannerState>(() => loadLocalPlan());
  const [tab, setTab] = useState<DashboardTab>('budget');
  const [activeBudgetCard, setActiveBudgetCard] = useState<BudgetCard>('funding');
  const [darkMode, setDarkMode] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const [saved, setSaved] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showWizard, setShowWizard] = useState(() => !loadLocalPlan().wizardCompleted);
  const [isAdmin, setIsAdmin] = useState(!isSupabaseConfigured);
  const budget =
    state.yearlyBudgets[state.selectedYear] ??
    createInitialYearBudget(state.selectedYear, state.tuitionInflationRate, 'healthSci', 'off-campus', state.config);
  const activeTerm = budget.planningMode === 'standard' && (state.activeTerm === 'fall' || state.activeTerm === 'winter') ? 'academic' : state.activeTerm;
  const lists = getBudgetLists(budget, activeTerm);
  const totals = useMemo(() => calculateTermTotals(budget, activeTerm), [budget, activeTerm]);
  const selectedYearTotals = useMemo(() => calculateTermTotals(budget, 'academic'), [budget]);
  const degree = useMemo(() => calculateDegreeAnalysis(state), [state]);
  const selectedProgramName = state.config.programs[budget.program]?.label ?? 'Ontario Tech Degree';
  const commandCenterTitle = [
    state.title || 'Ontario Tech Plan',
    state.studentName || 'Student',
    selectedProgramName,
    state.academicYear || 'Academic Year',
  ].join(' - ');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    saveLocalPlan(state);
    const timer = window.setTimeout(() => void saveRemotePlanSnapshot(state).catch(() => undefined), 750);
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (isSupabaseConfigured) {
      void loadRemotePlannerConfig().then((config) => {
        setState((previous) => ({ ...previous, config }));
      });
    }
    void getCurrentUserIsAdmin().then(setIsAdmin);
  }, []);

  const updateState = (updater: (previous: PlannerState) => PlannerState) => {
    setState((previous) => ({ ...updater(previous), updatedAt: new Date().toISOString() }));
  };

  const updateBudget = (year: number, updater: (budget: YearBudget) => YearBudget) => {
    updateState((previous) => {
      const current =
        previous.yearlyBudgets[year] ??
        createInitialYearBudget(year, previous.tuitionInflationRate, 'healthSci', 'off-campus', previous.config);
      return {
        ...previous,
        yearlyBudgets: { ...previous.yearlyBudgets, [year]: updater(current) },
      };
    });
  };

  const setTerm = (term: Term) => {
    updateState((previous) => ({ ...previous, activeTerm: term }));
  };

  const updateItem = (type: 'funding' | 'expense', id: string, patch: Partial<MoneyItem & ExpenseItem>) => {
    updateBudget(state.selectedYear, (current) => {
      const key = type === 'funding' ? getFundingKey(activeTerm) : getExpenseKey(activeTerm);
      const nextItems = (current[key] as Array<MoneyItem | ExpenseItem>).map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      );
      return { ...current, [key]: nextItems };
    });
  };

  const addItem = (type: 'funding' | 'expense') => {
    updateBudget(state.selectedYear, (current) => {
      if (type === 'funding') {
        const key = getFundingKey(activeTerm);
        return {
          ...current,
          [key]: [...current[key], { id: uid('income'), name: 'New income source', amount: 0, category: 'Employment' }],
        };
      }
      const key = getExpenseKey(activeTerm);
      return {
        ...current,
        [key]: [...current[key], { id: uid('expense'), name: 'New expense', totalAmount: 0, coveredByOthers: 0, category: 'Lifestyle', amountBasis: 'semester' }],
      };
    });
  };

  const removeItem = (type: 'funding' | 'expense', id: string) => {
    updateBudget(state.selectedYear, (current) => {
      const key = type === 'funding' ? getFundingKey(activeTerm) : getExpenseKey(activeTerm);
      return { ...current, [key]: current[key].filter((item) => item.id !== id) };
    });
  };

  const clearItems = (type: 'funding' | 'expense') => {
    updateBudget(state.selectedYear, (current) => {
      const key = type === 'funding' ? getFundingKey(activeTerm) : getExpenseKey(activeTerm);
      return { ...current, [key]: [] };
    });
  };

  const replaceItems = (type: 'funding' | 'expense', items: RowPresetItem[]) => {
    updateBudget(state.selectedYear, (current) => {
      const key = type === 'funding' ? getFundingKey(activeTerm) : getExpenseKey(activeTerm);
      const kind = type === 'funding' ? 'funding' : 'expenses';
      return { ...current, [key]: cloneRowPresetItems(kind, items) };
    });
  };

  const saveRowPreset = (kind: RowPresetKind, name: string, items: RowPresetItem[]) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    updateState((previous) => {
      const now = new Date().toISOString();
      const existing = previous.rowPresets.find(
        (preset) => preset.kind === kind && preset.name.trim().toLowerCase() === trimmedName.toLowerCase(),
      );
      const nextPreset: RowPreset = {
        id: existing?.id ?? uid('preset'),
        kind,
        name: trimmedName,
        items: cloneRowPresetItems(kind, items),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      return {
        ...previous,
        rowPresets: existing
          ? previous.rowPresets.map((preset) => (preset.id === existing.id ? nextPreset : preset))
          : [...previous.rowPresets, nextPreset],
      };
    });
  };

  const createShare = async () => {
    const token = uid('share');
    const payload = createSharePayload(state);
    const encoded = encodeSharePayload(payload);
    saveLocalShare(token, state);
    await createRemoteShare(state, token, payload).catch(() => undefined);
    const url = `${window.location.origin}/share/${encodeURIComponent(token)}#${encoded}`;
    setShareUrl(url);
    await navigator.clipboard.writeText(url).catch(() => undefined);
  };

  const saveNow = async () => {
    saveLocalPlan(state);
    await saveRemotePlanSnapshot(state).catch(() => undefined);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const exportCsv = () => downloadTextFile('ontario-tech-financial-plan.csv', createPlannerCsv(state), 'text/csv;charset=utf-8');
  const exportCalendar = () => downloadTextFile('ontario-tech-deadlines.ics', createDeadlineIcs(state), 'text/calendar;charset=utf-8');

  const printSummary = () => {
    const summary = createPrintableSummary(state);
    const existing = document.getElementById('print-summary');
    existing?.remove();
    const pre = document.createElement('pre');
    pre.id = 'print-summary';
    pre.className = 'p-8 whitespace-pre-wrap text-sm';
    pre.textContent = summary;
    document.body.appendChild(pre);
    window.print();
    pre.remove();
  };

  if (showWizard) {
    return (
      <OnboardingWizard
        config={state.config}
        onClose={() => setShowWizard(false)}
        onFinish={(nextState) => {
          setState(nextState);
          setShowWizard(false);
          setTab('budget');
        }}
        state={state}
      />
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <header className="no-print sticky top-0 z-[200] border-b-4 border-otu-orange bg-otu-blue text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-otu-orange">
              <GraduationCap size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black">Ontario Tech Student Financial Planner</h1>
              <p className="text-xs font-semibold text-blue-100">{isSupabaseConfigured ? 'Supabase-ready account mode' : 'Sandbox Mode with local autosave'}</p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-1 rounded-lg bg-otu-navy p-1">
            <NavButton active={tab === 'budget'} onClick={() => setTab('budget')}>
              <Wallet size={16} /> Budget
            </NavButton>
            <NavButton active={tab === 'degree'} onClick={() => setTab('degree')}>
              <PiggyBank size={16} /> Analysis
            </NavButton>
            <NavButton active={tab === 'deadlines'} onClick={() => setTab('deadlines')}>
              <CalendarDays size={16} /> Deadlines
            </NavButton>
            {isAdmin && (
              <NavButton active={tab === 'admin'} onClick={() => setTab('admin')}>
                <Settings size={16} /> Admin
              </NavButton>
            )}
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" className="icon-button" aria-label="Toggle dark mode" onClick={() => setDarkMode((value) => !value)}>
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button type="button" className="icon-button" aria-label="Save plan" onClick={saveNow}>
              {saved ? <Check size={17} /> : <Save size={17} />}
            </button>
            <button type="button" className="icon-button" aria-label="Sign out" onClick={() => void signOut().finally(() => navigate('/'))}>
              <X size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <section className="brand-shell relative z-30 mb-6 overflow-visible">
          <div className="flex w-full flex-col gap-4 bg-otu-blue p-4 text-left text-white md:flex-row md:items-center md:justify-between">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-otu-orange text-white shadow-sm">
                <GraduationCap size={22} />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-black uppercase tracking-[0.2em] text-otu-sky">Planner Command Center</span>
                <span className="block truncate text-xl font-black">{commandCenterTitle}</span>
              </span>
            </span>
            <span className="relative flex shrink-0 flex-wrap items-center gap-2">
              <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-otu-blue transition hover:bg-blue-50" onClick={() => setShowActionsMenu((value) => !value)}>
                <Share2 size={16} /> Share
              </button>
              {showActionsMenu && (
                <div className="absolute right-0 top-12 z-[100] w-56 overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-white">
                  <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => { exportCsv(); setShowActionsMenu(false); }}>
                    <Download size={16} /> Export CSV
                  </button>
                  <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => { printSummary(); setShowActionsMenu(false); }}>
                    <Printer size={16} /> Print / PDF
                  </button>
                  <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => { void createShare(); setShowActionsMenu(false); }}>
                    <Share2 size={16} /> Copy Share Link
                  </button>
                </div>
              )}
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-otu-blue transition hover:bg-blue-50"
                onClick={() => setShowWizard(true)}
              >
                <SlidersHorizontal size={16} /> Wizard
              </button>
            </span>
          </div>
        </section>

        {shareUrl && (
          <div className="no-print mb-6 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-otu-blue dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <span className="break-all">{shareUrl}</span>
              <button type="button" className="secondary-button" onClick={() => void navigator.clipboard.writeText(shareUrl)}>
                <Clipboard size={16} /> Copy
              </button>
            </div>
          </div>
        )}

        {(tab === 'budget' || tab === 'split') && (
          <PlannerControls
            activeBudgetCard={activeBudgetCard}
            activeTerm={activeTerm}
            budget={budget}
            selectedYear={state.selectedYear}
            setActiveBudgetCard={setActiveBudgetCard}
            setTab={setTab}
            setTerm={setTerm}
            state={state}
            tab={tab}
            splitGap={selectedYearTotals.netStudentDeficit}
            totals={totals}
            updateBudget={updateBudget}
            updateState={updateState}
          />
        )}

        {tab === 'budget' && (
          <BudgetTab
            activeBudgetCard={activeBudgetCard}
            lists={lists}
            state={state}
            selectedYear={state.selectedYear}
            updateState={updateState}
            addItem={addItem}
            clearItems={clearItems}
            updateItem={updateItem}
            removeItem={removeItem}
            replaceItems={replaceItems}
            saveRowPreset={saveRowPreset}
          />
        )}
        {tab === 'split' && <SplitterTab state={state} splitGap={selectedYearTotals.netStudentDeficit} updateState={updateState} saveRowPreset={saveRowPreset} />}
        {tab === 'degree' && <DegreeTab state={state} degree={degree} />}
        {tab === 'deadlines' && <DeadlinesTab state={state} updateState={updateState} exportCalendar={exportCalendar} />}
        {tab === 'admin' && isAdmin && <AdminTab state={state} updateState={updateState} setTab={setTab} />}
      </main>
    </div>
  );
}

function PlannerControls({
  activeBudgetCard,
  activeTerm,
  budget,
  selectedYear,
  setActiveBudgetCard,
  setTab,
  setTerm,
  state,
  tab,
  splitGap,
  totals,
  updateBudget,
  updateState,
}: {
  activeBudgetCard: BudgetCard;
  activeTerm: Term;
  budget: YearBudget;
  selectedYear: number;
  setActiveBudgetCard: (card: BudgetCard) => void;
  setTab: (tab: DashboardTab) => void;
  setTerm: (term: Term) => void;
  state: PlannerState;
  tab: DashboardTab;
  splitGap: number;
  totals: ReturnType<typeof calculateTermTotals>;
  updateBudget: (year: number, updater: (budget: YearBudget) => YearBudget) => void;
  updateState: (updater: (previous: PlannerState) => PlannerState) => void;
}) {
  const savingsTotal = state.savingsSources.reduce((sum, source) => sum + Number(source.amount || 0), 0);
  const showBudgetCard = (card: BudgetCard) => {
    setActiveBudgetCard(card);
    setTab('budget');
  };

  return (
    <div className="mb-6 space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <SummaryToggle
          active={tab === 'budget' && activeBudgetCard === 'savings'}
          label="Savings"
          value={formatCAD(savingsTotal)}
          tone="blue"
          onClick={() => showBudgetCard('savings')}
        />
        <SummaryToggle
          active={tab === 'budget' && activeBudgetCard === 'funding'}
          label="Aid & Income"
          value={formatCAD(totals.totalFunding)}
          tone="green"
          onClick={() => showBudgetCard('funding')}
        />
        <SummaryToggle
          active={tab === 'budget' && activeBudgetCard === 'expenses'}
          label="My Expenses"
          value={formatCAD(totals.myShareExpenses)}
          tone="orange"
          onClick={() => showBudgetCard('expenses')}
        />
        <HouseholdSplitSummaryCard
          active={tab === 'split'}
          households={state.households}
          totalGap={splitGap}
          onClick={() => setTab('split')}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-3 shadow-soft dark:border-slate-800 dark:bg-slate-900 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Budget Period</p>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Select which year and period the planner views should use.</p>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: state.degreeYearsCount }, (_, index) => index + 1).map((year) => (
              <button
                key={year}
                type="button"
                className={`inline-flex h-9 min-w-10 items-center justify-center rounded-md px-3 text-sm font-black transition ${
                  selectedYear === year
                    ? 'bg-otu-blue text-white shadow-sm'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
                aria-pressed={selectedYear === year}
                onClick={() => updateState((previous) => ({ ...previous, selectedYear: year }))}
              >
                Y{year}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Academic Year (8 mo)', term: 'academic' as Term, mode: 'standard' as YearBudget['planningMode'] },
              { label: 'Fall', term: 'fall' as Term, mode: 'semester' as YearBudget['planningMode'] },
              { label: 'Winter', term: 'winter' as Term, mode: 'semester' as YearBudget['planningMode'] },
              { label: 'Summer', term: 'summer' as Term, mode: budget.planningMode },
            ].map((option) => (
              <button
                key={option.term}
                type="button"
                className={activeTerm === option.term ? 'primary-button' : 'secondary-button'}
                onClick={() => {
                  if (option.term !== 'summer') {
                    updateBudget(selectedYear, (current) => ({ ...current, planningMode: option.mode }));
                  }
                  setTerm(option.term);
                }}
              >
                {option.term === 'summer' && <Sun size={16} />}
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function BudgetTab({
  activeBudgetCard,
  lists,
  state,
  selectedYear,
  updateState,
  addItem,
  clearItems,
  updateItem,
  removeItem,
  replaceItems,
  saveRowPreset,
}: {
  activeBudgetCard: BudgetCard;
  lists: { funding: MoneyItem[]; expenses: ExpenseItem[] };
  state: PlannerState;
  selectedYear: number;
  updateState: (updater: (previous: PlannerState) => PlannerState) => void;
  addItem: (type: 'funding' | 'expense') => void;
  clearItems: (type: 'funding' | 'expense') => void;
  updateItem: (type: 'funding' | 'expense', id: string, patch: Partial<MoneyItem & ExpenseItem>) => void;
  removeItem: (type: 'funding' | 'expense', id: string) => void;
  replaceItems: (type: 'funding' | 'expense', items: RowPresetItem[]) => void;
  saveRowPreset: (kind: RowPresetKind, name: string, items: RowPresetItem[]) => void;
}) {
  return (
    <section className="grid gap-6">
        {activeBudgetCard === 'savings' && (
          <SavingsCard
            rowPresets={getRowPresets(state, 'savings')}
            saveRowPreset={saveRowPreset}
            savingsSources={state.savingsSources}
            updateState={updateState}
          />
        )}
        {activeBudgetCard === 'funding' && (
          <EditableTable
            title="Income & Aid"
            icon={<Landmark size={18} />}
            items={lists.funding}
            type="funding"
            categories={incomeCategories}
            selectedYear={selectedYear}
            savingsSources={state.savingsSources}
            state={state}
            addItem={addItem}
            clearItems={clearItems}
            updateItem={updateItem}
            removeItem={removeItem}
            replaceItems={replaceItems}
            rowPresets={getRowPresets(state, 'funding')}
            saveRowPreset={saveRowPreset}
          />
        )}
        {activeBudgetCard === 'expenses' && (
          <EditableTable
            title="Expenses"
            icon={<Wallet size={18} />}
            items={lists.expenses}
            type="expense"
            categories={expenseCategories}
            addItem={addItem}
            clearItems={clearItems}
            updateItem={updateItem}
            removeItem={removeItem}
            replaceItems={replaceItems}
            rowPresets={getRowPresets(state, 'expenses')}
            saveRowPreset={saveRowPreset}
          />
        )}
    </section>
  );
}

function AnalyzeCard({
  degree,
  state,
}: {
  degree: ReturnType<typeof calculateDegreeAnalysis>;
  state: PlannerState;
}) {
  const palette = ['#003C71', '#E75D2A', '#00A3E0', '#10B981', '#8B5CF6', '#E11D48'];
  const getAnalysisFunding = (budget: YearBudget) => [
    ...(budget.planningMode === 'semester' ? [...budget.fallFundingSources, ...budget.winterFundingSources] : budget.fundingSources),
    ...budget.summerFundingSources,
  ];
  const linkedAccountFor = (source: MoneyItem) =>
    source.savingsSourceId
      ? state.savingsSources.find((account) => account.id === source.savingsSourceId) ?? state.savingsSources[0]
      : state.savingsSources[0];

  const rows = degree.yearlyBreakdowns.map((year) => {
    const budget = state.yearlyBudgets[year.yearNum] ?? createInitialYearBudget(year.yearNum, state.tuitionInflationRate, 'healthSci', 'off-campus', state.config);
    const funding = getAnalysisFunding(budget);
    const savingsDraws = state.savingsSources.map((account) => ({
      id: account.id,
      label: account.name,
      amount: funding
        .filter((source) => source.category === 'RESP/Savings' && linkedAccountFor(source)?.id === account.id)
        .reduce((sum, source) => sum + Number(source.amount || 0), 0),
    }));
    const governmentAid = funding
      .filter((source) => source.category === 'Government Aid')
      .reduce((sum, source) => sum + Number(source.amount || 0), 0);
    const householdContributions = state.households.map((household) => ({
      id: household.id,
      label: household.name,
      amount: year.parentCoverageNeeded * (household.ratio / 100),
    }));
    const total = savingsDraws.reduce((sum, item) => sum + item.amount, 0) + governmentAid + year.parentCoverageNeeded;

    return {
      year,
      governmentAid,
      householdContributions,
      savingsDraws,
      total,
    };
  });
  const maxYearTotal = Math.max(1, ...rows.map((row) => row.total));
  const totalGovernmentAid = rows.reduce((sum, row) => sum + row.governmentAid, 0);
  const totalSavingsDraw = degree.grandTotalRespDrawn + degree.grandTotalSavingsDrawn;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
      <div className="grid lg:grid-cols-[310px_1fr]">
        <aside className="bg-otu-blue p-6 text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-otu-orange shadow-lg">
            <Sparkles size={25} />
          </div>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.22em] text-otu-sky">Degree Analysis</p>
          <h2 className="mt-3 text-3xl font-black leading-tight">Funding path across the full plan.</h2>
          <div className="mt-6 grid gap-3">
            <div className="rounded-lg bg-white/10 p-4">
              <p className="text-xs font-black uppercase text-otu-sky">Expenses Less Income & Aid</p>
              <p className="mt-1 text-2xl font-black">{formatCAD(degree.grandTotalParentSupportNeeded)}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-4">
              <p className="text-xs font-black uppercase text-otu-sky">Savings Drawn</p>
              <p className="mt-1 text-xl font-black">{formatCAD(totalSavingsDraw)}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-4">
              <p className="text-xs font-black uppercase text-otu-sky">Government Aid</p>
              <p className="mt-1 text-xl font-black">{formatCAD(totalGovernmentAid)}</p>
            </div>
          </div>
        </aside>

        <div className="bg-slate-50 p-5 dark:bg-slate-950 md:p-7">
          <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-otu-blue" /> Savings account draw
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-otu-orange" /> Household contribution
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-emerald-500" /> Government aid
            </span>
          </div>

          <div className="mt-6 space-y-5">
            {rows.map((row) => (
              <div key={row.year.yearNum} className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Year {row.year.yearNum}</p>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                      Cost {formatCAD(row.year.totalCost)} | Gap {formatCAD(row.year.parentCoverageNeeded)}
                    </p>
                  </div>
                  <p className="text-lg font-black text-otu-blue dark:text-otu-sky">{formatCAD(row.total)}</p>
                </div>

                <div className="mt-4 h-8 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                  <div className="flex h-full" style={{ width: `${Math.max(4, (row.total / maxYearTotal) * 100)}%` }}>
                    {row.savingsDraws.map((draw, index) =>
                      draw.amount > 0 ? (
                        <div
                          key={draw.id}
                          title={`${draw.label}: ${formatCAD(draw.amount)}`}
                          style={{
                            backgroundColor: palette[index % palette.length],
                            width: `${(draw.amount / row.total) * 100}%`,
                          }}
                        />
                      ) : null,
                    )}
                    {row.householdContributions.map((contribution, index) =>
                      contribution.amount > 0 ? (
                        <div
                          key={contribution.id}
                          title={`${contribution.label}: ${formatCAD(contribution.amount)}`}
                          style={{
                            backgroundColor: palette[(index + 1) % palette.length],
                            width: `${(contribution.amount / row.total) * 100}%`,
                          }}
                        />
                      ) : null,
                    )}
                    {row.governmentAid > 0 && (
                      <div
                        title={`Government aid: ${formatCAD(row.governmentAid)}`}
                        className="bg-emerald-500"
                        style={{ width: `${(row.governmentAid / row.total) * 100}%` }}
                      />
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <div className="rounded-md bg-blue-50 p-3 dark:bg-blue-950/30">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Savings Draw</p>
                    {row.savingsDraws.some((draw) => draw.amount > 0) ? (
                      row.savingsDraws
                        .filter((draw) => draw.amount > 0)
                        .map((draw) => (
                          <p key={draw.id} className="mt-1 flex justify-between gap-3 text-sm font-bold">
                            <span className="truncate">{draw.label}</span>
                            <span>{formatCAD(draw.amount)}</span>
                          </p>
                        ))
                    ) : (
                      <p className="mt-1 text-sm font-semibold text-slate-500">No draw</p>
                    )}
                  </div>
                  <div className="rounded-md bg-orange-50 p-3 dark:bg-orange-950/30">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Households</p>
                    {row.householdContributions.map((contribution) => (
                      <p key={contribution.id} className="mt-1 flex justify-between gap-3 text-sm font-bold">
                        <span className="truncate">{contribution.label}</span>
                        <span>{formatCAD(contribution.amount)}</span>
                      </p>
                    ))}
                  </div>
                  <div className="rounded-md bg-emerald-50 p-3 dark:bg-emerald-950/25">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Government Aid</p>
                    <p className="mt-1 text-sm font-black text-emerald-700 dark:text-emerald-300">{formatCAD(row.governmentAid)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HouseholdSplitSummaryCard({
  active,
  households,
  onClick,
  totalGap,
}: {
  active: boolean;
  households: PlannerState['households'];
  onClick: () => void;
  totalGap: number;
}) {
  const colors = ['bg-otu-blue', 'bg-otu-orange', 'bg-otu-sky', 'bg-emerald-500'];

  return (
    <button
      type="button"
      className={`panel p-4 text-left transition hover:-translate-y-0.5 hover:border-otu-sky hover:shadow-lg ${
        active ? 'ring-2 ring-otu-orange/25' : 'opacity-70'
      }`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Household Split</span>
        <span className={`rounded-full px-2 py-1 text-[11px] font-black ${active ? 'bg-orange-100 text-otu-orange dark:bg-orange-950/40' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
          {active ? 'Active' : 'View'}
        </span>
      </span>
      <span className="mt-2 block text-2xl font-black text-rose-600">{formatCAD(totalGap)}</span>
      <span className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {households.map((household, index) => (
          <span
            key={household.id}
            className={colors[index % colors.length]}
            style={{ width: `${Math.max(0, household.ratio)}%` }}
          />
        ))}
      </span>
      <span className="mt-2 flex flex-wrap gap-1.5">
        {households.slice(0, 3).map((household) => (
          <span key={household.id} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {household.ratio}% {formatCAD(totalGap * (household.ratio / 100))}
          </span>
        ))}
      </span>
    </button>
  );
}

function RowPresetControls({
  currentRows,
  kind,
  onApply,
  onClear,
  onSave,
  presets,
  tone,
}: {
  currentRows: RowPresetItem[];
  kind: RowPresetKind;
  onApply: (preset: RowPreset) => void;
  onClear: () => void;
  onSave: (name: string) => void;
  presets: RowPreset[];
  tone: 'blue' | 'orange';
}) {
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId);
  const accentClass = tone === 'blue' ? 'text-otu-blue hover:bg-blue-50' : 'text-otu-orange hover:bg-orange-50';

  const saveTemplate = () => {
    const name = templateName.trim() || `${rowPresetKindLabels[kind]} Template`;
    onSave(name);
    setTemplateName('');
  };

  return (
    <div className="space-y-3 border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="min-w-0 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Template
          <select className="field mt-1" value={selectedPresetId} onChange={(event) => setSelectedPresetId(event.target.value)}>
            <option value="">Select template</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`secondary-button self-end ${accentClass}`}
          disabled={!selectedPreset}
          onClick={() => selectedPreset && onApply(selectedPreset)}
        >
          Apply
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <label className="min-w-0 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Save Current Rows
          <input
            className="field mt-1"
            placeholder={`${rowPresetKindLabels[kind]} template name`}
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
          />
        </label>
        <button type="button" className={`secondary-button self-end ${accentClass}`} disabled={currentRows.length === 0} onClick={saveTemplate}>
          <Save size={16} /> Save
        </button>
        <button
          type="button"
          className="secondary-button self-end text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
          disabled={currentRows.length === 0}
          onClick={onClear}
        >
          <Trash2 size={16} /> Clear All
        </button>
      </div>
    </div>
  );
}

function SummaryToggle({
  active,
  label,
  onClick,
  tone,
  value,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  tone: 'blue' | 'green' | 'orange' | 'red';
  value: string;
}) {
  const toneClass = {
    blue: 'text-otu-blue dark:text-otu-sky',
    green: 'text-emerald-600',
    orange: 'text-otu-orange',
    red: 'text-rose-600',
  }[tone];

  return (
    <button
      type="button"
      className={`panel p-4 text-left transition hover:-translate-y-0.5 hover:border-otu-sky hover:shadow-lg ${
        active ? 'ring-2 ring-otu-orange/25' : 'opacity-70'
      }`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`rounded-full px-2 py-1 text-[11px] font-black ${active ? 'bg-orange-100 text-otu-orange dark:bg-orange-950/40' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
          {active ? 'Active' : 'View'}
        </span>
      </span>
      <span className={`mt-2 block text-2xl font-black ${toneClass}`}>{value}</span>
    </button>
  );
}

function SavingsCard({
  rowPresets,
  saveRowPreset,
  savingsSources,
  updateState,
}: {
  rowPresets: RowPreset[];
  saveRowPreset: (kind: RowPresetKind, name: string, items: RowPresetItem[]) => void;
  savingsSources: SavingsAccount[];
  updateState: (updater: (previous: PlannerState) => PlannerState) => void;
}) {
  const updateSavingsSource = (id: string, patch: Partial<SavingsAccount>) => {
    updateState((previous) => ({
      ...previous,
      savingsSources: previous.savingsSources.map((source) => (source.id === id ? { ...source, ...patch } : source)),
    }));
  };

  const addSavingsSource = () => {
    updateState((previous) => ({
      ...previous,
      savingsSources: [
        ...previous.savingsSources,
        { id: uid('savings'), name: 'New savings source', amount: 0, type: 'Savings' },
      ],
    }));
  };

  const removeSavingsSource = (id: string) => {
    updateState((previous) => ({
      ...previous,
      savingsSources: previous.savingsSources.filter((source) => source.id !== id),
    }));
  };

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-otu-blue bg-otu-blue p-4 text-white">
        <h2 className="flex items-center gap-2 text-sm font-black">
          <PiggyBank size={18} /> Savings
        </h2>
        <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-otu-blue transition hover:bg-blue-50" onClick={addSavingsSource}>
          <Plus size={16} /> Add
        </button>
      </div>
      <RowPresetControls
        currentRows={savingsSources}
        kind="savings"
        onApply={(preset) =>
          updateState((previous) => ({
            ...previous,
            savingsSources: cloneRowPresetItems('savings', preset.items) as SavingsAccount[],
          }))
        }
        onClear={() => updateState((previous) => ({ ...previous, savingsSources: [] }))}
        onSave={(name) => saveRowPreset('savings', name, savingsSources)}
        presets={rowPresets}
        tone="blue"
      />
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {savingsSources.map((source, index) => (
          <div key={source.id} className={`grid gap-3 p-4 md:grid-cols-[1fr_110px_130px_40px] md:items-center ${index % 2 === 1 ? 'bg-blue-50/55 dark:bg-blue-950/20' : 'bg-white dark:bg-slate-900'}`}>
            <input className="field" value={source.name} onChange={(event) => updateSavingsSource(source.id, { name: event.target.value })} />
            <select className="field" value={source.type} onChange={(event) => updateSavingsSource(source.id, { type: event.target.value as SavingsAccount['type'] })}>
              <option value="RESP">RESP</option>
              <option value="Savings">Savings</option>
            </select>
            <input
              className="field"
              type="number"
              value={source.amount}
              onChange={(event) => updateSavingsSource(source.id, { amount: parseCurrencyInput(event.target.value) })}
            />
            <button type="button" className="icon-button" aria-label={`Remove ${source.name}`} onClick={() => removeSavingsSource(source.id)}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {savingsSources.length === 0 && (
          <div className="p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Add an RESP, savings account, or other education fund to include it in the degree runway.
          </div>
        )}
      </div>
    </div>
  );
}

function EditableTable({
  title,
  icon,
  items,
  type,
  categories,
  selectedYear,
  savingsSources = [],
  state,
  addItem,
  clearItems,
  updateItem,
  removeItem,
  replaceItems,
  rowPresets,
  saveRowPreset,
}: {
  title: string;
  icon: React.ReactNode;
  items: Array<MoneyItem | ExpenseItem>;
  type: 'funding' | 'expense';
  categories: string[];
  selectedYear?: number;
  savingsSources?: SavingsAccount[];
  state?: PlannerState;
  addItem: (type: 'funding' | 'expense') => void;
  clearItems: (type: 'funding' | 'expense') => void;
  updateItem: (type: 'funding' | 'expense', id: string, patch: Partial<MoneyItem & ExpenseItem>) => void;
  removeItem: (type: 'funding' | 'expense', id: string) => void;
  replaceItems: (type: 'funding' | 'expense', items: RowPresetItem[]) => void;
  rowPresets: RowPreset[];
  saveRowPreset: (kind: RowPresetKind, name: string, items: RowPresetItem[]) => void;
}) {
  const linkedSavingsAccounts = savingsSources.filter((source) => source.type === 'RESP' || source.type === 'Savings');
  const brandedHeader =
    type === 'funding'
      ? 'border-otu-blue bg-otu-blue text-white'
      : 'border-otu-orange bg-otu-orange text-white';
  const addButtonClass =
    type === 'funding'
      ? 'inline-flex items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-otu-blue transition hover:bg-blue-50'
      : 'inline-flex items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-otu-orange transition hover:bg-orange-50';

  return (
    <div className="panel overflow-hidden">
      <div className={`flex items-center justify-between border-b p-4 ${brandedHeader}`}>
        <h2 className="flex items-center gap-2 text-sm font-black">
          {icon} {title}
        </h2>
        <button type="button" className={addButtonClass} onClick={() => addItem(type)}>
          <Plus size={16} /> Add
        </button>
      </div>
      <RowPresetControls
        currentRows={items}
        kind={type === 'funding' ? 'funding' : 'expenses'}
        onApply={(preset) => replaceItems(type, preset.items)}
        onClear={() => clearItems(type)}
        onSave={(name) => saveRowPreset(type === 'funding' ? 'funding' : 'expenses', name, items)}
        presets={rowPresets}
        tone={type === 'funding' ? 'blue' : 'orange'}
      />
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {items.map((item, index) => {
          const expense = 'totalAmount' in item;
          const expenseItem = expense ? item : null;
          const moneyItem = expense ? null : item;
          const isSavingsDraw = type === 'funding' && !expense && item.category === 'RESP/Savings';
          const selectedSavingsAccount =
            isSavingsDraw && moneyItem
              ? linkedSavingsAccounts.find((source) => source.id === moneyItem.savingsSourceId) ?? linkedSavingsAccounts[0]
              : undefined;
          const openingBalance =
            state && selectedYear && selectedSavingsAccount
              ? getSavingsAccountOpeningBalance(state, selectedSavingsAccount.id, selectedYear)
              : selectedSavingsAccount?.amount ?? 0;
          const balanceAfterDraw = selectedSavingsAccount && moneyItem ? openingBalance - moneyItem.amount : 0;
          const rowShade =
            index % 2 === 1
              ? type === 'funding'
                ? 'bg-blue-50/55 dark:bg-blue-950/20'
                : 'bg-orange-50/60 dark:bg-orange-950/20'
              : 'bg-white dark:bg-slate-900';
          const rowGridClass = expense
            ? 'grid gap-3 md:grid-cols-[1fr_130px_130px_130px_40px] md:items-end'
            : 'grid gap-3 md:grid-cols-[1fr_130px_130px_40px] md:items-center';
          const semesterAmount = expenseItem ? Number(expenseItem.totalAmount || 0) : 0;
          const monthlyAmount = semesterAmount / 4;
          return (
            <div key={item.id} className={`p-4 ${rowShade}`}>
              <div className={rowGridClass}>
                <input className="field" value={item.name} onChange={(event) => updateItem(type, item.id, { name: event.target.value })} />
                <select
                  className="field"
                  value={item.category}
                  onChange={(event) => {
                    const category = event.target.value;
                    const patch: Partial<MoneyItem & ExpenseItem> = { category };
                    if (type === 'funding' && !expense) {
                      patch.savingsSourceId =
                        category === 'RESP/Savings' ? moneyItem?.savingsSourceId ?? linkedSavingsAccounts[0]?.id : undefined;
                    }
                    updateItem(type, item.id, patch);
                  }}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                {expenseItem && (
                  <>
                    <label className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Monthly
                      <input
                        className="field mt-1"
                        type="number"
                        value={monthlyAmount}
                        onChange={(event) =>
                          updateItem(type, item.id, { totalAmount: parseCurrencyInput(event.target.value) * 4, amountBasis: 'semester' })
                        }
                      />
                    </label>
                    <label className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Semester
                      <input
                        className="field mt-1"
                        type="number"
                        value={semesterAmount}
                        onChange={(event) =>
                          updateItem(type, item.id, { totalAmount: parseCurrencyInput(event.target.value), amountBasis: 'semester' })
                        }
                      />
                    </label>
                  </>
                )}
                {!expenseItem && (
                  <input
                    className="field"
                    type="number"
                    value={moneyItem?.amount ?? 0}
                    onChange={(event) => updateItem(type, item.id, { amount: parseCurrencyInput(event.target.value) })}
                  />
                )}
                <button type="button" className="icon-button" aria-label={`Remove ${item.name}`} onClick={() => removeItem(type, item.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
              {isSavingsDraw && moneyItem && (
                <div className="mt-3 grid gap-3 rounded-lg border border-blue-200 bg-blue-50/80 p-3 dark:border-blue-900 dark:bg-blue-950/30 md:grid-cols-[1fr_170px_170px] md:items-end">
                  <label className="text-sm font-bold">
                    Draw from savings account
                    <select
                      className="field mt-1"
                      value={selectedSavingsAccount?.id ?? ''}
                      onChange={(event) => updateItem(type, item.id, { savingsSourceId: event.target.value })}
                    >
                      {linkedSavingsAccounts.length === 0 && <option value="">No savings accounts yet</option>}
                      {linkedSavingsAccounts.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.name} ({source.type})
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="rounded-md bg-white p-3 dark:bg-slate-900">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Year {selectedYear ?? ''} Start</p>
                    <p className="mt-1 text-lg font-black text-otu-blue dark:text-otu-sky">
                      {selectedSavingsAccount ? formatCAD(openingBalance) : formatCAD(0)}
                    </p>
                  </div>
                  <div className="rounded-md bg-white p-3 dark:bg-slate-900">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">After Draw</p>
                    <p className={`mt-1 text-lg font-black ${balanceAfterDraw < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {selectedSavingsAccount ? formatCAD(balanceAfterDraw) : formatCAD(0)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SplitterTab({
  saveRowPreset,
  state,
  splitGap,
  updateState,
}: {
  saveRowPreset: (kind: RowPresetKind, name: string, items: RowPresetItem[]) => void;
  state: PlannerState;
  splitGap: number;
  updateState: (updater: (previous: PlannerState) => PlannerState) => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between bg-otu-blue p-4 text-white">
          <h2 className="flex items-center gap-2 text-lg font-black">
            <SlidersHorizontal /> Household Ratios
          </h2>
          <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-otu-blue transition hover:bg-blue-50" onClick={() => updateState((previous) => ({ ...previous, households: addHousehold(previous.households) }))}>
            <Plus size={16} /> Add
          </button>
        </div>
        <RowPresetControls
          currentRows={state.households}
          kind="households"
          onApply={(preset) =>
            updateState((previous) => ({
              ...previous,
              households: cloneRowPresetItems('households', preset.items) as PlannerState['households'],
            }))
          }
          onClear={() => updateState((previous) => ({ ...previous, households: [] }))}
          onSave={(name) => saveRowPreset('households', name, state.households)}
          presets={getRowPresets(state, 'households')}
          tone="blue"
        />
        <div className="space-y-4 p-5">
          {state.households.map((household, index) => (
            <div key={household.id} className={`rounded-lg border border-slate-200 p-4 dark:border-slate-800 ${index % 2 === 1 ? 'bg-blue-50/55 dark:bg-blue-950/20' : 'bg-white dark:bg-slate-900'}`}>
              <div className="flex items-center gap-3">
                <input
                  className="field"
                  value={household.name}
                  onChange={(event) =>
                    updateState((previous) => ({
                      ...previous,
                      households: previous.households.map((item) => (item.id === household.id ? { ...item, name: event.target.value } : item)),
                    }))
                  }
                />
                <strong className="w-12 text-right text-otu-blue dark:text-otu-sky">{household.ratio}%</strong>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove ${household.name}`}
                  disabled={state.households.length === 1}
                  onClick={() => updateState((previous) => ({ ...previous, households: removeHousehold(previous.households, household.id) }))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <input
                className="mt-3 w-full accent-otu-orange"
                type="range"
                min={0}
                max={100}
                value={household.ratio}
                onChange={(event) =>
                  updateState((previous) => ({
                    ...previous,
                    households: normalizeHouseholdRatios(previous.households, household.id, parseCurrencyInput(event.target.value)),
                  }))
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="bg-otu-orange p-4 text-white">
          <h2 className="flex items-center gap-2 text-lg font-black">
            <CalendarDays size={20} /> Payment Schedule
          </h2>
        </div>
        <div className="grid gap-3 p-5">
          {state.households.map((household, index) => {
            const share = splitGap * (household.ratio / 100);
            return (
              <div key={household.id} className={`rounded-lg border border-slate-200 p-4 dark:border-slate-800 ${index % 2 === 1 ? 'bg-orange-50/60 dark:bg-orange-950/20' : 'bg-white dark:bg-slate-900'}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-black">{household.name}</h3>
                  <span className="font-black text-otu-orange">{formatCAD(share)}</span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Stat label="Fall" value={formatCAD(share / 2)} />
                  <Stat label="Winter" value={formatCAD(share / 2)} />
                  <Stat label="Monthly 8x" value={formatCAD(share / 8)} tone="green" />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function DegreeTab({
  state,
  degree,
}: {
  state: PlannerState;
  degree: ReturnType<typeof calculateDegreeAnalysis>;
}) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <Stat label="Program Cost" value={formatCAD(degree.grandTotalCost)} />
        <Stat label="Aid & Work" value={formatCAD(degree.grandTotalWorkAndAid)} tone="green" />
        <Stat label="RESP Drawn" value={formatCAD(degree.grandTotalRespDrawn)} tone="orange" />
        <Stat label="Parent Gap" value={formatCAD(degree.grandTotalParentSupportNeeded)} tone="red" />
      </section>
      <AnalyzeCard state={state} degree={degree} />
    </div>
  );
}

type TimelineFilter = 'important' | 'mine' | 'both';
type TimelineDate = DeadlineEvent & { source: 'important' | 'mine' };

function ImportantDatesTimeline({
  activeDeadlineId,
  deadlines,
  markerTimestamp,
  onActiveChange,
  onMarkerChange,
}: {
  activeDeadlineId: string;
  deadlines: TimelineDate[];
  markerTimestamp: number;
  onActiveChange: (id: string) => void;
  onMarkerChange: (timestamp: number) => void;
}) {
  const sortedDeadlines = useMemo(
    () => [...deadlines].sort((first, second) => parseDateValue(first.date) - parseDateValue(second.date)),
    [deadlines],
  );
  const currentTimestamp = parseDateValue(new Date().toISOString().slice(0, 10));
  const timestamps = sortedDeadlines.map((deadline) => parseDateValue(deadline.date));
  const minTimestamp = Math.min(currentTimestamp, ...timestamps);
  const maxTimestamp = Math.max(currentTimestamp, ...timestamps);
  const span = Math.max(1, maxTimestamp - minTimestamp);
  const getPosition = (timestamp: number) => ((timestamp - minTimestamp) / span) * 100;
  const markerPosition = getPosition(Math.min(maxTimestamp, Math.max(minTimestamp, markerTimestamp)));

  const pickNearestFromClientX = (clientX: number, currentTarget: HTMLElement) => {
    const rect = currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const timestamp = minTimestamp + ratio * span;
    onMarkerChange(timestamp);
    if (sortedDeadlines.length === 0) return;
    const nearest = sortedDeadlines.reduce((best, deadline) =>
      Math.abs(parseDateValue(deadline.date) - timestamp) < Math.abs(parseDateValue(best.date) - timestamp) ? deadline : best,
    );
    onActiveChange(nearest.id);
  };

  return (
    <div className="border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="relative h-24 rounded-lg border border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-900">
        <div
          className="absolute left-4 right-4 top-5 bottom-5 cursor-ew-resize"
          onMouseMove={(event) => pickNearestFromClientX(event.clientX, event.currentTarget)}
          onPointerDown={(event) => pickNearestFromClientX(event.clientX, event.currentTarget)}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div
            className="absolute top-[calc(50%-18px)] h-9 w-0.5 bg-otu-orange shadow-[0_0_0_4px_rgba(231,93,42,0.14)]"
            style={{ left: `${markerPosition}%` }}
          >
            <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-otu-orange shadow-lg" />
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-otu-orange px-2 py-1 text-[11px] font-black text-white">
              {Math.abs(markerTimestamp - currentTimestamp) < 86400000 / 2
                ? 'Today'
                : formatShortDate(new Date(markerTimestamp).toISOString().slice(0, 10))}
            </span>
          </div>
          {sortedDeadlines.map((deadline) => {
            const active = deadline.id === activeDeadlineId;
            return (
              <button
                key={deadline.id}
                type="button"
                className={`absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 transition ${
                  active ? 'z-10 scale-110 text-otu-orange' : 'text-slate-500 hover:text-otu-orange'
                }`}
                style={{ left: `${getPosition(parseDateValue(deadline.date))}%` }}
                onClick={() => {
                  onMarkerChange(parseDateValue(deadline.date));
                  onActiveChange(deadline.id);
                }}
              >
                <span className={`h-5 w-5 rounded-full border-4 ${active ? 'border-otu-orange bg-white shadow-lg' : deadline.source === 'mine' ? 'border-otu-blue bg-white dark:bg-slate-950' : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-950'}`} />
                {!active && (
                  <span className="whitespace-nowrap rounded bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {formatShortDate(deadline.date)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DeadlinesTab({
  state,
  updateState,
  exportCalendar,
}: {
  state: PlannerState;
  updateState: (updater: (previous: PlannerState) => PlannerState) => void;
  exportCalendar: () => void;
}) {
  const sortedDeadlines = useMemo(
    () => [...state.deadlines].sort((first, second) => parseDateValue(first.date) - parseDateValue(second.date)),
    [state.deadlines],
  );
  const sortedStudentDeadlines = useMemo(
    () => [...(state.studentDeadlines ?? [])].sort((first, second) => parseDateValue(first.date) - parseDateValue(second.date)),
    [state.studentDeadlines],
  );
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('important');
  const [timelineMarkerTimestamp, setTimelineMarkerTimestamp] = useState(() => parseDateValue(new Date().toISOString().slice(0, 10)));
  const timelineDeadlines = useMemo(() => {
    const important = sortedDeadlines.map((deadline) => ({ ...deadline, source: 'important' as const }));
    const mine = sortedStudentDeadlines.map((deadline) => ({ ...deadline, source: 'mine' as const }));
    if (timelineFilter === 'important') return important;
    if (timelineFilter === 'mine') return mine;
    return [...important, ...mine].sort((first, second) => parseDateValue(first.date) - parseDateValue(second.date));
  }, [sortedDeadlines, sortedStudentDeadlines, timelineFilter]);
  const [activeDeadlineId, setActiveDeadlineId] = useState(() => sortedDeadlines[0]?.id ?? '');
  const activeTimelineDeadline = timelineDeadlines.find((deadline) => deadline.id === activeDeadlineId) ?? timelineDeadlines[0];

  useEffect(() => {
    if (timelineDeadlines.length > 0 && !timelineDeadlines.some((deadline) => deadline.id === activeDeadlineId)) {
      setActiveDeadlineId(timelineDeadlines[0].id);
    }
  }, [activeDeadlineId, timelineDeadlines]);

  const selectTimelineDate = (deadline: DeadlineEvent, source: TimelineDate['source']) => {
    if (timelineFilter !== 'both' && timelineFilter !== source) {
      setTimelineFilter(source);
    }
    setTimelineMarkerTimestamp(parseDateValue(deadline.date));
    setActiveDeadlineId(deadline.id);
  };

  const addStudentDeadline = () => {
    updateState((previous) => ({
      ...previous,
      studentDeadlines: [
        ...(previous.studentDeadlines ?? []),
        { id: uid('student-date'), title: 'My important date', date: new Date().toISOString().slice(0, 10), category: 'Custom', notes: '', completed: false },
      ],
    }));
  };

  const updateStudentDeadline = (id: string, patch: Partial<DeadlineEvent>) => {
    updateState((previous) => ({
      ...previous,
      studentDeadlines: (previous.studentDeadlines ?? []).map((deadline) => (deadline.id === id ? { ...deadline, ...patch } : deadline)),
    }));
  };

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 bg-otu-orange p-4 text-white lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black">
              <CalendarDays /> Important Dates
            </h2>
            <p className="mt-1 text-sm text-orange-50">Upcoming dates and deadlines for tuition, OSAP, scholarships, and planning milestones.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'important' as TimelineFilter, label: 'Important Dates' },
              { key: 'mine' as TimelineFilter, label: 'My Dates' },
              { key: 'both' as TimelineFilter, label: 'Both' },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-black transition ${
                  timelineFilter === option.key
                    ? 'bg-white text-otu-orange shadow-sm'
                    : 'border border-white/30 bg-white/10 text-white hover:bg-white/20'
                }`}
                onClick={() => setTimelineFilter(option.key)}
              >
                {option.label}
              </button>
            ))}
            <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-1.5 text-xs font-black text-otu-orange transition hover:bg-orange-50" onClick={exportCalendar}>
              <Download size={14} /> ICS
            </button>
          </div>
        </div>
        <ImportantDatesTimeline
          activeDeadlineId={activeTimelineDeadline?.id ?? ''}
          deadlines={timelineDeadlines}
          markerTimestamp={timelineMarkerTimestamp}
          onActiveChange={setActiveDeadlineId}
          onMarkerChange={setTimelineMarkerTimestamp}
        />
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {sortedDeadlines.map((deadline, index) => {
            const active = deadline.id === activeTimelineDeadline?.id;
            return (
              <div
                key={deadline.id}
                onFocus={() => selectTimelineDate(deadline, 'important')}
                onMouseEnter={() => selectTimelineDate(deadline, 'important')}
                className={`grid gap-3 p-4 transition md:grid-cols-[150px_1fr_140px] md:items-center ${
                  active
                    ? 'bg-orange-100 ring-2 ring-inset ring-otu-orange/40 dark:bg-orange-950/35'
                    : index % 2 === 1
                      ? 'bg-orange-50/60 dark:bg-orange-950/20'
                      : 'bg-white dark:bg-slate-900'
                }`}
              >
                <div className="font-black text-otu-orange">{deadline.date}</div>
                <div>
                  <h3 className="font-black">{deadline.title}</h3>
                  {deadline.notes && <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{deadline.notes}</p>}
                </div>
                <span className={`w-fit rounded-md px-3 py-2 text-xs font-black uppercase tracking-wide ${active ? 'bg-otu-orange text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                  {deadline.category}
                </span>
              </div>
            );
          })}
          {sortedDeadlines.length === 0 && (
            <div className="p-5 text-sm font-semibold text-slate-500 dark:text-slate-400">
              No important dates have been configured. Add them in Admin Presets.
            </div>
          )}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 bg-otu-blue p-4 text-white">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black">
              <Plus size={18} /> My Dates
            </h2>
            <p className="mt-1 text-sm text-blue-100">Add personal reminders alongside the official timeline.</p>
          </div>
          <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-otu-blue transition hover:bg-blue-50" onClick={addStudentDeadline}>
            <Plus size={16} /> Add Date
          </button>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {sortedStudentDeadlines.map((deadline, index) => {
            const active = deadline.id === activeTimelineDeadline?.id;
            return (
            <div
              key={deadline.id}
              onFocus={() => selectTimelineDate(deadline, 'mine')}
              onMouseEnter={() => selectTimelineDate(deadline, 'mine')}
              className={`grid gap-3 p-4 transition md:grid-cols-[1fr_160px_150px_1fr_40px] md:items-end ${active ? 'bg-orange-100 ring-2 ring-inset ring-otu-orange/40 dark:bg-orange-950/35' : index % 2 === 1 ? 'bg-blue-50/55 dark:bg-blue-950/20' : 'bg-white dark:bg-slate-900'}`}
            >
              <label className="text-sm font-bold">
                Title
                <input className="field mt-1" value={deadline.title} onChange={(event) => updateStudentDeadline(deadline.id, { title: event.target.value })} />
              </label>
              <label className="text-sm font-bold">
                Date
                <input className="field mt-1" type="date" value={deadline.date} onChange={(event) => updateStudentDeadline(deadline.id, { date: event.target.value })} />
              </label>
              <label className="text-sm font-bold">
                Category
                <select className="field mt-1" value={deadline.category} onChange={(event) => updateStudentDeadline(deadline.id, { category: event.target.value as DeadlineEvent['category'] })}>
                  {['OSAP', 'Tuition', 'SAFA', 'Scholarship', 'Custom'].map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold">
                Notes
                <input className="field mt-1" value={deadline.notes} onChange={(event) => updateStudentDeadline(deadline.id, { notes: event.target.value })} />
              </label>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove ${deadline.title}`}
                onClick={() =>
                  updateState((previous) => ({
                    ...previous,
                    studentDeadlines: (previous.studentDeadlines ?? []).filter((item) => item.id !== deadline.id),
                  }))
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
            );
          })}
          {(state.studentDeadlines ?? []).length === 0 && (
            <div className="p-5 text-sm font-semibold text-slate-500 dark:text-slate-400">
              Add personal due dates, reminders, appointments, or scholarship milestones here.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function AdminTab({
  state,
  updateState,
  setTab,
}: {
  state: PlannerState;
  updateState: (updater: (previous: PlannerState) => PlannerState) => void;
  setTab: (tab: DashboardTab) => void;
}) {
  const [draft, setDraft] = useState<PlannerConfig>(state.config);
  const [draftDeadlines, setDraftDeadlines] = useState<DeadlineEvent[]>(state.deadlines);
  const [status, setStatus] = useState('');

  const updateProgram = (key: ProgramKey, patch: Partial<PlannerConfig['programs'][ProgramKey]>) => {
    setDraft((previous) => ({
      ...previous,
      programs: { ...previous.programs, [key]: { ...previous.programs[key], ...patch } },
    }));
  };

  const updateHousing = (key: LivingSituation, patch: Partial<PlannerConfig['housing'][LivingSituation]>) => {
    setDraft((previous) => ({
      ...previous,
      housing: { ...previous.housing, [key]: { ...previous.housing[key], ...patch } },
    }));
  };

  const updateMealPlan = (key: MealPlanKey, patch: Partial<PlannerConfig['mealPlans'][MealPlanKey]>) => {
    setDraft((previous) => ({
      ...previous,
      mealPlans: { ...previous.mealPlans, [key]: { ...previous.mealPlans[key], ...patch } },
    }));
  };

  const addProgram = () => {
    setDraft((previous) => {
      const label = 'New Program';
      const key = makeUniqueOptionKey(label, previous.programs);
      return {
        ...previous,
        programs: {
          ...previous.programs,
          [key]: { label, tuition: 0, ancillary: 0, category: 'Other' },
        },
      };
    });
  };

  const removeProgram = (key: ProgramKey) => {
    setDraft((previous) => {
      if (Object.keys(previous.programs).length <= 1) return previous;
      const programs = Object.fromEntries(Object.entries(previous.programs).filter(([programKey]) => programKey !== key));
      return { ...previous, programs };
    });
  };

  const addHousing = () => {
    setDraft((previous) => {
      const label = 'New Housing Option';
      const key = makeUniqueOptionKey(label, previous.housing);
      return {
        ...previous,
        housing: {
          ...previous.housing,
          [key]: { label, housing: 0, food: 0, utilities: 0, description: 'Custom housing option.' },
        },
      };
    });
  };

  const removeHousing = (key: LivingSituation) => {
    setDraft((previous) => {
      if (Object.keys(previous.housing).length <= 1) return previous;
      const housing = Object.fromEntries(Object.entries(previous.housing).filter(([housingKey]) => housingKey !== key));
      return { ...previous, housing };
    });
  };

  const addMealPlan = () => {
    setDraft((previous) => {
      const label = 'New Meal Plan';
      const key = makeUniqueOptionKey(label, previous.mealPlans);
      return {
        ...previous,
        mealPlans: {
          ...previous.mealPlans,
          [key]: { label, cost: 0, description: 'Custom meal plan option.' },
        },
      };
    });
  };

  const removeMealPlan = (key: MealPlanKey) => {
    setDraft((previous) => {
      if (Object.keys(previous.mealPlans).length <= 1) return previous;
      const mealPlans = Object.fromEntries(Object.entries(previous.mealPlans).filter(([mealPlanKey]) => mealPlanKey !== key));
      return { ...previous, mealPlans };
    });
  };

  const addDeadline = () => {
    setDraftDeadlines((previous) => [
      ...previous,
      { id: uid('deadline'), title: 'Custom deadline', date: new Date().toISOString().slice(0, 10), category: 'Custom', notes: '', completed: false },
    ]);
  };

  const updateDeadline = (id: string, patch: Partial<DeadlineEvent>) => {
    setDraftDeadlines((previous) => previous.map((deadline) => (deadline.id === id ? { ...deadline, ...patch } : deadline)));
  };

  const removeDeadline = (id: string) => {
    setDraftDeadlines((previous) => previous.filter((deadline) => deadline.id !== id));
  };

  const saveConfig = async () => {
    updateState((previous) => ({ ...previous, config: draft, deadlines: draftDeadlines }));
    await saveRemotePlannerConfig(draft).catch((error) => {
      setStatus(error instanceof Error ? error.message : 'Remote preset save failed; local presets were updated.');
    });
    setStatus('Preset configuration and important dates saved.');
  };

  const applyToSelectedYear = () => {
    updateState((previous) => {
      const current = previous.yearlyBudgets[previous.selectedYear];
      return {
        ...previous,
        config: draft,
        yearlyBudgets: {
          ...previous.yearlyBudgets,
          [previous.selectedYear]: {
            ...createInitialYearBudget(
              previous.selectedYear,
              previous.tuitionInflationRate,
              current.program,
              current.livingSituation,
              draft,
              current.mealPlan,
              current.monthlyGroceries,
            ),
            planningMode: current.planningMode,
            includeSummer: true,
          },
        },
      };
    });
    setTab('budget');
  };

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 bg-otu-blue p-5 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Settings /> Admin Presets
            </h2>
            <p className="mt-1 text-sm text-blue-100">
              Supabase admins are users with `app_metadata.role = "admin"`. Sandbox mode exposes this panel locally.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-otu-blue transition hover:bg-blue-50" onClick={() => { setDraft(defaultPlannerConfig); setDraftDeadlines(defaultDeadlines); }}>
              Reset Defaults
            </button>
            <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-otu-blue transition hover:bg-blue-50" onClick={applyToSelectedYear}>
              Apply to Year {state.selectedYear}
            </button>
            <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md bg-otu-orange px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-700" onClick={saveConfig}>
              Save Presets
            </button>
          </div>
        </div>
        {status && <p className="mt-4 rounded-md bg-blue-50 p-3 text-sm font-semibold text-otu-blue dark:bg-blue-950 dark:text-blue-100">{status}</p>}
      </section>

      <section className="space-y-6">
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between gap-3 bg-otu-blue p-4 text-white">
            <h3 className="font-black">Program Tuition & Ancillary Fees</h3>
            <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-bold text-otu-blue transition hover:bg-blue-50" onClick={addProgram}>
              <Plus size={15} /> Add Program
            </button>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {Object.entries(draft.programs).map(([key, value], index) => (
              <div key={key} className={`grid gap-3 p-4 md:grid-cols-[1fr_170px_120px_120px_auto] md:items-end ${index % 2 === 1 ? 'bg-blue-50/55 dark:bg-blue-950/20' : 'bg-white dark:bg-slate-900'}`}>
                <label className="text-sm font-bold">
                  Program
                  <input className="field mt-1" value={value.label} onChange={(event) => updateProgram(key as ProgramKey, { label: event.target.value })} />
                </label>
                <label className="text-sm font-bold">
                  Category
                  <input className="field mt-1" value={value.category} onChange={(event) => updateProgram(key as ProgramKey, { category: event.target.value })} />
                </label>
                <label className="text-sm font-bold">
                  Tuition
                  <input className="field mt-1" type="number" value={value.tuition} onChange={(event) => updateProgram(key as ProgramKey, { tuition: parseCurrencyInput(event.target.value) })} />
                </label>
                <label className="text-sm font-bold">
                  Ancillary
                  <input className="field mt-1" type="number" value={value.ancillary} onChange={(event) => updateProgram(key as ProgramKey, { ancillary: parseCurrencyInput(event.target.value) })} />
                </label>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove ${value.label}`}
                  disabled={Object.keys(draft.programs).length <= 1}
                  onClick={() => removeProgram(key as ProgramKey)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between gap-3 bg-otu-orange p-4 text-white">
            <h3 className="font-black">Residence & Housing Costs</h3>
            <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-bold text-otu-orange transition hover:bg-orange-50" onClick={addHousing}>
              <Plus size={15} /> Add Option
            </button>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {Object.entries(draft.housing).map(([key, value], index) => (
              <div key={key} className={`grid gap-3 p-4 md:grid-cols-[1fr_100px_100px_100px_auto] md:items-end ${index % 2 === 1 ? 'bg-orange-50/60 dark:bg-orange-950/20' : 'bg-white dark:bg-slate-900'}`}>
                <label className="text-sm font-bold">
                  Option
                  <input className="field mt-1" value={value.label} onChange={(event) => updateHousing(key as LivingSituation, { label: event.target.value })} />
                </label>
                <label className="text-sm font-bold">
                  Residence
                  <input className="field mt-1" type="number" value={value.housing} onChange={(event) => updateHousing(key as LivingSituation, { housing: parseCurrencyInput(event.target.value) })} />
                </label>
                <label className="text-sm font-bold">
                  Food
                  <input className="field mt-1" type="number" value={value.food} onChange={(event) => updateHousing(key as LivingSituation, { food: parseCurrencyInput(event.target.value) })} />
                </label>
                <label className="text-sm font-bold">
                  Utilities
                  <input className="field mt-1" type="number" value={value.utilities} onChange={(event) => updateHousing(key as LivingSituation, { utilities: parseCurrencyInput(event.target.value) })} />
                </label>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove ${value.label}`}
                  disabled={Object.keys(draft.housing).length <= 1}
                  onClick={() => removeHousing(key as LivingSituation)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 bg-otu-orange p-4 text-white">
          <h3 className="flex items-center gap-2 font-black">
            <CalendarDays size={18} /> Important Dates
          </h3>
          <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-bold text-otu-orange transition hover:bg-orange-50" onClick={addDeadline}>
            <Plus size={15} /> Add Date
          </button>
        </div>
        <RowPresetControls
          currentRows={draftDeadlines}
          kind="deadlines"
          onApply={(preset) => setDraftDeadlines(cloneRowPresetItems('deadlines', preset.items) as DeadlineEvent[])}
          onClear={() => setDraftDeadlines([])}
          onSave={(name) => {
            const trimmedName = name.trim();
            if (!trimmedName) return;
            updateState((previous) => {
              const now = new Date().toISOString();
              const existing = previous.rowPresets.find(
                (preset) => preset.kind === 'deadlines' && preset.name.trim().toLowerCase() === trimmedName.toLowerCase(),
              );
              const nextPreset: RowPreset = {
                id: existing?.id ?? uid('preset'),
                kind: 'deadlines',
                name: trimmedName,
                items: cloneRowPresetItems('deadlines', draftDeadlines),
                createdAt: existing?.createdAt ?? now,
                updatedAt: now,
              };
              return {
                ...previous,
                rowPresets: existing
                  ? previous.rowPresets.map((preset) => (preset.id === existing.id ? nextPreset : preset))
                  : [...previous.rowPresets, nextPreset],
              };
            });
          }}
          presets={getRowPresets(state, 'deadlines')}
          tone="orange"
        />
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {draftDeadlines.map((deadline, index) => (
            <div key={deadline.id} className={`grid gap-3 p-4 md:grid-cols-[1fr_160px_150px_1fr_40px] md:items-end ${index % 2 === 1 ? 'bg-orange-50/60 dark:bg-orange-950/20' : 'bg-white dark:bg-slate-900'}`}>
              <label className="text-sm font-bold">
                Title
                <input className="field mt-1" value={deadline.title} onChange={(event) => updateDeadline(deadline.id, { title: event.target.value })} />
              </label>
              <label className="text-sm font-bold">
                Date
                <input className="field mt-1" type="date" value={deadline.date} onChange={(event) => updateDeadline(deadline.id, { date: event.target.value })} />
              </label>
              <label className="text-sm font-bold">
                Category
                <select className="field mt-1" value={deadline.category} onChange={(event) => updateDeadline(deadline.id, { category: event.target.value as DeadlineEvent['category'] })}>
                  {['OSAP', 'Tuition', 'SAFA', 'Scholarship', 'Custom'].map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold">
                Notes
                <input className="field mt-1" value={deadline.notes} onChange={(event) => updateDeadline(deadline.id, { notes: event.target.value })} />
              </label>
              <button type="button" className="icon-button" aria-label={`Remove ${deadline.title}`} onClick={() => removeDeadline(deadline.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {draftDeadlines.length === 0 && (
            <div className="p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
              Add OSAP, tuition, SAFA, scholarship, or custom dates to publish them on the Deadlines page.
            </div>
          )}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 bg-otu-blue p-4 text-white">
          <h3 className="font-black">Meal Plan Options</h3>
          <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-bold text-otu-blue transition hover:bg-blue-50" onClick={addMealPlan}>
            <Plus size={15} /> Add Meal Plan
          </button>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-4">
          {Object.entries(draft.mealPlans).map(([key, value], index) => (
            <div key={key} className={`rounded-lg border border-slate-200 p-3 dark:border-slate-800 ${index % 2 === 1 ? 'bg-blue-50/55 dark:bg-blue-950/20' : 'bg-white dark:bg-slate-900'}`}>
              <div className="flex items-start justify-between gap-2">
                <label className="min-w-0 flex-1 text-sm font-bold">
                  Label
                  <input className="field mt-1" value={value.label} onChange={(event) => updateMealPlan(key as MealPlanKey, { label: event.target.value })} />
                </label>
                <button
                  type="button"
                  className="icon-button mt-6"
                  aria-label={`Remove ${value.label}`}
                  disabled={Object.keys(draft.mealPlans).length <= 1}
                  onClick={() => removeMealPlan(key as MealPlanKey)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <label className="mt-3 block text-sm font-bold">
                Cost
                <input className="field mt-1" type="number" value={value.cost} onChange={(event) => updateMealPlan(key as MealPlanKey, { cost: parseCurrencyInput(event.target.value) })} />
              </label>
              <label className="mt-3 block text-sm font-bold">
                Description
                <input className="field mt-1" value={value.description} onChange={(event) => updateMealPlan(key as MealPlanKey, { description: event.target.value })} />
              </label>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function OnboardingWizard({
  config,
  onClose,
  onFinish,
  state,
}: {
  config: PlannerConfig;
  onClose: () => void;
  onFinish: (state: PlannerState) => void;
  state: PlannerState;
}) {
  const currentFirstYear = state.yearlyBudgets[1];
  const initialProgram = currentFirstYear && config.programs[currentFirstYear.program] ? currentFirstYear.program : Object.keys(config.programs)[0] ?? 'custom-program';
  const initialLivingSituation =
    currentFirstYear && config.housing[currentFirstYear.livingSituation]
      ? currentFirstYear.livingSituation
      : Object.keys(config.housing)[0] ?? 'custom-housing';
  const initialMealPlan =
    currentFirstYear && config.mealPlans[currentFirstYear.mealPlan]
      ? currentFirstYear.mealPlan
      : config.mealPlans.standard
        ? 'standard'
        : Object.keys(config.mealPlans)[0] ?? 'none';
  const [step, setStep] = useState(0);
  const [planTitle, setPlanTitle] = useState(state.title || 'My Ontario Tech Plan');
  const [studentName, setStudentName] = useState(state.studentName || '');
  const [academicYear, setAcademicYear] = useState(state.academicYear || '2026/27');
  const [program, setProgram] = useState<ProgramKey>(initialProgram);
  const [livingSituation, setLivingSituation] = useState<LivingSituation>(initialLivingSituation);
  const [mealPlan, setMealPlan] = useState<MealPlanKey>(initialMealPlan);
  const [monthlyGroceries, setMonthlyGroceries] = useState(currentFirstYear?.monthlyGroceries ?? 475);
  const [partTimeIncome, setPartTimeIncome] = useState(500);
  const [scholarshipName, setScholarshipName] = useState('Scholarship');
  const [scholarshipAmount, setScholarshipAmount] = useState(2000);
  const [osapAmount, setOsapAmount] = useState(8600);
  const [respAmount, setRespAmount] = useState(state.savingsSources.find((source) => source.type === 'RESP')?.amount ?? 25000);
  const [otherSavings, setOtherSavings] = useState(state.savingsSources.find((source) => source.type === 'Savings')?.amount ?? 5000);
  const [householdCount, setHouseholdCount] = useState(Math.max(1, state.households.length || 2));
  const [programSearch, setProgramSearch] = useState('');
  const [programCategory, setProgramCategory] = useState('All');

  const programCategories = useMemo(
    () => ['All', ...Array.from(new Set(Object.values(config.programs).map((preset) => preset.category || 'Other'))).sort()],
    [config.programs],
  );

  const filteredPrograms = useMemo(() => {
    const normalizedSearch = programSearch.trim().toLowerCase();
    return Object.entries(config.programs)
      .filter(([, value]) => programCategory === 'All' || (value.category || 'Other') === programCategory)
      .filter(([, value]) => {
        if (!normalizedSearch) return true;
        return `${value.label} ${value.category}`.toLowerCase().includes(normalizedSearch);
      })
      .sort(([, first], [, second]) => first.label.localeCompare(second.label));
  }, [config.programs, programCategory, programSearch]);

  useEffect(() => {
    if (!config.programs[program]) setProgram(Object.keys(config.programs)[0] ?? 'custom-program');
    if (!config.housing[livingSituation]) setLivingSituation(Object.keys(config.housing)[0] ?? 'custom-housing');
    if (!config.mealPlans[mealPlan]) setMealPlan(config.mealPlans.none ? 'none' : Object.keys(config.mealPlans)[0] ?? 'none');
    if (!programCategories.includes(programCategory)) setProgramCategory('All');
  }, [config, livingSituation, mealPlan, program, programCategories, programCategory]);

  const finish = () => {
    const firstYear = createInitialYearBudget(1, state.tuitionInflationRate, program, livingSituation, config, mealPlan, monthlyGroceries);
    const fundingSources = [
      { id: 'funding-resp-1', name: 'RESP Draw (EAP + PSE)', amount: Math.min(respAmount, 8500), category: 'RESP/Savings', savingsSourceId: 's-resp' },
      { id: 'funding-osap-1', name: 'OSAP Grants & Loans', amount: osapAmount, category: 'Government Aid' },
      ...(scholarshipAmount > 0 ? [{ id: 'funding-scholarship-1', name: scholarshipName || 'Scholarship', amount: scholarshipAmount, category: 'Scholarships' }] : []),
      ...(partTimeIncome > 0 ? [{ id: 'funding-work-1', name: 'Part-Time Work', amount: partTimeIncome * 8, category: 'Employment' }] : []),
    ];
    firstYear.fundingSources = fundingSources;
    firstYear.fallFundingSources = fundingSources.map((item) => ({ ...item, id: `${item.id}-fall`, name: `${item.name} (Fall)`, amount: Math.round(item.amount / 2) }));
    firstYear.winterFundingSources = fundingSources.map((item) => ({ ...item, id: `${item.id}-winter`, name: `${item.name} (Winter)`, amount: item.amount - Math.round(item.amount / 2) }));

    const equalShare = Math.floor(100 / householdCount);
    const households = Array.from({ length: householdCount }, (_, index) => ({
      id: `household-${index + 1}`,
      name: householdCount === 1 ? 'One Household' : `Household ${index + 1}`,
      ratio: index === 0 ? 100 - equalShare * (householdCount - 1) : equalShare,
    }));

    const nextYearlyBudgets: Record<number, YearBudget> = { ...state.yearlyBudgets, 1: firstYear };
    for (let year = 2; year <= state.degreeYearsCount; year += 1) {
      nextYearlyBudgets[year] = createInitialYearBudget(year, state.tuitionInflationRate, program, year === 1 ? livingSituation : 'off-campus', config, 'none', monthlyGroceries);
    }

    onFinish({
      ...state,
      title: planTitle.trim() || 'My Ontario Tech Plan',
      studentName: studentName.trim(),
      academicYear: academicYear.trim() || '2026/27',
      selectedYear: 1,
      activeTerm: 'academic',
      yearlyBudgets: nextYearlyBudgets,
      households,
      savingsSources: [
        { id: 's-resp', name: 'Family RESP Account', amount: respAmount, type: 'RESP' },
        { id: 's-personal', name: 'Education Savings', amount: otherSavings, type: 'Savings' },
      ],
      wizardCompleted: true,
      updatedAt: new Date().toISOString(),
    });
  };

  const currentPreview = createInitialYearBudget(1, state.tuitionInflationRate, program, livingSituation, config, mealPlan, monthlyGroceries);
  const selectedProgramPreset = config.programs[currentPreview.program] ?? Object.values(config.programs)[0];
  const selectedHousingPreset = config.housing[currentPreview.livingSituation] ?? Object.values(config.housing)[0];
  const previewCost = calculateTermTotals(currentPreview, 'academic').totalExpensesCost;
  const previewFunding = Math.min(respAmount, 8500) + osapAmount + scholarshipAmount + partTimeIncome * 8;
  const previewGap = Math.max(0, previewCost - previewFunding);

  const steps = [
    {
      eyebrow: 'Plan identity',
      title: 'Name this plan and academic year.',
      subtitle: 'These details appear in the Command Center so the plan is easy to recognize when you return.',
      body: (
        <div className="question-card">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold dark:border-slate-800 dark:bg-slate-950 md:col-span-2">
              Plan title
              <input
                className="field mt-3"
                placeholder="My Ontario Tech Plan"
                value={planTitle}
                onChange={(event) => setPlanTitle(event.target.value)}
              />
            </label>
            <label className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold dark:border-slate-800 dark:bg-slate-950">
              Student name
              <input
                className="field mt-3"
                placeholder="Student name"
                value={studentName}
                onChange={(event) => setStudentName(event.target.value)}
              />
            </label>
            <label className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold dark:border-slate-800 dark:bg-slate-950">
              Academic year
              <input
                className="field mt-3"
                placeholder="2026/27"
                value={academicYear}
                onChange={(event) => setAcademicYear(event.target.value)}
              />
            </label>
          </div>
          <div className="mt-4 rounded-lg bg-otu-blue p-4 text-white">
            <p className="text-xs font-black uppercase tracking-wide text-otu-sky">Command Center Preview</p>
            <p className="mt-2 text-lg font-black">
              {planTitle.trim() || 'My Ontario Tech Plan'} - {studentName.trim() || 'Student'} - {selectedProgramPreset?.label ?? 'Ontario Tech Degree'} - {academicYear.trim() || '2026/27'}
            </p>
          </div>
        </div>
      ),
    },
    {
      eyebrow: 'Start with school costs',
      title: 'What Ontario Tech program are you planning for?',
      subtitle: 'Choose the program first. This sets the tuition and ancillary fee defaults for the first draft.',
      body: (
        <div className="question-card">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <label className="min-w-0 flex-1 text-sm font-bold">
              Find a program
              <input
                className="field mt-1"
                placeholder="Search by program or area"
                value={programSearch}
                onChange={(event) => setProgramSearch(event.target.value)}
              />
            </label>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              {filteredPrograms.length} of {Object.keys(config.programs).length} programs
            </p>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {programCategories.map((category) => (
              <button
                key={category}
                type="button"
                className={`shrink-0 rounded-md border px-3 py-2 text-sm font-bold transition ${
                  programCategory === category
                    ? 'border-otu-orange bg-otu-orange text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-otu-sky hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200'
                }`}
                onClick={() => setProgramCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="mt-4 grid max-h-[380px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {filteredPrograms.map(([key, value]) => (
              <WizardOptionCard
                key={key}
                active={program === key}
                description={`${value.category} | ${formatCAD(value.tuition)} tuition + ${formatCAD(value.ancillary)} fees`}
                label={value.label}
                onClick={() => setProgram(key)}
              />
            ))}
          </div>
          {filteredPrograms.length === 0 && (
            <p className="mt-4 rounded-lg bg-slate-100 p-4 text-sm font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              No programs match that filter. Try another category or search term.
            </p>
          )}
        </div>
      ),
    },
    {
      eyebrow: 'Home base',
      title: 'Where will the student live?',
      subtitle: 'Housing is usually the biggest swing factor after tuition, so it gets its own step.',
      body: (
        <div className="question-card">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Living Situation</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {Object.entries(config.housing).map(([key, value]) => (
              <WizardOptionCard
                key={key}
                active={livingSituation === key}
                description={`${value.description} Housing default: ${formatCAD(value.housing)}`}
                label={value.label}
                onClick={() => {
                  const next = key as LivingSituation;
                  setLivingSituation(next);
                  setMealPlan(next === 'on-campus' || next === 'south-village' ? 'standard' : 'none');
                }}
              />
            ))}
          </div>
        </div>
      ),
    },
    {
      eyebrow: 'Food and monthly cash flow',
      title: 'How will food and work income look this year?',
      subtitle: 'Pick a meal plan or estimate groceries, then add expected part-time income.',
      body: (
        <div className="space-y-5">
          <div className="question-card">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Meal Plan</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {Object.entries(config.mealPlans).map(([key, value]) => (
                <WizardOptionCard
                  key={key}
                  active={mealPlan === key}
                  description={key === 'none' ? 'Use groceries instead' : `${formatCAD(value.cost)} estimated annual cost`}
                  label={value.label}
                  onClick={() => setMealPlan(key as MealPlanKey)}
                />
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <WizardMoneyField label="Estimated groceries per month" value={monthlyGroceries} onChange={setMonthlyGroceries} />
            <WizardMoneyField label="Part-time income per month" value={partTimeIncome} onChange={setPartTimeIncome} />
          </div>
        </div>
      ),
    },
    {
      eyebrow: 'Funding sources',
      title: 'What resources are available for the first year?',
      subtitle: 'Add scholarships, OSAP, RESP funds, and other education savings.',
      body: (
        <div className="question-card">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Aid and Savings</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold dark:border-slate-800 dark:bg-slate-950">
              Scholarship name
              <input className="field mt-3" value={scholarshipName} onChange={(event) => setScholarshipName(event.target.value)} />
            </label>
            <WizardMoneyField label="Scholarship amount" value={scholarshipAmount} onChange={setScholarshipAmount} />
            <WizardMoneyField label="OSAP estimate" value={osapAmount} onChange={setOsapAmount} />
            <WizardMoneyField label="RESP balance" value={respAmount} onChange={setRespAmount} />
            <WizardMoneyField label="Other education savings" value={otherSavings} onChange={setOtherSavings} />
          </div>
        </div>
      ),
    },
    {
      eyebrow: 'Family support',
      title: 'How many households will split the remaining gap?',
      subtitle: 'Start with an equal split. You can fine-tune household ratios later in the splitter.',
      body: (
        <div className="question-card">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Household Split</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((count) => (
              <WizardOptionCard
                key={count}
                active={householdCount === count}
                description={count === 1 ? 'One payer group' : `${count} equal starting shares`}
                label={count === 1 ? 'One Household' : `${count} Households`}
                onClick={() => setHouseholdCount(count)}
              />
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <main className="min-h-screen bg-slate-100 p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto w-full max-w-7xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="grid min-h-[calc(100vh-2rem)] overflow-hidden lg:grid-cols-[320px_1fr] md:min-h-[calc(100vh-3rem)]">
          <aside className="bg-otu-blue p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-otu-orange shadow-lg">
                <GraduationCap size={26} />
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white hover:bg-white/20"
                aria-label="Exit wizard"
                onClick={onClose}
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-8 text-xs font-black uppercase tracking-[0.22em] text-otu-sky">Ontario Tech Setup</p>
            <h2 className="mt-3 text-3xl font-black leading-tight">Build a strong first draft in minutes.</h2>
            <p className="mt-4 text-sm leading-6 text-blue-100">
              Answer a few practical questions and the planner will assemble tuition, housing, aid, savings, and family split defaults.
            </p>
            <div className="mt-8 space-y-3">
              {steps.map((wizardStep, index) => (
                <button
                  key={wizardStep.title}
                  type="button"
                  onClick={() => setStep(index)}
                  className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition ${
                    step === index ? 'bg-white text-otu-blue shadow-lg' : 'bg-white/10 text-blue-50 hover:bg-white/15'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
                      step > index ? 'bg-emerald-500 text-white' : step === index ? 'bg-otu-orange text-white' : 'bg-white/15 text-white'
                    }`}
                  >
                    {step > index ? <Check size={15} /> : index + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-black">{wizardStep.title}</span>
                    <span className={`text-xs ${step === index ? 'text-slate-500' : 'text-blue-100'}`}>{wizardStep.eyebrow}</span>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className="overflow-y-auto bg-slate-50 p-5 dark:bg-slate-950 md:p-7">
            <div className="mb-6 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-otu-orange transition-all"
                style={{ width: `${((step + 1) / steps.length) * 100}%` }}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-otu-orange">{steps[step].eyebrow}</p>
                <h2 className="mt-2 text-3xl font-black tracking-normal text-slate-950 dark:text-white">{steps[step].title}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{steps[step].subtitle}</p>
                <div className="mt-6">{steps[step].body}</div>
              </div>

              <aside className="h-fit rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Live Draft</p>
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-slate-500">Program</p>
                    <p className="font-black">{selectedProgramPreset?.label ?? 'Custom Program'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500">Housing</p>
                    <p className="font-black">{selectedHousingPreset?.label ?? 'Custom Housing'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
                    <div>
                      <p className="text-xs font-bold text-slate-500">Costs</p>
                      <p className="font-black text-otu-blue dark:text-otu-sky">{formatCAD(previewCost)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500">Funding</p>
                      <p className="font-black text-emerald-600">{formatCAD(previewFunding)}</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-otu-blue p-4 text-white">
                    <p className="text-xs font-black uppercase text-otu-sky">Estimated Gap</p>
                    <p className="mt-1 text-2xl font-black">{formatCAD(previewGap)}</p>
                  </div>
                </div>
              </aside>
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-bold text-slate-500">
                Step {step + 1} of {steps.length}
              </span>
              <div className="flex gap-2">
                <button type="button" className="secondary-button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>
                  Back
                </button>
                {step < steps.length - 1 ? (
                  <button type="button" className="primary-button" onClick={() => setStep((value) => value + 1)}>
                    Next <ArrowRight size={16} />
                  </button>
                ) : (
                  <button type="button" className="primary-button" onClick={finish}>
                    Build Budget <Sparkles size={16} />
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function SharePage({ token, navigate }: { token?: string; navigate: (path: string) => void }) {
  const [payload, setPayload] = useState(() => {
    const hashPayload = window.location.hash ? decodeSharePayload(window.location.hash.slice(1)) : null;
    return hashPayload ?? (token ? loadLocalShare(token) : null);
  });

  useEffect(() => {
    if (!payload && token) {
      void loadRemoteShare(token).then((remotePayload) => {
        if (remotePayload) setPayload(remotePayload);
      });
    }
  }, [payload, token]);

  if (!payload) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="panel max-w-md p-6 text-center">
          <Link className="mx-auto text-otu-orange" />
          <h1 className="mt-4 text-xl font-black">Share link unavailable</h1>
          <button type="button" className="primary-button mt-5" onClick={() => navigate('/')}>
            Home
          </button>
        </div>
      </div>
    );
  }

  const state = payload.plan;
  const budget = state.yearlyBudgets[state.selectedYear];
  const totals = calculateTermTotals(budget, state.activeTerm);
  const degree = calculateDegreeAnalysis(state);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <button type="button" className="secondary-button no-print mb-6" onClick={() => navigate('/')}>
        <Home size={16} /> Home
      </button>
      <section className="panel p-6">
        <p className="text-sm font-bold uppercase text-otu-orange">Read-only family summary</p>
        <h1 className="mt-2 text-3xl font-black">{state.title}</h1>
        <p className="mt-1 text-slate-500">Created {new Date(payload.createdAt).toLocaleDateString()}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Stat label="Year Gap" value={formatCAD(totals.netStudentDeficit)} tone="red" />
          <Stat label="Program Cost" value={formatCAD(degree.grandTotalCost)} />
          <Stat label="Parent Projection" value={formatCAD(degree.grandTotalParentSupportNeeded)} tone="orange" />
        </div>
        <div className="mt-6 grid gap-3">
          {state.households.map((household) => {
            const share = totals.netStudentDeficit * (household.ratio / 100);
            return (
              <div key={household.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <strong>{household.name}</strong>
                  <span>{household.ratio}%</span>
                </div>
                <p className="mt-2 font-black text-otu-blue dark:text-otu-sky">{formatCAD(share)}</p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const { route, token, navigate } = useRouter();

  useEffect(() => {
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && window.location.pathname === '/auth') {
        navigate('/app');
      }
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  if (route === 'auth') return <AuthPage navigate={navigate} />;
  if (route === 'app') return <DashboardPage navigate={navigate} />;
  if (route === 'share') return <SharePage token={token} navigate={navigate} />;
  return <LandingPage navigate={navigate} />;
}
