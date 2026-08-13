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
  SlidersHorizontal,
  Sun,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { expenseCategories, housingPresets, incomeCategories, programPresets } from './data/presets';
import {
  createDeadlineIcs,
  createPlannerCsv,
  createPrintableSummary,
  createSharePayload,
  decodeSharePayload,
  downloadTextFile,
  encodeSharePayload,
} from './lib/exports';
import { clamp, formatCAD, parseCurrencyInput, uid } from './lib/format';
import {
  addHousehold,
  calculateDegreeAnalysis,
  calculateTermTotals,
  createInitialYearBudget,
  getBudgetLists,
  getExpenseKey,
  getFundingKey,
  normalizeHouseholdRatios,
  removeHousehold,
} from './lib/planner';
import { loadLocalPlan, loadLocalShare, saveLocalPlan, saveLocalShare } from './lib/storage';
import {
  createRemoteShare,
  isSupabaseConfigured,
  loadRemoteShare,
  saveRemotePlanSnapshot,
  sendMagicLink,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  supabase,
} from './lib/supabase';
import type { DeadlineEvent, ExpenseItem, MoneyItem, PlannerState, ProgramKey, Term, YearBudget } from './types';

type Route = 'landing' | 'auth' | 'app' | 'share';
type DashboardTab = 'budget' | 'split' | 'degree' | 'deadlines';

const getRoute = (): { route: Route; token?: string } => {
  const path = window.location.pathname;
  if (path.startsWith('/auth')) return { route: 'auth' };
  if (path.startsWith('/app')) return { route: 'app' };
  if (path.startsWith('/share/')) return { route: 'share', token: decodeURIComponent(path.replace('/share/', '')) };
  return { route: 'landing' };
};

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
  const [program, setProgram] = useState<ProgramKey>('engineering');
  const [housing, setHousing] = useState<keyof typeof housingPresets>('on-campus');
  const [resp, setResp] = useState(8500);
  const teaserBudget = createInitialYearBudget(1, 3, program, housing);
  const teaserTotal = teaserBudget.expenses.reduce((sum, expense) => sum + expense.totalAmount, 0);
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
  const [darkMode, setDarkMode] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const [saved, setSaved] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const budget = state.yearlyBudgets[state.selectedYear] ?? createInitialYearBudget(state.selectedYear, state.tuitionInflationRate);
  const activeTerm = budget.planningMode === 'standard' && (state.activeTerm === 'fall' || state.activeTerm === 'winter') ? 'academic' : state.activeTerm;
  const lists = getBudgetLists(budget, activeTerm);
  const totals = useMemo(() => calculateTermTotals(budget, activeTerm), [budget, activeTerm]);
  const degree = useMemo(() => calculateDegreeAnalysis(state), [state]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    saveLocalPlan(state);
    const timer = window.setTimeout(() => void saveRemotePlanSnapshot(state).catch(() => undefined), 750);
    return () => window.clearTimeout(timer);
  }, [state]);

  const updateState = (updater: (previous: PlannerState) => PlannerState) => {
    setState((previous) => ({ ...updater(previous), updatedAt: new Date().toISOString() }));
  };

  const updateBudget = (year: number, updater: (budget: YearBudget) => YearBudget) => {
    updateState((previous) => {
      const current = previous.yearlyBudgets[year] ?? createInitialYearBudget(year, previous.tuitionInflationRate);
      return {
        ...previous,
        yearlyBudgets: { ...previous.yearlyBudgets, [year]: updater(current) },
      };
    });
  };

  const setTerm = (term: Term) => {
    updateState((previous) => ({ ...previous, activeTerm: term }));
  };

  const applyPreset = (program: ProgramKey, livingSituation: keyof typeof housingPresets) => {
    updateBudget(state.selectedYear, (current) => ({
      ...createInitialYearBudget(state.selectedYear, state.tuitionInflationRate, program, livingSituation),
      planningMode: current.planningMode,
      includeSummer: current.includeSummer,
    }));
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
        [key]: [...current[key], { id: uid('expense'), name: 'New expense', totalAmount: 0, coveredByOthers: 0, category: 'Lifestyle' }],
      };
    });
  };

  const removeItem = (type: 'funding' | 'expense', id: string) => {
    updateBudget(state.selectedYear, (current) => {
      const key = type === 'funding' ? getFundingKey(activeTerm) : getExpenseKey(activeTerm);
      return { ...current, [key]: current[key].filter((item) => item.id !== id) };
    });
  };

  const createShare = async () => {
    const token = uid('share');
    const payload = createSharePayload(state);
    const encoded = encodeSharePayload(payload);
    saveLocalShare(token, state);
    await createRemoteShare(state, token, payload).catch(() => undefined);
    setShareUrl(`${window.location.origin}/share/${encodeURIComponent(token)}#${encoded}`);
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

  return (
    <div className="min-h-screen pb-16">
      <header className="no-print sticky top-0 z-30 border-b-4 border-otu-orange bg-otu-blue text-white shadow-lg">
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
            <NavButton active={tab === 'split'} onClick={() => setTab('split')}>
              <Users size={16} /> Splitter
            </NavButton>
            <NavButton active={tab === 'degree'} onClick={() => setTab('degree')}>
              <PiggyBank size={16} /> Degree
            </NavButton>
            <NavButton active={tab === 'deadlines'} onClick={() => setTab('deadlines')}>
              <CalendarDays size={16} /> Deadlines
            </NavButton>
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
        <section className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="panel p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <label className="text-sm font-bold">
                Plan title
                <input className="field mt-1" value={state.title} onChange={(event) => updateState((previous) => ({ ...previous, title: event.target.value }))} />
              </label>
              <label className="text-sm font-bold">
                Student
                <input className="field mt-1" value={state.studentName} onChange={(event) => updateState((previous) => ({ ...previous, studentName: event.target.value }))} />
              </label>
              <label className="text-sm font-bold">
                Inflation
                <input
                  className="field mt-1"
                  type="number"
                  min={1}
                  max={8}
                  value={state.tuitionInflationRate}
                  onChange={(event) =>
                    updateState((previous) => ({ ...previous, tuitionInflationRate: clamp(parseCurrencyInput(event.target.value), 1, 8) }))
                  }
                />
              </label>
              <label className="text-sm font-bold">
                Degree years
                <input
                  className="field mt-1"
                  type="number"
                  min={1}
                  max={5}
                  value={state.degreeYearsCount}
                  onChange={(event) => {
                    const count = clamp(parseCurrencyInput(event.target.value), 1, 5);
                    updateState((previous) => {
                      const yearlyBudgets = { ...previous.yearlyBudgets };
                      for (let year = 1; year <= count; year += 1) {
                        yearlyBudgets[year] ??= createInitialYearBudget(year, previous.tuitionInflationRate);
                      }
                      return { ...previous, degreeYearsCount: count, selectedYear: Math.min(previous.selectedYear, count), yearlyBudgets };
                    });
                  }}
                />
              </label>
            </div>
          </div>
          <div className="panel flex flex-wrap items-center gap-2 p-4">
            <button type="button" className="secondary-button" onClick={exportCsv}>
              <Download size={16} /> CSV
            </button>
            <button type="button" className="secondary-button" onClick={printSummary}>
              <Printer size={16} /> PDF
            </button>
            <button type="button" className="secondary-button" onClick={createShare}>
              <Share2 size={16} /> Share
            </button>
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

        {tab === 'budget' && (
          <BudgetTab
            state={state}
            budget={budget}
            activeTerm={activeTerm}
            lists={lists}
            totals={totals}
            setTerm={setTerm}
            updateBudget={updateBudget}
            updateState={updateState}
            applyPreset={applyPreset}
            addItem={addItem}
            updateItem={updateItem}
            removeItem={removeItem}
          />
        )}
        {tab === 'split' && <SplitterTab state={state} totals={totals} updateState={updateState} />}
        {tab === 'degree' && <DegreeTab state={state} degree={degree} updateState={updateState} />}
        {tab === 'deadlines' && <DeadlinesTab state={state} updateState={updateState} exportCalendar={exportCalendar} />}
      </main>
    </div>
  );
}

function BudgetTab({
  state,
  budget,
  activeTerm,
  lists,
  totals,
  setTerm,
  updateBudget,
  updateState,
  applyPreset,
  addItem,
  updateItem,
  removeItem,
}: {
  state: PlannerState;
  budget: YearBudget;
  activeTerm: Term;
  lists: { funding: MoneyItem[]; expenses: ExpenseItem[] };
  totals: ReturnType<typeof calculateTermTotals>;
  setTerm: (term: Term) => void;
  updateBudget: (year: number, updater: (budget: YearBudget) => YearBudget) => void;
  updateState: (updater: (previous: PlannerState) => PlannerState) => void;
  applyPreset: (program: ProgramKey, livingSituation: keyof typeof housingPresets) => void;
  addItem: (type: 'funding' | 'expense') => void;
  updateItem: (type: 'funding' | 'expense', id: string, patch: Partial<MoneyItem & ExpenseItem>) => void;
  removeItem: (type: 'funding' | 'expense', id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <section className="panel p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-4">
            <label className="text-sm font-bold">
              Year
              <select
                className="field mt-1"
                value={state.selectedYear}
                onChange={(event) => updateState((previous) => ({ ...previous, selectedYear: parseCurrencyInput(event.target.value), activeTerm: 'academic' }))}
              >
                {Array.from({ length: state.degreeYearsCount }, (_, index) => index + 1).map((year) => (
                  <option key={year} value={year}>
                    Year {year}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Program
              <select className="field mt-1" value={budget.program} onChange={(event) => applyPreset(event.target.value as ProgramKey, budget.livingSituation)}>
                {Object.entries(programPresets).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Housing
              <select className="field mt-1" value={budget.livingSituation} onChange={(event) => applyPreset(budget.program, event.target.value as keyof typeof housingPresets)}>
                {Object.entries(housingPresets).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Granularity
              <select
                className="field mt-1"
                value={budget.planningMode}
                onChange={(event) => {
                  const planningMode = event.target.value as YearBudget['planningMode'];
                  updateBudget(state.selectedYear, (current) => ({ ...current, planningMode }));
                  setTerm(planningMode === 'semester' ? 'fall' : 'academic');
                }}
              >
                <option value="standard">Standard 8-month</option>
                <option value="semester">Fall / Winter</option>
              </select>
            </label>
          </div>
          <button type="button" className="secondary-button" onClick={() => updateBudget(state.selectedYear, (current) => ({ ...current, includeSummer: !current.includeSummer }))}>
            <Sun size={16} /> Summer {budget.includeSummer ? 'On' : 'Off'}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(budget.planningMode === 'semester' ? (['fall', 'winter'] as Term[]) : (['academic'] as Term[])).map((term) => (
            <button key={term} type="button" className={activeTerm === term ? 'primary-button' : 'secondary-button'} onClick={() => setTerm(term)}>
              {term === 'academic' ? 'Academic' : term[0].toUpperCase() + term.slice(1)}
            </button>
          ))}
          {budget.includeSummer && (
            <button type="button" className={activeTerm === 'summer' ? 'primary-button' : 'secondary-button'} onClick={() => setTerm('summer')}>
              Summer
            </button>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Stat label="Term Net" value={formatCAD(Math.abs(totals.totalFunding - totals.myShareExpenses))} tone={totals.myShareExpenses > totals.totalFunding ? 'red' : 'green'} />
        <Stat label="Aid & Income" value={formatCAD(totals.totalFunding)} tone="green" />
        <Stat label="My Expenses" value={formatCAD(totals.myShareExpenses)} tone="orange" />
        <Stat label="Parent Gap" value={formatCAD(totals.netStudentDeficit)} tone="red" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <EditableTable
          title="Income & Aid"
          icon={<Landmark size={18} />}
          items={lists.funding}
          type="funding"
          categories={incomeCategories}
          addItem={addItem}
          updateItem={updateItem}
          removeItem={removeItem}
        />
        <EditableTable
          title="Expenses"
          icon={<Wallet size={18} />}
          items={lists.expenses}
          type="expense"
          categories={expenseCategories}
          addItem={addItem}
          updateItem={updateItem}
          removeItem={removeItem}
        />
      </section>
    </div>
  );
}

function EditableTable({
  title,
  icon,
  items,
  type,
  categories,
  addItem,
  updateItem,
  removeItem,
}: {
  title: string;
  icon: React.ReactNode;
  items: Array<MoneyItem | ExpenseItem>;
  type: 'funding' | 'expense';
  categories: string[];
  addItem: (type: 'funding' | 'expense') => void;
  updateItem: (type: 'funding' | 'expense', id: string, patch: Partial<MoneyItem & ExpenseItem>) => void;
  removeItem: (type: 'funding' | 'expense', id: string) => void;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-sm font-black">
          {icon} {title}
        </h2>
        <button type="button" className="secondary-button" onClick={() => addItem(type)}>
          <Plus size={16} /> Add
        </button>
      </div>
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {items.map((item) => {
          const expense = 'totalAmount' in item;
          return (
            <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_130px_130px_40px] md:items-center">
              <input className="field" value={item.name} onChange={(event) => updateItem(type, item.id, { name: event.target.value })} />
              <select className="field" value={item.category} onChange={(event) => updateItem(type, item.id, { category: event.target.value })}>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <input
                className="field"
                type="number"
                value={expense ? item.totalAmount : item.amount}
                onChange={(event) =>
                  updateItem(type, item.id, expense ? { totalAmount: parseCurrencyInput(event.target.value) } : { amount: parseCurrencyInput(event.target.value) })
                }
              />
              <button type="button" className="icon-button" aria-label={`Remove ${item.name}`} onClick={() => removeItem(type, item.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SplitterTab({
  state,
  totals,
  updateState,
}: {
  state: PlannerState;
  totals: ReturnType<typeof calculateTermTotals>;
  updateState: (updater: (previous: PlannerState) => PlannerState) => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="panel p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-black">
            <SlidersHorizontal className="text-otu-orange" /> Household Ratios
          </h2>
          <button type="button" className="secondary-button" onClick={() => updateState((previous) => ({ ...previous, households: addHousehold(previous.households) }))}>
            <Plus size={16} /> Add
          </button>
        </div>
        <div className="mt-5 space-y-4">
          {state.households.map((household) => (
            <div key={household.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
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

      <section className="panel p-5">
        <h2 className="text-lg font-black">Payment Schedule</h2>
        <div className="mt-4 grid gap-3">
          {state.households.map((household) => {
            const share = totals.netStudentDeficit * (household.ratio / 100);
            return (
              <div key={household.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
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
  updateState,
}: {
  state: PlannerState;
  degree: ReturnType<typeof calculateDegreeAnalysis>;
  updateState: (updater: (previous: PlannerState) => PlannerState) => void;
}) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <Stat label="Program Cost" value={formatCAD(degree.grandTotalCost)} />
        <Stat label="Aid & Work" value={formatCAD(degree.grandTotalWorkAndAid)} tone="green" />
        <Stat label="RESP Drawn" value={formatCAD(degree.grandTotalRespDrawn)} tone="orange" />
        <Stat label="Parent Gap" value={formatCAD(degree.grandTotalParentSupportNeeded)} tone="red" />
      </section>
      <section className="panel overflow-hidden">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-lg font-black">RESP & Savings Runway</h2>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {degree.yearlyBreakdowns.map((year) => (
            <button
              key={year.yearNum}
              type="button"
              onClick={() => updateState((previous) => ({ ...previous, selectedYear: year.yearNum }))}
              className={`grid w-full gap-4 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800 md:grid-cols-[90px_1fr_1fr_1fr] ${
                state.selectedYear === year.yearNum ? 'bg-blue-50 dark:bg-blue-950/40' : ''
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-otu-blue font-black text-white">Y{year.yearNum}</div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Cost</p>
                <p className="font-black">{formatCAD(year.totalCost)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">RESP</p>
                <p className="font-black text-otu-orange">{formatCAD(year.respStart)} to {formatCAD(year.respEnd)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Support</p>
                <p className="font-black text-rose-600">{formatCAD(year.parentCoverageNeeded)}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
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
  const addDeadline = () => {
    updateState((previous) => ({
      ...previous,
      deadlines: [
        ...previous.deadlines,
        { id: uid('deadline'), title: 'Custom deadline', date: new Date().toISOString().slice(0, 10), category: 'Custom', notes: '', completed: false },
      ],
    }));
  };

  const updateDeadline = (id: string, patch: Partial<DeadlineEvent>) => {
    updateState((previous) => ({
      ...previous,
      deadlines: previous.deadlines.map((deadline) => (deadline.id === id ? { ...deadline, ...patch } : deadline)),
    }));
  };

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <CalendarDays className="text-otu-orange" /> SAFA Deadlines
        </h2>
        <div className="flex gap-2">
          <button type="button" className="secondary-button" onClick={exportCalendar}>
            <Download size={16} /> ICS
          </button>
          <button type="button" className="primary-button" onClick={addDeadline}>
            <Plus size={16} /> Add
          </button>
        </div>
      </div>
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {state.deadlines.map((deadline) => (
          <div key={deadline.id} className="grid gap-3 p-4 md:grid-cols-[auto_1fr_160px_150px_40px] md:items-center">
            <input type="checkbox" checked={deadline.completed} onChange={(event) => updateDeadline(deadline.id, { completed: event.target.checked })} />
            <input className="field" value={deadline.title} onChange={(event) => updateDeadline(deadline.id, { title: event.target.value })} />
            <input className="field" type="date" value={deadline.date} onChange={(event) => updateDeadline(deadline.id, { date: event.target.value })} />
            <select className="field" value={deadline.category} onChange={(event) => updateDeadline(deadline.id, { category: event.target.value as DeadlineEvent['category'] })}>
              {['OSAP', 'Tuition', 'SAFA', 'Scholarship', 'Custom'].map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove ${deadline.title}`}
              onClick={() => updateState((previous) => ({ ...previous, deadlines: previous.deadlines.filter((item) => item.id !== deadline.id) }))}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </section>
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
