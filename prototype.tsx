import React, { useState, useMemo } from 'react';
import { 
  GraduationCap, 
  Users, 
  CalendarRange, 
  User, 
  Wallet, 
  TrendingUp, 
  PiggyBank, 
  Landmark, 
  Plus, 
  Trash2, 
  BookOpen, 
  Home, 
  Settings, 
  Copy, 
  Check, 
  Share2, 
  DollarSign, 
  Sliders, 
  ChevronRight, 
  ArrowRight,
  Sparkles,
  Edit3,
  CheckCircle2,
  X,
  Minus,
  Tag,
  Sun,
  Edit2,
  Shield,
  Info,
  Download,
  Calculator,
  Layers,
  Calendar
} from 'lucide-react';

// Helper to generate year-specific detailed budgets tailored for Ontario Tech University student expenses
const createInitialYearBudget = (yearNum, tuitionHikePercent = 0.03) => {
  const mult = Math.pow(1 + tuitionHikePercent, yearNum - 1);
  const isOffCampus = yearNum > 1;

  const baseAcademicFunding = isOffCampus ? [
    { id: `f1-${yearNum}`, name: 'RESP Draw (EAP + PSE)', amount: Math.round(8000 * Math.pow(0.95, yearNum - 1)), category: 'RESP/Savings' },
    { id: `f2-${yearNum}`, name: 'OSAP Grants & Aid', amount: yearNum === 1 ? 3800 : 2800, category: 'Government Aid' },
    { id: `f3-${yearNum}`, name: 'OSAP Student Loans', amount: 4800, category: 'Government Aid' },
    { id: `f4-${yearNum}`, name: 'Ontario Tech Entrance/Continuing Award', amount: yearNum === 1 ? 2000 : 1000, category: 'Scholarships' },
    { id: `f5-${yearNum}`, name: 'Campus Work-Study / Part-Time Job', amount: Math.round(5000 * (1 + 0.05 * (yearNum - 1))), category: 'Employment' },
  ] : [
    { id: `f1-${yearNum}`, name: 'RESP Draw (EAP + PSE)', amount: 8000, category: 'RESP/Savings' },
    { id: `f2-${yearNum}`, name: 'OSAP Grants & Aid', amount: 3800, category: 'Government Aid' },
    { id: `f3-${yearNum}`, name: 'OSAP Student Loans', amount: 4800, category: 'Government Aid' },
    { id: `f4-${yearNum}`, name: 'Ontario Tech Entrance Scholarship', amount: 2000, category: 'Scholarships' },
    { id: `f5-${yearNum}`, name: 'Summer Savings / Part-Time Work', amount: 4800, category: 'Employment' },
  ];

  const baseAcademicExpenses = isOffCampus ? [
    { id: `e1-${yearNum}`, name: 'Tuition Fees', totalAmount: Math.round(7800 * mult), coveredByOthers: 0, category: 'Academic' },
    { id: `e2-${yearNum}`, name: 'Ontario Tech Ancillary & SAFA Fees', totalAmount: Math.round(1200 * mult), coveredByOthers: 0, category: 'Academic' },
    { id: `e3-${yearNum}`, name: 'Textbooks, Digital Code & Software', totalAmount: Math.round(900 * mult), coveredByOthers: 0, category: 'Academic' },
    { id: `e4-${yearNum}`, name: 'Off-Campus Rent in Oshawa', totalAmount: Math.round(8000 * mult), coveredByOthers: 0, category: 'Housing' }, 
    { id: `e5-${yearNum}`, name: 'Groceries & Household Supplies', totalAmount: Math.round(3400 * mult), coveredByOthers: 0, category: 'Food' },
    { id: `e6-${yearNum}`, name: 'Utilities & High-Speed Internet', totalAmount: Math.round(850 * mult), coveredByOthers: 0, category: 'Housing' },
    { id: `e7-${yearNum}`, name: 'Cell Phone Plan', totalAmount: Math.round(480 * mult), coveredByOthers: 0, category: 'Lifestyle' }, 
    { id: `e8-${yearNum}`, name: 'Durham Region Transit / Go Pass', totalAmount: Math.round(600 * mult), coveredByOthers: 0, category: 'Lifestyle' },
    { id: `e9-${yearNum}`, name: 'Personal Care & Recreation', totalAmount: Math.round(1300 * mult), coveredByOthers: 0, category: 'Lifestyle' },
  ] : [
    { id: `e1-${yearNum}`, name: 'Tuition Fees', totalAmount: 7800, coveredByOthers: 0, category: 'Academic' },
    { id: `e2-${yearNum}`, name: 'Ontario Tech Ancillary & SAFA Fees', totalAmount: 1200, coveredByOthers: 0, category: 'Academic' },
    { id: `e3-${yearNum}`, name: 'Textbooks, Digital Code & Software', totalAmount: 900, coveredByOthers: 0, category: 'Academic' },
    { id: `e10-${yearNum}`, name: 'Simcoe Village / South Village Residence', totalAmount: 9800, coveredByOthers: 0, category: 'Housing' },
    { id: `e11-${yearNum}`, name: 'Campus Dining Meal Plan', totalAmount: 5900, coveredByOthers: 0, category: 'Food' },
    { id: `e7-${yearNum}`, name: 'Cell Phone Plan', totalAmount: 480, coveredByOthers: 0, category: 'Lifestyle' },
    { id: `e9-${yearNum}`, name: 'Personal Care & Recreation', totalAmount: 1400, coveredByOthers: 0, category: 'Lifestyle' },
  ];

  // Divide academic budget into Fall and Winter semester defaults (50/50 split)
  const fallFunding = baseAcademicFunding.map(f => ({
    ...f,
    id: `${f.id}-fall`,
    name: `${f.name} (Fall)`,
    amount: Math.round(f.amount / 2)
  }));

  const winterFunding = baseAcademicFunding.map(f => ({
    ...f,
    id: `${f.id}-wint`,
    name: `${f.name} (Winter)`,
    amount: f.amount - Math.round(f.amount / 2)
  }));

  const fallExpenses = baseAcademicExpenses.map(e => ({
    ...e,
    id: `${e.id}-fall`,
    name: `${e.name} (Fall)`,
    totalAmount: Math.round(e.totalAmount / 2),
    coveredByOthers: Math.round((e.coveredByOthers || 0) / 2)
  }));

  const winterExpenses = baseAcademicExpenses.map(e => ({
    ...e,
    id: `${e.id}-wint`,
    name: `${e.name} (Winter)`,
    totalAmount: e.totalAmount - Math.round(e.totalAmount / 2),
    coveredByOthers: (e.coveredByOthers || 0) - Math.round((e.coveredByOthers || 0) / 2)
  }));

  return {
    planningMode: 'standard', // 'standard' (8-mo) | 'semester' (Fall / Winter breakdown)
    livingSituation: isOffCampus ? 'off-campus' : 'on-campus',
    fundingSources: baseAcademicFunding,
    expenses: baseAcademicExpenses,
    fallFundingSources: fallFunding,
    winterFundingSources: winterFunding,
    fallExpenses: fallExpenses,
    winterExpenses: winterExpenses,
    includeSummer: false,
    summerFundingSources: [
      { id: `sf1-${yearNum}`, name: 'Summer Full-Time Job', amount: 6500, category: 'Employment' },
    ],
    summerExpenses: [
      { id: `se1-${yearNum}`, name: 'Summer Rent (4 mo)', totalAmount: Math.round((isOffCampus ? 8000 : 9800) / 2 * mult), coveredByOthers: 0, category: 'Housing' },
      { id: `se2-${yearNum}`, name: 'Summer Groceries (4 mo)', totalAmount: Math.round((isOffCampus ? 3400 : 3000) / 2 * mult), coveredByOthers: 0, category: 'Food' },
      { id: `se3-${yearNum}`, name: 'Summer Living & Misc', totalAmount: 850, coveredByOthers: 0, category: 'Lifestyle' },
    ]
  };
};

export default function App() {
  // Navigation tab state: 'student' | 'parents' | 'degree'
  const [activeTab, setActiveTab] = useState('student');

  // Active Year Selection & Active Term View ('academic' | 'fall' | 'winter' | 'summer')
  const [selectedYear, setSelectedYear] = useState(1);
  const [activeTerm, setActiveTerm] = useState('academic');

  // Degree Planning Settings
  const [degreeYearsCount, setDegreeYearsCount] = useState(4);
  const [tuitionInflationRate, setTuitionInflationRate] = useState(3);

  // Yearly Budgets State
  const [yearlyBudgets, setYearlyBudgets] = useState(() => ({
    1: createInitialYearBudget(1),
    2: createInitialYearBudget(2),
    3: createInitialYearBudget(3),
    4: createInitialYearBudget(4),
  }));

  // Savings and RESP Pool State
  const [savingsSources, setSavingsSources] = useState([
    { id: 's1', name: 'RBC RESP Account', amount: 25000, type: 'RESP' },
    { id: 's2', name: 'Personal High-Interest Savings', amount: 5000, type: 'Savings' },
  ]);
  const [showSavingsConfig, setShowSavingsConfig] = useState(false);
  const [newSavingsSource, setNewSavingsSource] = useState({ name: '', amount: '', type: 'RESP' });

  // Current Active Budget
  const currentBudget = useMemo(() => {
    return yearlyBudgets[selectedYear] || createInitialYearBudget(selectedYear);
  }, [yearlyBudgets, selectedYear]);

  const planningMode = currentBudget.planningMode || 'standard';
  const includeSummer = currentBudget.includeSummer || false;

  // Toggle between Standard (8 mo) and By Semester (Fall / Winter) planning modes
  const handleTogglePlanningMode = (newMode) => {
    setYearlyBudgets(prev => {
      const target = prev[selectedYear] || createInitialYearBudget(selectedYear);
      let updated = { ...target, planningMode: newMode };
      
      // Auto-populate fall and winter lists if they are empty
      if (newMode === 'semester') {
        if (!target.fallFundingSources || target.fallFundingSources.length === 0) {
          updated.fallFundingSources = (target.fundingSources || []).map(f => ({
            ...f,
            id: `${f.id}-fall`,
            name: `${f.name} (Fall)`,
            amount: Math.round((f.amount || 0) / 2)
          }));
          updated.winterFundingSources = (target.fundingSources || []).map(f => ({
            ...f,
            id: `${f.id}-wint`,
            name: `${f.name} (Winter)`,
            amount: (f.amount || 0) - Math.round((f.amount || 0) / 2)
          }));
        }
        if (!target.fallExpenses || target.fallExpenses.length === 0) {
          updated.fallExpenses = (target.expenses || []).map(e => ({
            ...e,
            id: `${e.id}-fall`,
            name: `${e.name} (Fall)`,
            totalAmount: Math.round((e.totalAmount || 0) / 2),
            coveredByOthers: Math.round((e.coveredByOthers || 0) / 2)
          }));
          updated.winterExpenses = (target.expenses || []).map(e => ({
            ...e,
            id: `${e.id}-wint`,
            name: `${e.name} (Winter)`,
            totalAmount: (e.totalAmount || 0) - Math.round((e.totalAmount || 0) / 2),
            coveredByOthers: (e.coveredByOthers || 0) - Math.round((e.coveredByOthers || 0) / 2)
          }));
        }
      }
      return { ...prev, [selectedYear]: updated };
    });

    if (newMode === 'standard' && (activeTerm === 'fall' || activeTerm === 'winter')) {
      setActiveTerm('academic');
    } else if (newMode === 'semester' && activeTerm === 'academic') {
      setActiveTerm('fall');
    }
  };

  // Funding and Expenses array resolution based on active term
  const fundingSources = useMemo(() => {
    if (activeTerm === 'summer') return currentBudget.summerFundingSources || [];
    if (activeTerm === 'fall') return currentBudget.fallFundingSources || [];
    if (activeTerm === 'winter') return currentBudget.winterFundingSources || [];
    return currentBudget.fundingSources || [];
  }, [activeTerm, currentBudget]);

  const expenses = useMemo(() => {
    if (activeTerm === 'summer') return currentBudget.summerExpenses || [];
    if (activeTerm === 'fall') return currentBudget.fallExpenses || [];
    if (activeTerm === 'winter') return currentBudget.winterExpenses || [];
    return currentBudget.expenses || [];
  }, [activeTerm, currentBudget]);

  const globalRespPool = useMemo(() => {
    return savingsSources.filter(s => s.type === 'RESP').reduce((sum, s) => sum + Number(s.amount || 0), 0);
  }, [savingsSources]);

  const globalSavingsPool = useMemo(() => {
    return savingsSources.filter(s => s.type === 'Savings').reduce((sum, s) => sum + Number(s.amount || 0), 0);
  }, [savingsSources]);

  const respWithdrawalThisYear = useMemo(() => {
    if (!currentBudget) return 0;
    let totalResp = 0;
    if (currentBudget.planningMode === 'semester') {
      const fallResp = (currentBudget.fallFundingSources || []).filter(f => f.name.toLowerCase().includes('resp')).reduce((s, f) => s + Number(f.amount || 0), 0);
      const winterResp = (currentBudget.winterFundingSources || []).filter(f => f.name.toLowerCase().includes('resp')).reduce((s, f) => s + Number(f.amount || 0), 0);
      totalResp = fallResp + winterResp;
    } else {
      totalResp = (currentBudget.fundingSources || []).filter(f => f.name.toLowerCase().includes('resp')).reduce((s, f) => s + Number(f.amount || 0), 0);
    }
    if (currentBudget.includeSummer) {
      const summerResp = (currentBudget.summerFundingSources || []).filter(f => f.name.toLowerCase().includes('resp')).reduce((s, f) => s + Number(f.amount || 0), 0);
      totalResp += summerResp;
    }
    return totalResp;
  }, [currentBudget]);

  const handleAddSavingsSource = () => {
    if (!newSavingsSource.name || !newSavingsSource.amount) return;
    setSavingsSources(prev => [
      ...prev,
      { id: `s-${Date.now()}`, name: newSavingsSource.name, amount: Number(newSavingsSource.amount), type: newSavingsSource.type }
    ]);
    setNewSavingsSource({ name: '', amount: '', type: 'RESP' });
  };

  const handleRemoveSavingsSource = (id) => {
    setSavingsSources(prev => prev.filter(s => s.id !== id));
  };

  const handleUpdateSavingsSource = (id, field, value) => {
    setSavingsSources(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, [field]: field === 'amount' ? (value === '' ? '' : Number(value)) : value };
      }
      return s;
    }));
  };

  const handleAddDegreeYear = () => {
    const nextYear = degreeYearsCount + 1;
    setDegreeYearsCount(nextYear);
    setYearlyBudgets(prev => ({
      ...prev,
      [nextYear]: prev[nextYear] || createInitialYearBudget(nextYear)
    }));
  };

  const handleRemoveDegreeYear = () => {
    if (degreeYearsCount <= 1) return;
    const newCount = degreeYearsCount - 1;
    setDegreeYearsCount(newCount);
    if (selectedYear > newCount) {
      setSelectedYear(newCount);
    }
  };

  // Parent Household Splitter State & Handlers
  const [parents, setParents] = useState([
    { id: 'p1', name: 'Household 1 (Mom)', ratio: 50 },
    { id: 'p2', name: 'Household 2 (Dad)', ratio: 50 },
  ]);

  const handleAddParent = () => {
    setParents(prev => {
      const newCount = prev.length + 1;
      const equalShare = Math.floor(100 / newCount);
      const remainder = 100 - (equalShare * newCount);
      const updated = prev.map((p, idx) => ({ ...p, ratio: equalShare + (idx === 0 ? remainder : 0) }));
      return [
        ...updated,
        { id: `p-${Date.now()}`, name: `Household ${newCount}`, ratio: equalShare }
      ];
    });
  };

  const handleRemoveParent = (id) => {
    if (parents.length <= 1) return;
    setParents(prev => {
      const filtered = prev.filter(p => p.id !== id);
      const newCount = filtered.length;
      const totalRatio = filtered.reduce((sum, p) => sum + p.ratio, 0);
      if (totalRatio === 0) {
        const equalShare = Math.floor(100 / newCount);
        return filtered.map((p, idx) => ({ ...p, ratio: idx === 0 ? 100 - equalShare * (newCount - 1) : equalShare }));
      }
      return filtered.map(p => ({
        ...p,
        ratio: Math.round((p.ratio / totalRatio) * 100)
      }));
    });
  };

  const [copiedReport, setCopiedReport] = useState(false);

  // Category State
  const [incomeCategories, setIncomeCategories] = useState([
    { id: 'ic1', name: 'RESP/Savings' },
    { id: 'ic2', name: 'Government Aid' },
    { id: 'ic3', name: 'Scholarships' },
    { id: 'ic4', name: 'Employment' },
  ]);
  const [expenseCategories, setExpenseCategories] = useState([
    { id: 'ec1', name: 'Academic' },
    { id: 'ec2', name: 'Housing' },
    { id: 'ec3', name: 'Food' },
    { id: 'ec4', name: 'Lifestyle' },
  ]);

  // Modals / Quick forms
  const [showAddFunding, setShowAddFunding] = useState(false);
  const [newFunding, setNewFunding] = useState({ name: '', amount: '', category: 'Employment' });
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpense, setNewExpense] = useState({ name: '', totalAmount: '', coveredByOthers: '0', category: 'Lifestyle' });
  const [showExpenseCopyMenu, setShowExpenseCopyMenu] = useState(false);

  const updateActiveYearBudget = (updater) => {
    setYearlyBudgets(prev => {
      const activeObj = prev[selectedYear] || createInitialYearBudget(selectedYear);
      const updatedObj = typeof updater === 'function' ? updater(activeObj) : { ...activeObj, ...updater };
      return { ...prev, [selectedYear]: updatedObj };
    });
  };

  const toggleSummerTermForYear = (yearNum) => {
    setYearlyBudgets(prev => {
      const targetObj = prev[yearNum] || createInitialYearBudget(yearNum);
      return {
        ...prev,
        [yearNum]: {
          ...targetObj,
          includeSummer: !targetObj.includeSummer
        }
      };
    });
  };

  const { 
    totalFunding, 
    totalExpensesCost, 
    myShareExpenses, 
    netStudentDeficit, 
    academicFunding, 
    academicExpenses, 
    fallFunding,
    fallExpenses,
    winterFunding,
    winterExpenses,
    summerFunding, 
    summerExpensesTotal, 
    summerSurplusThisYear 
  } = useMemo(() => {
    // Fall calculations
    const fFunding = (currentBudget.fallFundingSources || []).reduce((s, item) => s + Number(item.amount || 0), 0);
    const fTotalExp = (currentBudget.fallExpenses || []).reduce((s, item) => s + Number(item.totalAmount || 0), 0);
    const fOthersShare = (currentBudget.fallExpenses || []).reduce((s, item) => s + Number(item.coveredByOthers || 0), 0);
    const fMyShare = fTotalExp - fOthersShare;

    // Winter calculations
    const wFunding = (currentBudget.winterFundingSources || []).reduce((s, item) => s + Number(item.amount || 0), 0);
    const wTotalExp = (currentBudget.winterExpenses || []).reduce((s, item) => s + Number(item.totalAmount || 0), 0);
    const wOthersShare = (currentBudget.winterExpenses || []).reduce((s, item) => s + Number(item.coveredByOthers || 0), 0);
    const wMyShare = wTotalExp - wOthersShare;

    // Standard 8-month Academic calculations
    const stdFunding = (currentBudget.fundingSources || []).reduce((s, item) => s + Number(item.amount || 0), 0);
    const stdTotalExp = (currentBudget.expenses || []).reduce((s, item) => s + Number(item.totalAmount || 0), 0);
    const stdOthersShare = (currentBudget.expenses || []).reduce((s, item) => s + Number(item.coveredByOthers || 0), 0);
    const stdMyShare = stdTotalExp - stdOthersShare;

    // Determine aggregated Academic totals based on planning mode
    const acadFunding = planningMode === 'semester' ? (fFunding + wFunding) : stdFunding;
    const acadMyShare = planningMode === 'semester' ? (fMyShare + wMyShare) : stdMyShare;
    const acadTotalExp = planningMode === 'semester' ? (fTotalExp + wTotalExp) : stdTotalExp;

    let summFunding = 0;
    let summTotalExp = 0;
    let summMyShare = 0;
    let summSurplus = 0;
    
    if(includeSummer) {
        summFunding = (currentBudget.summerFundingSources || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        summTotalExp = (currentBudget.summerExpenses || []).reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
        const summOthersShare = (currentBudget.summerExpenses || []).reduce((sum, item) => sum + Number(item.coveredByOthers || 0), 0);
        summMyShare = summTotalExp - summOthersShare;
        if (summFunding > summMyShare) {
            summSurplus = summFunding - summMyShare;
        }
    }

    const totalFundingCombined = acadFunding + summFunding;
    const myShareCombined = acadMyShare + summMyShare;
    const deficit = Math.max(0, myShareCombined - totalFundingCombined);

    // Contextual values for current active view tab
    let viewFunding = acadFunding;
    let viewTotalExp = acadTotalExp;
    let viewMyShare = acadMyShare;

    if (activeTerm === 'summer') {
      viewFunding = summFunding;
      viewTotalExp = summTotalExp;
      viewMyShare = summMyShare;
    } else if (activeTerm === 'fall') {
      viewFunding = fFunding;
      viewTotalExp = fTotalExp;
      viewMyShare = fMyShare;
    } else if (activeTerm === 'winter') {
      viewFunding = wFunding;
      viewTotalExp = wTotalExp;
      viewMyShare = wMyShare;
    }

    return {
      totalFunding: viewFunding,
      totalExpensesCost: viewTotalExp,
      myShareExpenses: viewMyShare,
      netStudentDeficit: deficit,
      academicFunding: acadFunding,
      academicExpenses: acadMyShare,
      fallFunding: fFunding,
      fallExpenses: fMyShare,
      winterFunding: wFunding,
      winterExpenses: wMyShare,
      summerFunding: summFunding,
      summerExpensesTotal: summMyShare,
      summerSurplusThisYear: summSurplus
    };
  }, [currentBudget, includeSummer, activeTerm, planningMode]);

  const degreeMultiYearAnalysis = useMemo(() => {
    let currentRespPool = globalRespPool;
    let currentSavingsPool = globalSavingsPool;
    let totalSummerSurplusGenerated = 0;

    const yearlyBreakdowns = Array.from({ length: degreeYearsCount }, (_, idx) => {
      const yearNum = idx + 1;
      const yrBudget = yearlyBudgets[yearNum] || createInitialYearBudget(yearNum);
      const isSemMode = yrBudget.planningMode === 'semester';

      const activeExpensesList = isSemMode 
        ? [...(yrBudget.fallExpenses || []), ...(yrBudget.winterExpenses || [])]
        : (yrBudget.expenses || []);

      const activeFundingList = isSemMode 
        ? [...(yrBudget.fallFundingSources || []), ...(yrBudget.winterFundingSources || [])]
        : (yrBudget.fundingSources || []);

      const tuitionAndAcademic = activeExpensesList
        .filter(e => e.category === 'Academic')
        .reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);

      const livingAndFood = activeExpensesList
        .filter(e => e.category === 'Housing' || e.category === 'Food')
        .reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);

      const lifestyleAndMisc = activeExpensesList
        .filter(e => e.category !== 'Academic' && e.category !== 'Housing' && e.category !== 'Food')
        .reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
      
      let summerCost = 0;
      let summerIncome = 0;
      let summerSurplus = 0;
      let summerRespDraw = 0;
      let summerSavingsDraw = 0;

      if(yrBudget.includeSummer) {
          summerCost = (yrBudget.summerExpenses || []).reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
          summerIncome = (yrBudget.summerFundingSources || []).reduce((sum, f) => sum + Number(f.amount || 0), 0);
          
          if (summerIncome > summerCost) {
            summerSurplus = summerIncome - summerCost;
            totalSummerSurplusGenerated += summerSurplus;
          }

          summerRespDraw = (yrBudget.summerFundingSources || [])
            .filter(f => f.name.toLowerCase().includes('resp'))
            .reduce((sum, f) => sum + Number(f.amount || 0), 0);
            
          summerSavingsDraw = (yrBudget.summerFundingSources || [])
            .filter(f => f.category === 'RESP/Savings' && !f.name.toLowerCase().includes('resp'))
            .reduce((sum, f) => sum + Number(f.amount || 0), 0);
      }

      if (summerSurplus > 0) {
        currentSavingsPool += summerSurplus;
      }

      const respDraw = activeFundingList
        .filter(f => f.name.toLowerCase().includes('resp'))
        .reduce((sum, f) => sum + Number(f.amount || 0), 0) + summerRespDraw;

      const personalSavingsDraw = activeFundingList
        .filter(f => f.category === 'RESP/Savings' && !f.name.toLowerCase().includes('resp'))
        .reduce((sum, f) => sum + Number(f.amount || 0), 0) + summerSavingsDraw;

      const grantsAndScholarships = activeFundingList
        .filter(f => f.category === 'Government Aid' || f.category === 'Scholarships')
        .reduce((sum, f) => sum + Number(f.amount || 0), 0) + (yrBudget.includeSummer ? (yrBudget.summerFundingSources||[]).filter(f => f.category === 'Government Aid' || f.category === 'Scholarships').reduce((sum, f) => sum + Number(f.amount || 0), 0) : 0);

      const employmentIncome = activeFundingList
        .filter(f => f.category === 'Employment')
        .reduce((sum, f) => sum + Number(f.amount || 0), 0) + (yrBudget.includeSummer ? (yrBudget.summerFundingSources||[]).filter(f => f.category === 'Employment').reduce((sum, f) => sum + Number(f.amount || 0), 0) : 0);

      const academicCost = tuitionAndAcademic + livingAndFood + lifestyleAndMisc;
      const netSummerExpense = yrBudget.includeSummer ? Math.max(0, summerCost - summerIncome) : 0;
      const totalCost = academicCost + netSummerExpense;

      const totalEarnedAndAid = grantsAndScholarships + employmentIncome;
      const totalStudentDraw = respDraw + personalSavingsDraw;
      const totalStudentResource = totalEarnedAndAid + totalStudentDraw;
      const parentCoverageNeeded = Math.max(0, totalCost - totalStudentResource);

      const respStart = currentRespPool;
      currentRespPool = Math.max(0, currentRespPool - respDraw);
      const respEnd = currentRespPool;

      const savingsStart = currentSavingsPool;
      currentSavingsPool = Math.max(0, currentSavingsPool - personalSavingsDraw);
      const savingsEnd = currentSavingsPool;

      return {
        yearNum,
        title: `Year ${yearNum}`,
        includeSummer: yrBudget.includeSummer,
        planningMode: yrBudget.planningMode,
        livingSituation: yrBudget.livingSituation,
        tuitionAndAcademic,
        livingAndFood,
        lifestyleAndMisc,
        summerCost,
        summerIncome,
        summerSurplus,
        respDraw,
        personalSavingsDraw,
        grantsAndScholarships,
        employmentIncome,
        totalCost,
        totalEarnedAndAid,
        totalStudentDraw,
        parentCoverageNeeded,
        respStart,
        respEnd,
        savingsStart,
        savingsEnd
      };
    });

    const grandTotalCost = yearlyBreakdowns.reduce((sum, y) => sum + y.totalCost, 0);
    const grandTotalRespDrawn = yearlyBreakdowns.reduce((sum, y) => sum + y.respDraw, 0);
    const grandTotalSavingsDrawn = yearlyBreakdowns.reduce((sum, y) => sum + y.personalSavingsDraw, 0);
    const grandTotalWorkAndAid = yearlyBreakdowns.reduce((sum, y) => sum + y.totalEarnedAndAid, 0);
    const grandTotalParentSupportNeeded = yearlyBreakdowns.reduce((sum, y) => sum + y.parentCoverageNeeded, 0);

    return {
      yearlyBreakdowns,
      grandTotalCost,
      grandTotalRespDrawn,
      grandTotalSavingsDrawn,
      grandTotalWorkAndAid,
      grandTotalParentSupportNeeded,
      totalSummerSurplusGenerated,
      finalRespRemaining: currentRespPool,
      finalSavingsRemaining: currentSavingsPool,
    };
  }, [globalRespPool, globalSavingsPool, yearlyBudgets, degreeYearsCount]);

  const handleParentRatioChange = (id, newRatio) => {
    let clampedVal = Math.min(100, Math.max(0, Number(newRatio)));
    if (isNaN(clampedVal)) clampedVal = 0;
    
    setParents(prev => {
      if (prev.length === 1) {
        return prev.map(p => ({ ...p, ratio: 100 }));
      }
      const pIndex = prev.findIndex(p => p.id === id);
      if (pIndex === -1) return prev;

      const newParents = [...prev];
      newParents[pIndex] = { ...newParents[pIndex], ratio: clampedVal };
      
      const remainingRatio = 100 - clampedVal;
      const otherParents = newParents.filter((_, idx) => idx !== pIndex);
      const currentOtherTotal = otherParents.reduce((sum, p) => sum + p.ratio, 0);
      
      if (currentOtherTotal > 0) {
        otherParents.forEach(p => {
          const pIdx = newParents.findIndex(np => np.id === p.id);
          newParents[pIdx] = {
            ...newParents[pIdx],
            ratio: Math.round((p.ratio / currentOtherTotal) * remainingRatio)
          };
        });
      } else {
        const equalShare = Math.floor(remainingRatio / otherParents.length);
        otherParents.forEach((p, idx) => {
          const pIdx = newParents.findIndex(np => np.id === p.id);
          newParents[pIdx] = {
            ...newParents[pIdx],
            ratio: idx === 0 ? remainingRatio - equalShare * (otherParents.length - 1) : equalShare
          };
        });
      }
      return newParents;
    });
  };

  const getFundingArrayKeyForTerm = (term) => {
    if (term === 'summer') return 'summerFundingSources';
    if (term === 'fall') return 'fallFundingSources';
    if (term === 'winter') return 'winterFundingSources';
    return 'fundingSources';
  };

  const getExpensesArrayKeyForTerm = (term) => {
    if (term === 'summer') return 'summerExpenses';
    if (term === 'fall') return 'fallExpenses';
    if (term === 'winter') return 'winterExpenses';
    return 'expenses';
  };

  const copyExpensesToYear = (targetYear) => {
    const clonedExpenses = expenses.map(e => ({ ...e, id: Date.now() + Math.random().toString() }));
    const targetKey = getExpensesArrayKeyForTerm(activeTerm);
    setYearlyBudgets(prev => ({
      ...prev,
      [targetYear]: {
        ...(prev[targetYear] || createInitialYearBudget(targetYear)),
        [targetKey]: clonedExpenses
      }
    }));
    setShowExpenseCopyMenu(false);
  };

  const addFunding = () => {
    if (!newFunding.name || !newFunding.amount) return;
    const arrayKey = getFundingArrayKeyForTerm(activeTerm);
    updateActiveYearBudget(prev => ({
      ...prev,
      [arrayKey]: [...(prev[arrayKey] || []), { ...newFunding, id: Date.now().toString(), amount: Number(newFunding.amount) }]
    }));
    setNewFunding({ name: '', amount: '', category: 'Employment' });
    setShowAddFunding(false);
  };

  const removeFunding = (id) => {
    const arrayKey = getFundingArrayKeyForTerm(activeTerm);
    updateActiveYearBudget(prev => ({
      ...prev,
      [arrayKey]: (prev[arrayKey]||[]).filter(f => f.id !== id)
    }));
  };

  const updateFundingField = (id, field, value) => {
    const arrayKey = getFundingArrayKeyForTerm(activeTerm);
    updateActiveYearBudget(prev => ({
      ...prev,
      [arrayKey]: (prev[arrayKey]||[]).map(f => {
        if (f.id === id) {
          return { 
            ...f, 
            [field]: field === 'amount' ? (value === '' ? '' : Number(value)) : value 
          };
        }
        return f;
      })
    }));
  };

  const addExpense = () => {
    if (!newExpense.name || !newExpense.totalAmount) return;
    const arrayKey = getExpensesArrayKeyForTerm(activeTerm);
    updateActiveYearBudget(prev => ({
      ...prev,
      [arrayKey]: [...(prev[arrayKey] || []), { 
        ...newExpense, 
        id: Date.now().toString(), 
        totalAmount: Number(newExpense.totalAmount),
        coveredByOthers: Number(newExpense.coveredByOthers || 0)
      }]
    }));
    setNewExpense({ name: '', totalAmount: '', coveredByOthers: '0', category: 'Lifestyle' });
    setShowAddExpense(false);
  };

  const removeExpense = (id) => {
    const arrayKey = getExpensesArrayKeyForTerm(activeTerm);
    updateActiveYearBudget(prev => ({
      ...prev,
      [arrayKey]: (prev[arrayKey]||[]).filter(e => e.id !== id)
    }));
  };

  const updateExpenseField = (id, field, value) => {
    const arrayKey = getExpensesArrayKeyForTerm(activeTerm);
    updateActiveYearBudget(prev => ({
      ...prev,
      [arrayKey]: (prev[arrayKey]||[]).map(e => {
        if (e.id === id) {
          const val = value === '' ? '' : Number(value);
          if (field === 'coveredByOthers') {
            const validCoverage = Math.min(Number(val), e.totalAmount || 0);
            return { ...e, coveredByOthers: validCoverage };
          }
          return { ...e, [field]: val };
        }
        return e;
      })
    }));
  };

  // Formatters
  const formatCAD = (num) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(Number(num) || 0);

  // Copy Summary to Clipboard
  const copyParentReport = () => {
    const isSem = planningMode === 'semester';
    const reportText = `=== ONTARIO TECH UNIVERSITY - FINANCIAL PLANNER REPORT (Year ${selectedYear}) ===
Planning Mode: ${isSem ? 'By Semester (Fall + Winter)' : 'Standard 8-Month Academic'}
Academic Year Expenses: ${formatCAD(academicExpenses)}
Academic Aid & Income: ${formatCAD(academicFunding)}
${isSem ? `• Fall Semester Gap: ${formatCAD(Math.max(0, fallExpenses - fallFunding))}\n• Winter Semester Gap: ${formatCAD(Math.max(0, winterExpenses - winterFunding))}\n` : ''}
${includeSummer ? `Summer Term Expenses: ${formatCAD(summerExpensesTotal)}\nSummer Term Aid/Income: ${formatCAD(summerFunding)}\n` : ''}
----------------------------------------------------
Net Support Needed (Parent Gap): ${formatCAD(netStudentDeficit)}

Parent / Household Contribution Breakdown:
${parents.map(p => {
    const share = netStudentDeficit * (p.ratio / 100);
    return `• ${p.name} (${p.ratio}%):
  - Total Academic Support: ${formatCAD(share)}
  - Fall Semester: ${formatCAD(share / 2)}
  - Winter Semester: ${formatCAD(share / 2)}
  - Monthly (8 installments): ${formatCAD(share / 8)} / mo`;
}).join('\n\n')}
====================================================
Generated via Ontario Tech Student Financial Planner`;

    navigator.clipboard.writeText(reportText);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 3000);
  };
  
  const activeYearsArray = Array.from({ length: degreeYearsCount }, (_, i) => i + 1);

  // Auto-switch away from summer view if summer term is disabled
  React.useEffect(() => {
    if (!currentBudget.includeSummer && activeTerm === 'summer') {
      setActiveTerm(planningMode === 'semester' ? 'fall' : 'academic');
    }
  }, [currentBudget.includeSummer, activeTerm, planningMode]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-24 selection:bg-[#E85513] selection:text-white">
      
      {/* Ontario Tech Brand Header */}
      <header className="bg-[#003C71] text-white shadow-xl sticky top-0 z-40 border-b-4 border-[#E85513]">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex flex-col md:flex-row justify-between items-center gap-3">
          
          <div className="flex items-center gap-3">
            <div className="bg-[#E85513] p-2.5 rounded-xl shadow-md text-white font-black tracking-wider flex items-center justify-center border border-white/20">
              <GraduationCap size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">Ontario Tech</h1>
                <span className="text-[10px] font-bold bg-[#00A3E0] text-slate-950 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  University
                </span>
              </div>
              <p className="text-blue-100 text-xs font-medium">Student Financial Planner & Household Splitter</p>
            </div>
          </div>

          {/* Navigation Bar / Tabs */}
          <nav className="flex items-center bg-[#002855] p-1 rounded-xl border border-blue-900/50 shadow-inner">
            <button
              onClick={() => setActiveTab('student')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                activeTab === 'student'
                  ? 'bg-[#E85513] text-white shadow-md'
                  : 'text-blue-100 hover:text-white hover:bg-white/10'
              }`}
            >
              <User size={15} />
              <span>Student Budget</span>
            </button>

            <button
              onClick={() => setActiveTab('parents')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                activeTab === 'parents'
                  ? 'bg-[#E85513] text-white shadow-md'
                  : 'text-blue-100 hover:text-white hover:bg-white/10'
              }`}
            >
              <Users size={15} />
              <span>Parent Splitter</span>
              {netStudentDeficit > 0 && (
                <span className="bg-[#00A3E0] text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {formatCAD(netStudentDeficit)}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('degree')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                activeTab === 'degree'
                  ? 'bg-[#E85513] text-white shadow-md'
                  : 'text-blue-100 hover:text-white hover:bg-white/10'
              }`}
            >
              <CalendarRange size={15} />
              <span>Degree Planner</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 mt-6">

        {/* STUDENT BUDGET TAB */}
        {activeTab === 'student' && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Unified Year, Granularity Mode & Term Control Toolbar */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="bg-[#003C71] text-white p-2.5 rounded-xl">
                    <CalendarRange size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-[#003C71] uppercase tracking-wider">Academic Year:</span>
                      <span className="bg-[#E85513] text-white text-xs px-2.5 py-0.5 rounded-md font-extrabold">
                        Year {selectedYear}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Customize income & expenses for Year {selectedYear}. Automatically syncs with Degree Planner.</p>
                  </div>
                </div>

                {/* Academic Year Selector Pills */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  {activeYearsArray.map((yrNum) => (
                    <button
                      key={yrNum}
                      onClick={() => { setSelectedYear(yrNum); }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        selectedYear === yrNum
                          ? 'bg-[#003C71] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Year {yrNum}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode Selector & Term View Switchers */}
              <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 pt-1">
                
                {/* Granularity Option: Standard vs By Semester */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                    <Sliders size={14} className="text-[#E85513]" /> Granularity:
                  </span>
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                    <button
                      onClick={() => handleTogglePlanningMode('standard')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-extrabold transition ${
                        planningMode === 'standard'
                          ? 'bg-white text-[#003C71] shadow-sm border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Calendar size={14} />
                      <span>Standard (8 mo) + Summer</span>
                    </button>

                    <button
                      onClick={() => handleTogglePlanningMode('semester')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-extrabold transition ${
                        planningMode === 'semester'
                          ? 'bg-white text-[#E85513] shadow-sm border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Layers size={14} />
                      <span>By Semester (Fall / Winter / Summer)</span>
                    </button>
                  </div>
                </div>

                {/* Term Selector View Buttons */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 items-center overflow-x-auto">
                  {planningMode === 'standard' ? (
                    <>
                      <button
                        onClick={() => setActiveTerm('academic')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                          activeTerm === 'academic'
                            ? 'bg-[#E85513] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Academic (8 mo)
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setActiveTerm('fall')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                          activeTerm === 'fall'
                            ? 'bg-[#003C71] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Fall Semester (4 mo)
                      </button>
                      
                      <button
                        onClick={() => setActiveTerm('winter')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                          activeTerm === 'winter'
                            ? 'bg-[#003C71] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Winter Semester (4 mo)
                      </button>
                    </>
                  )}

                  {/* Summer 4 mo Button */}
                  <button
                    onClick={() => {
                      if (!includeSummer) {
                        toggleSummerTermForYear(selectedYear);
                        setActiveTerm('summer');
                      } else {
                        setActiveTerm('summer');
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                      !includeSummer
                        ? 'bg-slate-200/70 text-slate-400 border border-slate-300/50 hover:bg-slate-200 hover:text-slate-600'
                        : activeTerm === 'summer'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-amber-800 hover:bg-amber-100/60'
                    }`}
                    title={includeSummer ? "Summer Term Enabled" : "Summer Term Disabled (Click to enable)"}
                  >
                    <Sun size={13} className={includeSummer ? "text-amber-700 fill-amber-500" : "text-slate-400"} />
                    <span>Summer (4 mo)</span>
                    
                    {includeSummer ? (
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSummerTermForYear(selectedYear);
                          if (activeTerm === 'summer') setActiveTerm(planningMode === 'semester' ? 'fall' : 'academic');
                        }}
                        className="ml-1 text-[9px] font-black uppercase bg-amber-600/30 hover:bg-rose-500 hover:text-white text-amber-950 px-1.5 py-0.5 rounded transition cursor-pointer"
                        title="Click to disable Summer term"
                      >
                        ON
                      </span>
                    ) : (
                      <span className="text-[9px] font-extrabold uppercase bg-slate-300 text-slate-600 px-1.5 py-0.5 rounded">
                        OFF
                      </span>
                    )}
                  </button>
                </div>

              </div>

            </div>

            {/* Semester Mode Context Summary Banner */}
            {planningMode === 'semester' && (
              <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md flex flex-col md:flex-row justify-between items-center gap-4 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="bg-[#E85513] text-white p-2 rounded-xl">
                    <Layers size={20} />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold uppercase text-[#00A3E0] tracking-wider">Semester-By-Semester Cash Flow</h3>
                    <p className="text-xs text-slate-300">Plan Fall and Winter tuition deadlines & OSAP releases individually.</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-extrabold">
                  <div className="bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                    <span className="text-slate-400 text-[10px] uppercase block font-bold">Fall Net Gap:</span>
                    <span className={fallExpenses > fallFunding ? 'text-rose-400' : 'text-emerald-400'}>
                      {formatCAD(Math.abs(fallFunding - fallExpenses))} {fallExpenses > fallFunding ? 'Shortfall' : 'Surplus'}
                    </span>
                  </div>

                  <div className="bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                    <span className="text-slate-400 text-[10px] uppercase block font-bold">Winter Net Gap:</span>
                    <span className={winterExpenses > winterFunding ? 'text-rose-400' : 'text-emerald-400'}>
                      {formatCAD(Math.abs(winterFunding - winterExpenses))} {winterExpenses > winterFunding ? 'Shortfall' : 'Surplus'}
                    </span>
                  </div>

                  <div className="bg-[#003C71] px-3.5 py-1.5 rounded-xl border border-blue-800">
                    <span className="text-blue-200 text-[10px] uppercase block font-bold">8-mo Academic Net:</span>
                    <span className="text-white font-black">{formatCAD(academicExpenses - academicFunding)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Top Stat Overview Cards */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Card 1: Active Term Net */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                    {activeTerm === 'academic' && '8-Month Academic Net'}
                    {activeTerm === 'fall' && 'Fall Semester Net'}
                    {activeTerm === 'winter' && 'Winter Semester Net'}
                    {activeTerm === 'summer' && 'Summer Term Net'}
                  </p>
                  <BookOpen size={16} className="text-[#003C71]" />
                </div>
                <div className="mt-2">
                  <p className={`text-2xl font-black ${myShareExpenses > totalFunding ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatCAD(Math.abs(totalFunding - myShareExpenses))}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                    {myShareExpenses > totalFunding ? 'Shortfall for this period' : 'Term Surplus'}
                  </p>
                </div>
              </div>

              {/* Card 2: Academic Aid & Income */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider">
                    {activeTerm === 'academic' ? 'Academic Aid & Income' : `${activeTerm.toUpperCase()} Aid & Income`}
                  </p>
                  <Landmark size={16} className="text-emerald-600" />
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-black text-emerald-600">
                    {formatCAD(totalFunding)}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                    Grants, RESP & Employment
                  </p>
                </div>
              </div>

              {/* Card 3: Total Parent Gap Callout */}
              <div className="bg-[#003C71] text-white p-4 rounded-2xl shadow-md border border-blue-900 flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold text-[#00A3E0] uppercase tracking-wider">Remaining Parent Gap</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-2xl font-black text-white">{formatCAD(netStudentDeficit)}</p>
                  </div>
                  <p className="text-[11px] text-blue-100 mt-0.5">
                    {netStudentDeficit > 0 ? "Amount requiring household support" : "Fully covered by student resources!"}
                  </p>
                </div>
                <div className="bg-white/10 p-2.5 rounded-xl text-white">
                  <Users size={26} />
                </div>
              </div>

            </section>

            {/* RESP & Savings Quick Bar */}
            <section className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowSavingsConfig(true)}
                    className="bg-[#003C71] hover:bg-[#002855] text-white p-2.5 rounded-xl transition"
                    title="Configure Savings Accounts"
                  >
                    <Settings size={18} />
                  </button>
                  <div>
                    <h2 className="text-sm font-extrabold text-[#003C71]">RESP & Savings Tracker</h2>
                    <p className="text-xs text-slate-600">Track multi-year savings allocations & RESP draws</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-extrabold">RESP Global Pool</p>
                    <p className="font-extrabold text-[#003C71] text-sm mt-0.5">{formatCAD(globalRespPool)}</p>
                  </div>
                  <span className="text-slate-300 font-bold">-</span>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-extrabold">Year {selectedYear} RESP Draw</p>
                    <p className="font-extrabold text-[#E85513] text-sm mt-0.5">{formatCAD(respWithdrawalThisYear)}</p>
                  </div>
                  <span className="text-slate-300 font-bold">=</span>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-extrabold">Remaining Pool</p>
                    <p className="font-extrabold text-emerald-700 text-sm mt-0.5">
                      {formatCAD(Math.max(0, globalRespPool - respWithdrawalThisYear))}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Budget Tables: Income & Expenses */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Income Table */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 p-3.5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Landmark className="text-emerald-600" size={18} />
                    <h2 className="font-extrabold text-slate-800 text-sm">
                      {activeTerm === 'academic' && `Year ${selectedYear} Academic (8 mo) Income & Aid`}
                      {activeTerm === 'fall' && `Year ${selectedYear} Fall Semester Income & Aid`}
                      {activeTerm === 'winter' && `Year ${selectedYear} Winter Semester Income & Aid`}
                      {activeTerm === 'summer' && `Year ${selectedYear} Summer Term Income & Aid`}
                    </h2>
                  </div>
                  <button 
                    onClick={() => setShowAddFunding(!showAddFunding)} 
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 transition"
                  >
                    <Plus size={14} /> Add Item
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  {showAddFunding && (
                    <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200 space-y-2 mb-3">
                      <input 
                        type="text" 
                        placeholder="Source name (e.g., OSAP Fall Release, RESP Draw)" 
                        className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none" 
                        value={newFunding.name} 
                        onChange={(e) => setNewFunding({...newFunding, name: e.target.value})} 
                      />
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          placeholder="Amount ($)" 
                          className="w-1/2 p-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none" 
                          value={newFunding.amount} 
                          onChange={(e) => setNewFunding({...newFunding, amount: e.target.value})} 
                        />
                        <select 
                          className="w-1/2 p-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none" 
                          value={newFunding.category} 
                          onChange={(e) => setNewFunding({...newFunding, category: e.target.value})}
                        >
                          {incomeCategories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                        </select>
                      </div>
                      <button onClick={addFunding} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded-lg text-xs font-extrabold transition">
                        Save Source
                      </button>
                    </div>
                  )}

                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {fundingSources.length === 0 && (
                      <p className="text-xs text-slate-400 italic text-center py-6">No income items listed for this term.</p>
                    )}
                    {fundingSources.map(source => (
                      <div key={source.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition">
                        <div className="flex-1 pr-2">
                          <input 
                            type="text" 
                            value={source.name} 
                            onChange={(e) => updateFundingField(source.id, 'name', e.target.value)}
                            className="font-bold text-slate-800 bg-transparent text-xs w-full focus:bg-white focus:outline-none rounded px-1"
                          />
                          <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded inline-block mt-1">
                            {source.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 py-1">
                            <span className="text-slate-400 text-xs">$</span>
                            <input 
                              type="number" 
                              value={source.amount}
                              onChange={(e) => updateFundingField(source.id, 'amount', e.target.value)}
                              className="w-20 text-right font-black text-xs text-emerald-600 focus:outline-none"
                            />
                          </div>
                          <button onClick={() => removeFunding(source.id)} className="text-slate-300 hover:text-rose-600 p-1">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Expenses Table */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 p-3.5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Wallet className="text-[#E85513]" size={18} />
                    <h2 className="font-extrabold text-slate-800 text-sm">
                      {activeTerm === 'academic' && `Year ${selectedYear} Academic (8 mo) Expenses`}
                      {activeTerm === 'fall' && `Year ${selectedYear} Fall Semester Expenses`}
                      {activeTerm === 'winter' && `Year ${selectedYear} Winter Semester Expenses`}
                      {activeTerm === 'summer' && `Year ${selectedYear} Summer Term Expenses`}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setShowExpenseCopyMenu(!showExpenseCopyMenu)} 
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-300 flex items-center gap-1 transition"
                    >
                      <Copy size={13} /> Copy To
                    </button>
                    <button 
                      onClick={() => setShowAddExpense(!showAddExpense)} 
                      className="bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 px-3 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 transition"
                    >
                      <Plus size={14} /> Add Item
                    </button>
                  </div>
                </div>

                {/* Copy Expenses Menu */}
                {showExpenseCopyMenu && (
                  <div className="bg-blue-50 border-b border-blue-200 p-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-[#003C71]">Copy this term expense list to:</span>
                    <div className="flex gap-1">
                      {activeYearsArray.filter(y => y !== selectedYear).map(y => (
                        <button 
                          key={y} 
                          onClick={() => copyExpensesToYear(y)} 
                          className="bg-[#003C71] hover:bg-[#002855] text-white px-2.5 py-0.5 rounded text-xs font-extrabold"
                        >
                          Year {y}
                        </button>
                      ))}
                      <button onClick={() => setShowExpenseCopyMenu(false)} className="text-slate-400 hover:text-slate-700 ml-1">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-4 space-y-3">
                  {showAddExpense && (
                    <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200 space-y-2 mb-3">
                      <input 
                        type="text" 
                        placeholder="Expense name (e.g., Fall Tuition, Textbooks, Oshawa Rent)" 
                        className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none" 
                        value={newExpense.name} 
                        onChange={(e) => setNewExpense({...newExpense, name: e.target.value})} 
                      />
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          placeholder="Total ($)" 
                          className="w-1/2 p-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none" 
                          value={newExpense.totalAmount} 
                          onChange={(e) => setNewExpense({...newExpense, totalAmount: e.target.value})} 
                        />
                        <select 
                          className="w-1/2 p-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none" 
                          value={newExpense.category} 
                          onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                        >
                          {expenseCategories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                        </select>
                      </div>
                      <button onClick={addExpense} className="w-full bg-[#E85513] hover:bg-orange-700 text-white py-1.5 rounded-lg text-xs font-extrabold transition">
                        Save Expense
                      </button>
                    </div>
                  )}

                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {expenses.length === 0 && (
                      <p className="text-xs text-slate-400 italic text-center py-6">No expenses listed for this term.</p>
                    )}
                    {expenses.map(expense => (
                      <div key={expense.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition">
                        <div className="flex-1 pr-2">
                          <input 
                            type="text" 
                            value={expense.name} 
                            onChange={(e) => updateExpenseField(expense.id, 'name', e.target.value)}
                            className="font-bold text-slate-800 bg-transparent text-xs w-full focus:bg-white focus:outline-none rounded px-1"
                          />
                          <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded inline-block mt-1">
                            {expense.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 py-1">
                            <span className="text-slate-400 text-xs">$</span>
                            <input 
                              type="number" 
                              value={expense.totalAmount}
                              onChange={(e) => updateExpenseField(expense.id, 'totalAmount', e.target.value)}
                              className="w-20 text-right font-black text-xs text-rose-600 focus:outline-none"
                            />
                          </div>
                          <button onClick={() => removeExpense(expense.id)} className="text-slate-300 hover:text-rose-600 p-1">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

            </div>
          </div>
        )}

        {/* PARENT SPLITTER TAB */}
        {activeTab === 'parents' && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Header Banner */}
            <div className="bg-[#003C71] text-white p-6 rounded-2xl shadow-md border border-blue-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#00A3E0]">Ontario Tech Household Planner</span>
                <h2 className="text-2xl font-black mt-1">Multi-Parent Support Splitter</h2>
                <p className="text-xs text-blue-100 mt-1">Fairly allocate remaining tuition & living costs across parental households.</p>
              </div>

              <div className="bg-white/10 p-4 rounded-xl backdrop-blur-md border border-white/20 text-right">
                <p className="text-[10px] font-extrabold uppercase text-blue-200">Total Net Parent Gap (Year {selectedYear})</p>
                <p className="text-3xl font-black text-white">{formatCAD(netStudentDeficit)}</p>
              </div>
            </div>

            {/* Household Splitters */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Controls */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <Sliders size={18} className="text-[#003C71]" />
                    Household Contribution Ratios
                  </h3>
                  <button 
                    onClick={handleAddParent}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 transition"
                  >
                    <Plus size={14} /> Add Household
                  </button>
                </div>

                <div className="space-y-4">
                  {parents.map((parent) => (
                    <div key={parent.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center gap-2">
                        <input 
                          type="text" 
                          value={parent.name} 
                          onChange={(e) => setParents(prev => prev.map(p => p.id === parent.id ? { ...p, name: e.target.value } : p))} 
                          className="font-extrabold text-slate-800 text-xs bg-transparent border-b border-slate-300 focus:outline-none focus:border-[#003C71] flex-1"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-[#003C71]">{parent.ratio}%</span>
                          {parents.length > 1 && (
                            <button 
                              onClick={() => handleRemoveParent(parent.id)}
                              className="text-slate-300 hover:text-rose-600 p-1 transition"
                              title="Remove Household"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={parent.ratio} 
                        onChange={(e) => handleParentRatioChange(parent.id, e.target.value)} 
                        className="w-full accent-[#E85513] cursor-pointer"
                      />

                      <div className="flex justify-between text-[11px] font-bold text-slate-500 pt-1">
                        <span>Total: {formatCAD(netStudentDeficit * (parent.ratio / 100))}</span>
                        <span>Per Semester: {formatCAD((netStudentDeficit * (parent.ratio / 100)) / 2)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={copyParentReport} 
                  className="w-full bg-[#E85513] hover:bg-orange-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm"
                >
                  {copiedReport ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedReport ? 'Report Copied to Clipboard!' : 'Copy Parent Summary Breakdown'}</span>
                </button>
              </div>

              {/* Monthly & Semester Payment Schedule Preview */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <Calculator size={18} className="text-emerald-600" />
                  Estimated Payment Schedules
                </h3>

                <div className="space-y-3">
                  {parents.map((parent) => {
                    const share = netStudentDeficit * (parent.ratio / 100);
                    return (
                      <div key={parent.id} className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                        <p className="font-extrabold text-slate-800 text-xs">{parent.name}</p>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <p className="text-[9px] text-slate-400 font-bold uppercase">Academic Total</p>
                            <p className="font-black text-[#003C71] mt-0.5">{formatCAD(share)}</p>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <p className="text-[9px] text-slate-400 font-bold uppercase">Per Semester (2x)</p>
                            <p className="font-black text-[#003C71] mt-0.5">{formatCAD(share / 2)}</p>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <p className="text-[9px] text-slate-400 font-bold uppercase">Monthly (8x)</p>
                            <p className="font-black text-emerald-700 mt-0.5">{formatCAD(share / 8)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* DEGREE PLANNER TAB */}
        {activeTab === 'degree' && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Header */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-800">Ontario Tech Multi-Year Degree Planner</h2>
                <p className="text-xs text-slate-500 mt-0.5">Project total costs, RESP depletion, and student aid across your entire program.</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs">
                  <span className="font-bold text-slate-600 px-1">Select / Active Year:</span>
                  {activeYearsArray.map(yrs => (
                    <button 
                      key={yrs} 
                      onClick={() => setSelectedYear(yrs)} 
                      className={`px-2.5 py-1 rounded-lg font-black transition ${selectedYear === yrs ? 'bg-[#003C71] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                      title={`Select Year ${yrs}`}
                    >
                      Year {yrs}
                    </button>
                  ))}
                  
                  {/* Plus Button to Add Additional Degree Year */}
                  <button 
                    onClick={handleAddDegreeYear}
                    className="bg-[#E85513] hover:bg-orange-600 text-white p-1.5 rounded-lg font-extrabold transition flex items-center justify-center shadow-sm ml-1"
                    title="Add Additional Year"
                  >
                    <Plus size={15} />
                  </button>

                  {/* Minus Button to Remove Year */}
                  {degreeYearsCount > 1 && (
                    <button 
                      onClick={handleRemoveDegreeYear}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-1.5 rounded-lg font-extrabold transition flex items-center justify-center"
                      title="Remove Last Year"
                    >
                      <Minus size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Overview Multi-year Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase">Estimated Program Cost</p>
                <p className="text-2xl font-black text-[#003C71] mt-1">{formatCAD(degreeMultiYearAnalysis.grandTotalCost)}</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase">Total Aid & Work Income</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">{formatCAD(degreeMultiYearAnalysis.grandTotalWorkAndAid)}</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase">Total RESP Funds Drawn</p>
                <p className="text-2xl font-black text-[#E85513] mt-1">{formatCAD(degreeMultiYearAnalysis.grandTotalRespDrawn)}</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase">Total Parent Gap Needed</p>
                <p className="text-2xl font-black text-rose-600 mt-1">{formatCAD(degreeMultiYearAnalysis.grandTotalParentSupportNeeded)}</p>
              </div>
            </div>

            {/* Yearly Breakdown Cards */}
            <div className="space-y-4">
              {degreeMultiYearAnalysis.yearlyBreakdowns.map((yr) => {
                const isSelected = selectedYear === yr.yearNum;
                return (
                  <div 
                    key={yr.yearNum} 
                    onClick={() => setSelectedYear(yr.yearNum)}
                    className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 ${
                      isSelected 
                        ? 'border-[#003C71] ring-2 ring-[#003C71]/20 shadow-md' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`text-white text-lg font-black w-12 h-12 rounded-2xl flex items-center justify-center ${isSelected ? 'bg-[#E85513]' : 'bg-[#003C71]'}`}>
                        Y{yr.yearNum}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-slate-800 text-sm">Year {yr.yearNum} Overview</h3>
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                            {yr.planningMode === 'semester' ? 'By Semester' : 'Standard 8 mo'}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] font-bold bg-blue-100 text-[#003C71] px-2 py-0.5 rounded-full">
                              Active Selection
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Academic Cost: {formatCAD(yr.tuitionAndAcademic + yr.livingAndFood + yr.lifestyleAndMisc)}
                          {yr.includeSummer && ` • Summer Cost: ${formatCAD(yr.summerCost)}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-xs text-right">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Student Aid & Work</p>
                        <p className="font-extrabold text-emerald-600 mt-0.5">{formatCAD(yr.totalEarnedAndAid)}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">RESP Drawn</p>
                        <p className="font-extrabold text-[#E85513] mt-0.5">{formatCAD(yr.respDraw)}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Parent Support</p>
                        <p className="font-black text-[#003C71] text-sm mt-0.5">{formatCAD(yr.parentCoverageNeeded)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

      </main>

      {/* SAVINGS & RESP MODAL */}
      {showSavingsConfig && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-extrabold text-slate-800 text-base">Configure RESP & Savings Accounts</h3>
              <button onClick={() => setShowSavingsConfig(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {savingsSources.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex-1 pr-2">
                    <input 
                      type="text" 
                      value={s.name} 
                      onChange={(e) => handleUpdateSavingsSource(s.id, 'name', e.target.value)} 
                      className="font-bold text-xs bg-transparent w-full focus:outline-none"
                    />
                    <span className="text-[9px] font-extrabold text-[#003C71] uppercase bg-blue-100 px-1.5 py-0.5 rounded">
                      {s.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={s.amount} 
                      onChange={(e) => handleUpdateSavingsSource(s.id, 'amount', e.target.value)} 
                      className="w-24 text-right font-black text-xs p-1 border rounded"
                    />
                    <button onClick={() => handleRemoveSavingsSource(s.id)} className="text-slate-300 hover:text-rose-600 p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <p className="text-xs font-bold text-slate-700">Add Savings Account</p>
              <input 
                type="text" 
                placeholder="Account Name (e.g., RBC RESP, High-Interest Savings)" 
                className="w-full p-2 text-xs border rounded bg-white" 
                value={newSavingsSource.name} 
                onChange={(e) => setNewSavingsSource({...newSavingsSource, name: e.target.value})}
              />
              <div className="flex gap-2">
                <input 
                  type="number" 
                  placeholder="Starting Balance ($)" 
                  className="w-1/2 p-2 text-xs border rounded bg-white" 
                  value={newSavingsSource.amount} 
                  onChange={(e) => setNewSavingsSource({...newSavingsSource, amount: e.target.value})}
                />
                <select 
                  className="w-1/2 p-2 text-xs border rounded bg-white" 
                  value={newSavingsSource.type} 
                  onChange={(e) => setNewSavingsSource({...newSavingsSource, type: e.target.value})}
                >
                  <option value="RESP">RESP Account</option>
                  <option value="Savings">Personal Savings</option>
                </select>
              </div>
              <button onClick={handleAddSavingsSource} className="w-full bg-[#003C71] hover:bg-[#002855] text-white text-xs font-bold py-2 rounded-lg transition">
                Add Account
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}