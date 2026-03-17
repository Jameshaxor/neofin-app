import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  LayoutDashboard, Receipt, Activity, Target, 
  Sparkles, Moon, Sun, Plus, Search, Download, 
  Trash2, AlertCircle, ArrowUpRight, ArrowDownRight, 
  Wallet, Send, Bot, User, CheckCircle,
  TrendingUp, Compass, Calendar, ChevronDown, Loader2, LogOut,
  Bell, Filter, ChevronRight, X, RefreshCw
} from 'lucide-react';

import WelcomeScreen from './components/WelcomeScreen';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, onSnapshot, deleteDoc, getDoc } from "firebase/firestore";

// --- FIREBASE INITIALIZATION ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'neofin-prod'; 

const INITIAL_BUDGETS = { Housing: 9000, Food: 3500, Transport: 2000, Investing: 3000, Education: 1500, Entertainment: 1500 };
const INITIAL_GOALS = [
  { id: 'g1', name: 'Emergency Fund', target: 50000, current: 15000, color: '#10b981' },
  { id: 'g2', name: 'Goa Trip', target: 15000, current: 4000, color: '#f59e0b' }
];
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6', '#f43f5e'];

// --- UTILITY FUNCTIONS ---
const formatCurrency = (amount) => {
  if (typeof amount !== 'number') return '₹0';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

const getMonthYearString = (dateObj) => {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
};

// FIXED CATEGORIZATION LOGIC
const autoCategorize = (description) => {
  const desc = (description || '').toLowerCase();
  if (desc.match(/zerodha|groww|upstox|angelone|indmoney|sip|mutual fund|stock/)) return 'Investing';
  if (desc.match(/course|udemy|coursera|books|fees|college|tuition/)) return 'Education';
  if (desc.match(/uber|ola|rapido|metro|irctc|redbus|bus|train|petrol|fuel/)) return 'Transport';
  if (desc.match(/cafe|mess|food|grocery|restaurant|swiggy|zomato|zepto|blinkit/)) return 'Food';
  if (desc.match(/netflix|spotify|movie|bookmyshow|hotstar|hostar|prime|jiocinema|jiohotstar|subscription/)) return 'Entertainment';
  if (desc.match(/amazon|flipkart|myntra|ajio|cloth|shoe/)) return 'Shopping';
  // Removed "recharge" from Housing so it correctly falls to 'Other' or user can manually set it.
  if (desc.match(/rent|hostel|pg|room|maintenance|electric|wifi|broadband|jio fiber/)) return 'Housing';
  return 'Other';
};

const formatToDateBlock = (dateString) => {
  try {
    const d = new Date(dateString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-IN', { month: 'short' });
    return { day, month };
  } catch (e) {
    return { day: '00', month: '---' };
  }
};

// --- ANIMATED NUMBER COMPONENT ---
const AnimatedNumber = ({ value }) => {
  const [currentValue, setCurrentValue] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    const duration = 1200; 
    const startValue = 0;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      
      setCurrentValue(startValue + (value - startValue) * easeProgress);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCurrentValue(value);
      }
    };

    window.requestAnimationFrame(step);
  }, [value]);

  return <>{currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</>;
};

// --- GROQ API INTEGRATION ---
const callGeminiAPI = async (prompt, systemInstruction) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY; 
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", 
        messages: [{ role: "system", content: systemInstruction }, { role: "user", content: prompt }],
        temperature: 0.7
      })
    });
    const data = await response.json();
    if (data.error) return `AI Error: ${data.error.message}`;
    return data.choices[0].message.content;
  } catch (error) { return "The AI Advisor is currently offline. Check your connection!"; }
};

// ==========================================
// MAIN APPLICATION COMPONENT
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState(null); 
  const [isInitializingAccount, setIsInitializingAccount] = useState(false);

  const [activeTab, setActiveTab] = useState('home');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('neofin-theme') !== 'light');
  
  useEffect(() => {
    if (darkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('neofin-theme', 'dark'); } 
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('neofin-theme', 'light'); }
  }, [darkMode]);

  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [goals, setGoals] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(getMonthYearString(new Date()));

  // AUTH LISTENER
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); setAuthLoading(false); });
    return () => unsubscribe();
  }, []);

  // DATA FETCHING
  useEffect(() => {
    if (!user) return;
    const baseRef = `artifacts/${appId}/users/${user.uid}`;
    const unsubProfile = onSnapshot(doc(db, baseRef, 'profile', 'data'), (docSnap) => {
      if (docSnap.exists()) setProfile(docSnap.data()); else setProfile(false); 
    });
    const unsubTx = onSnapshot(collection(db, baseRef, 'transactions'), (snapshot) => {
      setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubBudgets = onSnapshot(doc(db, baseRef, 'budgets', 'data'), (docSnap) => {
      if (docSnap.exists()) setBudgets(docSnap.data());
    });
    const unsubGoals = onSnapshot(collection(db, baseRef, 'goals'), (snapshot) => {
      setGoals(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubProfile(); unsubTx(); unsubBudgets(); unsubGoals(); };
  }, [user]);

  const availableMonths = useMemo(() => {
    const months = new Set();
    transactions.forEach(t => { if(t.date) months.add(t.date.substring(0, 7)); });
    months.add(getMonthYearString(new Date())); 
    return Array.from(months).sort((a, b) => b.localeCompare(a)); 
  }, [transactions]);

  const analytics = useMemo(() => {
    let totalIncome = 0; let totalExpense = 0; let totalInvested = 0;
    const categoryTotals = {}; const monthlyDataMap = {}; const currentMonthExpenses = {};

    const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedTx.forEach(t => {
      if (!t.date || !t.amount) return;
      const tMonthKey = t.date.substring(0, 7); 
      const tDateObj = new Date(t.date);
      const monthLabel = tDateObj.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

      if (!monthlyDataMap[tMonthKey]) monthlyDataMap[tMonthKey] = { name: monthLabel, Income: 0, Expense: 0, key: tMonthKey };
      
      if (t.type === 'income') monthlyDataMap[tMonthKey].Income += t.amount;
      else monthlyDataMap[tMonthKey].Expense += t.amount;

      if (selectedMonth === 'all' || selectedMonth === tMonthKey) {
        if (t.type === 'income') totalIncome += t.amount;
        else {
          totalExpense += t.amount;
          currentMonthExpenses[t.category] = (currentMonthExpenses[t.category] || 0) + t.amount;
          categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
          
          if (t.category === 'Investing') totalInvested += t.amount;
        }
      }
    });

    const balance = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
    const pieData = Object.keys(categoryTotals).map(key => ({ name: key, value: categoryTotals[key] })).sort((a, b) => b.value - a.value);

    return { totalIncome, totalExpense, totalInvested, balance, savingsRate, pieData, monthlyTrendData: Object.values(monthlyDataMap), currentMonthExpenses };
  }, [transactions, selectedMonth]);

  const handleCreateProfile = async (name) => {
    if (!name.trim()) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setIsInitializingAccount(true);
    const baseRef = `artifacts/${appId}/users/${currentUser.uid}`;
    try {
      const profileSnap = await getDoc(doc(db, baseRef, 'profile', 'data'));
      if (!profileSnap.exists()) {
        await setDoc(doc(db, baseRef, 'profile', 'data'), { name: name.trim(), joinedAt: new Date().toISOString() });
        await setDoc(doc(db, baseRef, 'budgets', 'data'), INITIAL_BUDGETS);
        for (const g of INITIAL_GOALS) { await setDoc(doc(db, baseRef, 'goals', g.id), g); }
      }
    } catch (e) { console.error("Failed to setup profile:", e); } 
    finally { setIsInitializingAccount(false); }
  };

  const handleLogout = () => { if(window.confirm('Sign out of NeoFin?')) signOut(auth); };

  if (authLoading || (user && profile === null && !isInitializingAccount)) {
    return <div className="min-h-screen bg-gray-50 dark:bg-[#02040A] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!user || profile === false || isInitializingAccount) {
    const handleGoogleLogin = async () => {
      try {
        setIsInitializingAccount(true);
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const firstName = (result.user.displayName || "there").split(' ')[0];
        handleCreateProfile(firstName);
      } catch (error) { setIsInitializingAccount(false); }
    };
    return <WelcomeScreen onLogin={handleGoogleLogin} />;
  }

  const navItems = [
    { id: 'home', icon: LayoutDashboard, label: 'Home' },
    { id: 'tx', icon: Receipt, label: 'Ledger' },
    { id: 'budgets', icon: Activity, label: 'Budgets' },
    { id: 'goals', icon: Target, label: 'Goals' },
    { id: 'ai', icon: Compass, label: 'Advisor' },
  ];

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-[#02040A] text-gray-900 dark:text-white font-sans selection:bg-blue-500/30 overflow-x-hidden pb-32 text-[15px] transition-colors duration-500 ease-out ${darkMode ? 'dark' : ''}`}>
      <div className="fixed inset-0 opacity-[0.02] dark:opacity-[0.02] opacity-[0.04] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-0"></div>
      
      <div className="relative z-10 max-w-xl mx-auto px-5 pt-8">
        
        {/* HEADER */}
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl font-bold tracking-tight italic text-gray-900 dark:text-white">NeoFin</span>
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-2 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setDarkMode(!darkMode)} className="relative w-11 h-11 rounded-2xl bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] flex items-center justify-center transition-all duration-300 ease-out hover:scale-105 active:scale-95 shadow-sm dark:shadow-none">
               {darkMode ? <Sun className="w-5 h-5 text-gray-400" /> : <Moon className="w-5 h-5 text-gray-600" />}
            </button>
            <button onClick={handleLogout} className="relative w-11 h-11 rounded-2xl bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] flex items-center justify-center transition-all duration-300 ease-out hover:scale-105 active:scale-95 shadow-sm dark:shadow-none">
               <LogOut className="w-5 h-5 text-gray-600 dark:text-gray-400 hover:text-rose-500 dark:hover:text-rose-500 transition-colors" />
            </button>
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 p-[1px]">
              <div className="w-full h-full rounded-2xl bg-white dark:bg-[#0D0D0D] overflow-hidden flex items-center justify-center shadow-sm dark:shadow-none">
                 {user?.photoURL ? (
                   <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
                 ) : (
                   <span className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-br from-blue-400 to-indigo-600">
                     {profile?.name?.charAt(0).toUpperCase() || 'U'}
                   </span>
                 )}
              </div>
            </div>
          </div>
        </header>

        {/* MONTH SELECTOR */}
        <div className="flex justify-end mb-6">
          <div className="bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] rounded-xl px-3 py-1.5 flex items-center shadow-sm dark:shadow-none transition-all duration-300 ease-out hover:border-gray-300 dark:hover:border-white/10">
             <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-2" />
             <select 
               value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
               className="bg-transparent text-[11px] font-bold text-gray-900 dark:text-white uppercase tracking-widest outline-none appearance-none pr-4 cursor-pointer"
             >
               <option value="all" className="bg-white dark:bg-[#0D0D0D] text-gray-900 dark:text-white">ALL TIME</option>
               {availableMonths.map(m => (
                 <option key={m} value={m} className="bg-white dark:bg-[#0D0D0D] text-gray-900 dark:text-white">{m}</option>
               ))}
             </select>
          </div>
        </div>

        {/* DYNAMIC VIEWS */}
        <div key={activeTab} className="animate-page-enter">
          {activeTab === 'home' && <DashboardView analytics={analytics} transactions={transactions} selectedMonth={selectedMonth} setActiveTab={setActiveTab} />}
          {activeTab === 'tx' && <TransactionsView transactions={transactions} selectedMonth={selectedMonth} db={db} user={user} appId={appId} />}
          {activeTab === 'budgets' && <BudgetsView budgets={budgets} currentExpenses={analytics.currentMonthExpenses} db={db} user={user} appId={appId} />}
          {activeTab === 'goals' && <GoalsView goals={goals} db={db} user={user} appId={appId} />}
          {activeTab === 'ai' && <AIAssistantView transactions={transactions} analytics={analytics} profile={profile} />}
        </div>

      </div>

      {/* COMMANDER DOCK */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-md z-50">
        <div className="bg-white/90 dark:bg-[#0D0D0D]/95 backdrop-blur-3xl border border-gray-200 dark:border-white/[0.05] rounded-[2.5rem] p-1.5 flex items-center justify-between shadow-2xl dark:shadow-black relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gray-300 dark:via-white/10 to-transparent"></div>
          {navItems.map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)} 
              className={`flex flex-col items-center justify-center flex-1 py-3 rounded-3xl transition-all duration-500 ease-out ${activeTab === item.id ? 'text-blue-600 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-500 ease-out mb-1 ${activeTab === item.id ? 'bg-blue-50 dark:bg-blue-600/10 shadow-sm dark:shadow-[0_0_20px_rgba(37,99,235,0.2)] scale-110' : 'scale-100'}`}>
                <item.icon className={`w-5 h-5 transition-all duration-500 ease-out ${activeTab === item.id ? 'stroke-[2.5px] text-blue-600 dark:text-blue-500' : 'stroke-[1.5px]'}`} />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-widest transition-all duration-500 ease-out ${activeTab === item.id ? 'opacity-100 transform-none' : 'opacity-80 translate-y-0.5'}`}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pageEnter { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .animate-page-enter { animation: pageEnter 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .stagger-1 { animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.1s; opacity: 0; }
        .stagger-2 { animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.2s; opacity: 0; }
        .stagger-3 { animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.3s; opacity: 0; }
        .stagger-4 { animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.4s; opacity: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1A1A1A; border-radius: 4px; }
        .recharts-tooltip-wrapper { outline: none !important; transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1) !important; }
      `}} />
    </div>
  );
}

// ==========================================
// DASHBOARD VIEW (SMARTER AI LOGIC)
// ==========================================
function DashboardView({ analytics, transactions, selectedMonth, setActiveTab }) {
  const filteredTx = selectedMonth === 'all' ? transactions : transactions.filter(t => t.date && t.date.substring(0, 7) === selectedMonth);
  const recentTransactions = filteredTx.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);
  
  const [aiAlert, setAiAlert] = useState(() => sessionStorage.getItem('neofin-live-insight') || "Ready to analyze your financial velocity.");
  const [isGeneratingAlert, setIsGeneratingAlert] = useState(false);

  const generateSmartInsight = async (e) => {
    if (e) e.stopPropagation(); 
    setIsGeneratingAlert(true);
    
    if (transactions.length === 0) {
      setAiAlert("Your ledger is clean. Log transactions to activate the intelligence engine.");
      setIsGeneratingAlert(false);
      return;
    }

    const spendData = Object.entries(analytics.currentMonthExpenses)
      .map(([cat, amt]) => `${cat}: ₹${amt}`).join(', ');
    
    // NEW, SMARTER PROMPT
    const prompt = `Analyze this user's finances for the current view:
    Income: ₹${analytics.totalIncome}
    Expenses: ₹${analytics.totalExpense}
    Savings Rate: ${analytics.savingsRate.toFixed(1)}%
    Spends Breakdown: ${spendData}

    RULES FOR YOUR ADVICE:
    1. Be mathematically logical. Do NOT tell the user to cut an expense if it represents a tiny percentage of their income. 
    2. If their savings rate is high (e.g., over 40%), praise their high liquidity and suggest aggressive investing or allocating to targets.
    3. If their savings rate is negative or low, gently point out their largest expense category to monitor.
    4. Keep it exactly ONE short, punchy sentence (under 15 words).
    5. Tone: Sophisticated, highly analytical, and encouraging wealth advisor. No panic, no aggressive jargon.`;

    try {
      const response = await callGeminiAPI(prompt, "You are an elite, highly logical financial AI. Focus on proportions and actual impact.");
      const cleanResponse = response.replace(/^["']|["']$/g, '').trim();
      setAiAlert(cleanResponse);
      sessionStorage.setItem('neofin-live-insight', cleanResponse);
    } catch (error) {
      setAiAlert("Financial velocity is stable. Keep tracking.");
    } finally {
      setIsGeneratingAlert(false);
    }
  };

  return (
    <div>
      <div className="mb-10 text-center stagger-1">
        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.4em] mb-4">Available Liquidity</p>
        <div className="flex items-center justify-center">
          <span className="text-2xl font-medium text-gray-400 mr-3 mt-1">₹</span>
          <h2 className="text-6xl md:text-7xl font-black tracking-tighter text-gray-900 dark:text-white">
             <AnimatedNumber value={analytics.balance} />
          </h2>
        </div>
        <div className="flex justify-center gap-2 mt-8">
          <div className="px-5 py-2.5 rounded-full bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] flex items-center gap-2.5 shadow-sm transition-all duration-300 ease-out hover:shadow-md">
            <ArrowDownRight className={`w-3.5 h-3.5 ${analytics.savingsRate >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
            <span className={`text-xs font-bold ${analytics.savingsRate >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{analytics.savingsRate.toFixed(1)}%</span>
          </div>
          <div className="px-5 py-2.5 rounded-full bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] flex items-center gap-2 shadow-sm transition-all duration-300 ease-out hover:shadow-md">
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Savings Rate</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 stagger-2">
        <div className="bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] rounded-[2rem] p-6 shadow-sm transition-all duration-300 ease-out hover:border-gray-300 dark:hover:border-white/10 group cursor-default">
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Total Inflow</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white transition-transform duration-300 ease-out group-hover:scale-105 origin-left">
            ₹<AnimatedNumber value={analytics.totalIncome} />
          </p>
        </div>
        <div className="bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] rounded-[2rem] p-6 shadow-sm transition-all duration-300 ease-out hover:border-gray-300 dark:hover:border-white/10 group cursor-default">
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Total Spends</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-500 transition-transform duration-300 ease-out group-hover:scale-105 origin-left">
            ₹<AnimatedNumber value={analytics.totalExpense} />
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] rounded-[2rem] p-6 shadow-sm transition-all duration-300 ease-out hover:border-gray-300 dark:hover:border-white/10 group cursor-default mb-8 stagger-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-500/10 rounded-2xl transition-transform duration-300 ease-out group-hover:scale-110">
             <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400 stroke-[2.5px]" />
          </div>
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Total Invested</p>
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white transition-transform duration-300 ease-out group-hover:scale-105 origin-right">
          ₹<AnimatedNumber value={analytics.totalInvested || 0} />
        </p>
      </div>

      <div className="bg-blue-600 rounded-[2.5rem] p-7 mb-8 text-white relative overflow-hidden group shadow-xl dark:shadow-2xl dark:shadow-blue-900/20 stagger-3">
        <div className="absolute right-[-5%] top-[-10%] w-40 h-40 bg-white/10 rounded-full blur-3xl transition-transform duration-700 ease-out group-hover:scale-150 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col justify-center min-h-[80px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Sparkles className={`w-4 h-4 text-white ${isGeneratingAlert ? 'animate-pulse' : ''}`} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Live AI Strategy</span>
            </div>
            <button 
              onClick={generateSmartInsight}
              disabled={isGeneratingAlert}
              className="p-2 bg-white/10 rounded-xl hover:bg-white/20 active:scale-95 transition-all duration-300 disabled:opacity-50"
            >
               <RefreshCw className={`w-3.5 h-3.5 text-white ${isGeneratingAlert ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-lg font-bold leading-[1.3] mb-2 tracking-tight transition-opacity duration-300">
            "{aiAlert}"
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] rounded-[2.5rem] p-7 mb-8 shadow-sm group transition-all duration-300 ease-out hover:border-gray-300 dark:hover:border-white/10 stagger-3">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-900 dark:text-white">Cash Flow</h3>
          <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/[0.03] px-2.5 py-1 rounded-lg border border-gray-200 dark:border-white/5 uppercase tracking-widest">History</span>
        </div>
        <div className="h-48 w-full cursor-crosshair">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analytics.monthlyTrendData}>
              <XAxis dataKey="name" hide={true} />
              <YAxis hide={true} />
              <Tooltip cursor={false} content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/10 p-3 rounded-2xl shadow-xl dark:shadow-2xl">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">{label}</p>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-emerald-500 dark:text-emerald-400">Income: ₹{payload[0]?.value}</p>
                          <p className="text-xs font-bold text-rose-500 dark:text-rose-400">Expense: ₹{payload[1]?.value}</p>
                        </div>
                      </div>
                    );
                  } return null;
                }}
              />
              <Line type="monotone" name="Income" dataKey="Income" stroke="#10b981" strokeWidth={4} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }} animationDuration={1500} />
              <Line type="monotone" name="Expense" dataKey="Expense" stroke="#ef4444" strokeWidth={4} dot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0, fill: '#ef4444' }} animationDuration={1500} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-6">
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Income</span></div>
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500"></div><span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Expense</span></div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] rounded-[2.5rem] p-7 mb-8 shadow-sm overflow-hidden transition-all duration-300 ease-out hover:border-gray-300 dark:hover:border-white/10 stagger-4">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-900 dark:text-white mb-2">Spends Breakdown</h3>
        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-6">Current Cycle</p>
        
        <div className="flex flex-col items-center">
          <div className="relative h-56 w-full flex items-center justify-center mb-8 group cursor-pointer">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={analytics.pieData} innerRadius={70} outerRadius={90} paddingAngle={8} dataKey="value" stroke="none" animationDuration={1200}>
                  {analytics.pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} className="hover:opacity-80 outline-none transition-opacity duration-300 ease-out" />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-transform duration-500 ease-out group-hover:scale-110">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Total Spends</span>
              <span className="text-3xl font-black text-gray-900 dark:text-white">₹{analytics.totalExpense}</span>
            </div>
          </div>
          
          <div className="w-full grid grid-cols-2 gap-y-5 gap-x-8 px-2">
            {analytics.pieData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 group cursor-default">
                <div className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}></div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-900 dark:text-white tracking-wide transition-colors duration-300 ease-out group-hover:text-blue-500">{item.name}</span>
                  <span className="text-sm font-bold text-gray-600 dark:text-gray-300 mt-0.5">₹{item.value}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      <div className="flex items-center justify-between mb-4 px-2 stagger-4">
        <h3 className="text-xs font-black uppercase tracking-[0.4em] text-gray-500 dark:text-gray-400">Journal</h3>
        <div className="flex gap-2">
           <button onClick={() => setActiveTab('tx')} className="p-2.5 rounded-xl bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-white transition-all duration-300 ease-out active:scale-95 shadow-sm dark:shadow-none">
              <Search className="w-4 h-4" />
           </button>
           <button onClick={() => setActiveTab('tx')} className="p-2.5 rounded-xl bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-white transition-all duration-300 ease-out active:scale-95 shadow-sm dark:shadow-none">
              <Filter className="w-4 h-4" />
           </button>
        </div>
      </div>
      <div className="space-y-3 stagger-4">
        {recentTransactions.map((tx) => {
          const { day, month } = formatToDateBlock(tx.date);
          return (
            <div key={tx.id} className="flex items-center justify-between p-5 bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.03] rounded-3xl group transition-all duration-300 ease-out hover:border-gray-300 dark:hover:border-white/10 hover:translate-x-1 cursor-pointer shadow-sm dark:shadow-none">
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center justify-center bg-gray-50 dark:bg-[#151515] w-12 h-12 rounded-2xl border border-gray-100 dark:border-white/5 shrink-0 shadow-inner transition-colors duration-300 ease-out group-hover:bg-gray-100 dark:group-hover:bg-white/[0.03]">
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase leading-none mb-1">{month}</span>
                  <span className="text-sm font-black text-gray-900 dark:text-white leading-none">{day}</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide line-clamp-1 transition-colors duration-300 ease-out group-hover:text-blue-600 dark:group-hover:text-blue-400">{tx.description}</h4>
                  <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mt-1 tracking-widest leading-none">{tx.category}</p>
                </div>
              </div>
              <span className={`text-sm font-black whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-500' : 'text-gray-900 dark:text-white'}`}>
                {tx.type === 'income' ? '+' : '-'}₹{tx.amount}
              </span>
            </div>
          );
        })}
        {recentTransactions.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 text-sm py-4">No data to display.</p>}
      </div>
    </div>
  );
}

// ==========================================
// TRANSACTIONS VIEW (LEDGER)
// ==========================================
function TransactionsView({ transactions, selectedMonth, db, user, appId }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  const [formData, setFormData] = useState({ type: 'expense', amount: '', date: new Date().toISOString().split('T')[0], description: '', category: 'Other' });

  const filteredData = selectedMonth === 'all' ? transactions : transactions.filter(t => t.date && t.date.substring(0, 7) === selectedMonth);
  const categories = ['All', ...new Set(filteredData.map(t => t.category))];

  const displayData = filteredData.filter(t => {
    const matchesSearch = (t.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = filterCategory === 'All' || t.category === filterCategory;
    return matchesSearch && matchesCat;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!user || !formData.amount || !formData.description) return;
    let finalCategory = formData.category;
    if (finalCategory === 'Other') {
      if (formData.type === 'income') finalCategory = 'Income';
      else finalCategory = autoCategorize(formData.description);
    }
    const newId = Date.now().toString();
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', newId), { 
        id: newId, ...formData, amount: parseFloat(formData.amount), category: finalCategory 
      });
      setShowAddForm(false); 
      setFormData({ type: 'expense', amount: '', date: new Date().toISOString().split('T')[0], description: '', category: 'Other' });
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    if(!user || !window.confirm("Delete entry?")) return;
    try { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id)); } catch(e) {}
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 px-2 stagger-1">
        <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Ledger</h2>
        <div className="flex gap-2">
          <button onClick={() => setIsSearching(!isSearching)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ease-out active:scale-95 ${isSearching ? 'bg-blue-600 text-white' : 'bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-white shadow-sm dark:shadow-none'}`}>
            <Search className="w-4 h-4" />
          </button>
          <button onClick={() => setShowAddForm(!showAddForm)} className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center transition-all duration-300 ease-out hover:scale-105 active:scale-95 shadow-md shadow-blue-500/20">
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {isSearching && (
        <div className="flex gap-2 mb-6 px-2 animate-fade-in">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search entries..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-3 bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] rounded-xl outline-none text-sm text-gray-900 dark:text-white shadow-sm dark:shadow-none transition-all duration-300 ease-out focus:border-blue-500" />
          </div>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-4 py-3 bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] rounded-xl outline-none text-sm text-gray-900 dark:text-white shadow-sm dark:shadow-none cursor-pointer transition-all duration-300 ease-out focus:border-blue-500">
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {showAddForm && (
        <div className="bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] p-6 rounded-[2rem] shadow-xl dark:shadow-2xl mb-8 animate-fade-in">
          <div className="flex justify-between items-center mb-6">
             <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">New Entry</h3>
             <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-rose-500 transition-colors duration-300 ease-out"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleAddTransaction} className="space-y-4">
            <div className="flex gap-4">
               <div className="flex-1 space-y-1.5"><label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Type</label>
                 <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full px-4 py-3 bg-gray-50 dark:bg-[#151515] border border-gray-200 dark:border-white/[0.05] rounded-xl outline-none text-sm text-gray-900 dark:text-white transition-all duration-300 ease-out focus:border-blue-500">
                   <option value="expense">Expense</option><option value="income">Income</option>
                 </select>
               </div>
               <div className="flex-1 space-y-1.5"><label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Amount</label>
                 <input type="number" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0" className="w-full px-4 py-3 bg-gray-50 dark:bg-[#151515] border border-gray-200 dark:border-white/[0.05] rounded-xl outline-none text-sm text-gray-900 dark:text-white transition-all duration-300 ease-out focus:border-blue-500" />
               </div>
            </div>
            <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Description</label>
              <input type="text" required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="e.g., Rent, Coffee" className="w-full px-4 py-3 bg-gray-50 dark:bg-[#151515] border border-gray-200 dark:border-white/[0.05] rounded-xl outline-none text-sm text-gray-900 dark:text-white transition-all duration-300 ease-out focus:border-blue-500" />
            </div>
            <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Date</label>
              <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-3 bg-gray-50 dark:bg-[#151515] border border-gray-200 dark:border-white/[0.05] rounded-xl outline-none text-sm text-gray-900 dark:text-white dark:[color-scheme:dark] transition-all duration-300 ease-out focus:border-blue-500" />
            </div>
            <div className="pt-2">
               <button type="submit" className="w-full py-3.5 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 ease-out hover:bg-blue-700 active:scale-95 shadow-md shadow-blue-500/20">Save Transaction</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3 stagger-2">
        {displayData.map(tx => {
          const { day, month } = formatToDateBlock(tx.date);
          return (
            <div key={tx.id} className="flex items-center justify-between p-5 bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.03] rounded-3xl group transition-all duration-300 ease-out hover:border-gray-300 dark:hover:border-white/10 hover:translate-x-1 cursor-pointer shadow-sm dark:shadow-none">
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center justify-center bg-gray-50 dark:bg-[#151515] w-12 h-12 rounded-2xl border border-gray-100 dark:border-white/5 shrink-0 transition-colors duration-300 ease-out group-hover:bg-gray-100 dark:group-hover:bg-white/[0.03] shadow-inner">
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase leading-none mb-1">{month}</span>
                  <span className="text-sm font-black text-gray-900 dark:text-white leading-none">{day}</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide transition-colors duration-300 ease-out group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-1">{tx.description}</h4>
                  <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mt-1 tracking-widest leading-none">{tx.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-black whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-500' : 'text-gray-900 dark:text-white'}`}>
                  {tx.type === 'income' ? '+' : '-'}₹{tx.amount}
                </span>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(tx.id); }} className="text-gray-400 dark:text-gray-400 hover:text-rose-500 transition-colors duration-300 ease-out p-1 opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
        {displayData.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 text-sm py-10">No entries found.</p>}
      </div>
    </div>
  );
}

// ==========================================
// BUDGETS VIEW
// ==========================================
function BudgetsView({ budgets, currentExpenses, db, user, appId }) {
  const handleUpdateBudget = async (cat, val) => {
    if(!user) return;
    try { await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'budgets', 'data'), { ...budgets, [cat]: parseFloat(val) || 0 }); } catch(e) {}
  };

  return (
    <div>
      <div className="mb-8 px-2 stagger-1"><h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Budgets</h2></div>
      <div className="space-y-6 stagger-2">
        {Object.keys(budgets).map(category => {
          const limit = budgets[category] || 0; const spent = currentExpenses[category] || 0;
          const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : (spent > 0 ? 100 : 0);
          let statusColor = percentage > 75 ? "bg-[#f59e0b]" : "bg-[#10b981]"; 
          let textColor = percentage > 75 ? "text-[#f59e0b]" : "text-[#10b981]";
          if (percentage >= 100) { statusColor = "bg-[#ef4444]"; textColor = "text-[#ef4444]"; }

          return (
            <div key={category} className="bg-white dark:bg-[#0D0D0D] p-6 rounded-[2rem] border border-gray-200 dark:border-white/[0.05] transition-colors duration-300 ease-out hover:border-gray-300 dark:hover:border-white/10 shadow-sm dark:shadow-none">
              <div className="flex justify-between items-start mb-6">
                <h3 className="font-bold text-gray-900 dark:text-white text-lg tracking-wide">{category}</h3>
                <div className="text-right">
                  <span className={`text-sm font-black ${textColor}`}>{percentage.toFixed(0)}%</span>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Consumed</p>
                </div>
              </div>
              <div className="w-full bg-gray-100 dark:bg-[#1A1A1A] rounded-full h-1.5 mb-6 overflow-hidden">
                <div className={`h-full rounded-full ${statusColor} transition-all duration-1000 ease-out`} style={{ width: `${percentage}%` }}></div>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-1">Spent</p>
                  <p className="font-bold text-gray-900 dark:text-white text-sm">₹{spent.toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-1">Limit</p>
                  <div className="flex items-center justify-end"><span className="text-gray-500 dark:text-gray-400 mr-1 text-xs">₹</span><input type="number" value={limit} onChange={(e) => handleUpdateBudget(category, e.target.value)} className="w-16 bg-transparent outline-none font-bold text-gray-900 dark:text-white text-sm text-right transition-all duration-300 ease-out focus:text-blue-500" /></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// GOALS VIEW
// ==========================================
function GoalsView({ goals, db, user, appId }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newGoal, setNewGoal] = useState({ name: '', target: '', current: '0', color: '#3b82f6' });

  const handleAdd = async (e) => {
    e.preventDefault();
    if(!user || !newGoal.name || !newGoal.target) return;
    const newId = Date.now().toString();
    try { await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'goals', newId), { ...newGoal, id: newId, target: parseFloat(newGoal.target), current: parseFloat(newGoal.current) }); setShowAdd(false); setNewGoal({ name: '', target: '', current: '0', color: '#3b82f6' }); } catch(err) {}
  };
  const addFunds = async (goal, amount) => { if(!user) return; try { await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'goals', goal.id), { ...goal, current: Math.min(goal.target, goal.current + amount) }); } catch(e){} };
  const deleteGoal = async (id) => { if(!user || !window.confirm("Delete goal?")) return; try { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'goals', id)); } catch(e){} }

  return (
    <div>
      <div className="flex items-center justify-between mb-8 px-2 stagger-1">
        <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Targets</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center transition-all duration-300 ease-out hover:scale-105 active:scale-95 shadow-md shadow-blue-500/20"><Plus className="w-5 h-5 text-white" /></button>
      </div>
      {showAdd && (
        <div className="bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] p-6 rounded-[2rem] shadow-xl dark:shadow-2xl mb-8 animate-fade-in">
           <div className="flex justify-between items-center mb-6">
             <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">New Target</h3>
             <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-rose-500 transition-colors duration-300 ease-out"><X className="w-5 h-5" /></button>
          </div>
           <form onSubmit={handleAdd} className="space-y-4">
             <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Goal Name</label><input required type="text" value={newGoal.name} onChange={e=>setNewGoal({...newGoal, name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 dark:bg-[#151515] border border-gray-200 dark:border-white/[0.05] rounded-xl outline-none text-gray-900 dark:text-white text-sm transition-all duration-300 ease-out focus:border-blue-500" /></div>
             <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Target Amount (₹)</label><input required type="number" value={newGoal.target} onChange={e=>setNewGoal({...newGoal, target: e.target.value})} className="w-full px-4 py-3 bg-gray-50 dark:bg-[#151515] border border-gray-200 dark:border-white/[0.05] rounded-xl outline-none text-gray-900 dark:text-white text-sm transition-all duration-300 ease-out focus:border-blue-500" /></div>
             <button type="submit" className="w-full py-3.5 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest mt-2 transition-all duration-300 ease-out hover:bg-blue-700 active:scale-95 shadow-md shadow-blue-500/20">Create Target</button>
           </form>
        </div>
      )}
      <div className="space-y-4 stagger-2">
        {goals.map(goal => {
          const percent = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
          return (
            <div key={goal.id} className="bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] p-6 rounded-[2rem] transition-colors duration-300 ease-out hover:border-gray-300 dark:hover:border-white/10 shadow-sm dark:shadow-none">
              <div className="flex justify-between items-start mb-5">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{goal.name}</h3>
                <span className="text-xl font-black" style={{ color: goal.color }}>{percent.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-[#1A1A1A] rounded-full h-1.5 mb-5 overflow-hidden"><div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${percent}%`, backgroundColor: goal.color }}></div></div>
              <div className="flex justify-between text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-6"><span>₹{goal.current.toLocaleString('en-IN')} Saved</span><span>₹{goal.target.toLocaleString('en-IN')} Target</span></div>
              <div className="flex gap-3">
                <button onClick={() => addFunds(goal, 500)} className="flex-1 py-3 text-xs font-bold uppercase tracking-widest bg-gray-50 dark:bg-[#151515] text-gray-900 dark:text-white rounded-xl transition-colors duration-300 ease-out hover:bg-gray-100 dark:hover:bg-[#202020] border border-gray-200 dark:border-transparent active:scale-95">+ ₹500</button>
                <button onClick={() => deleteGoal(goal.id)} className="px-4 bg-gray-50 dark:bg-[#151515] text-gray-400 dark:text-gray-400 border border-gray-200 dark:border-transparent rounded-xl transition-colors duration-300 ease-out hover:text-rose-500 dark:hover:text-rose-500 active:scale-95"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          )
        })}
        {goals.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 text-sm py-10">No targets created yet.</p>}
      </div>
    </div>
  );
}

// ==========================================
// AI ASSISTANT VIEW (SMARTER AI LOGIC)
// ==========================================
function AIAssistantView({ transactions, analytics, profile }) {
  const [aiMessages, setAiMessages] = useState(() => {
    const saved = localStorage.getItem('neofin-ai-chats');
    return saved ? JSON.parse(saved) : [{ role: 'ai', text: `Systems online. How can I assist with your portfolio today, ${profile?.name}?` }];
  });
  const [aiInput, setAiInput] = useState(''); const [isAiLoading, setIsAiLoading] = useState(false); const messagesEndRef = useRef(null);
  
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); localStorage.setItem('neofin-ai-chats', JSON.stringify(aiMessages)); }, [aiMessages]);

  const handleSend = async (text) => {
    if (!text.trim() || isAiLoading) return;
    setAiMessages(prev => [...prev, { role: 'user', text }]); setAiInput(''); setIsAiLoading(true);
    try {
      const finData = transactions.length > 0 ? transactions.map(t => `- ${t.type}: ₹${t.amount} on ${t.category}`).join('\n') : "No data.";
      const ctx = aiMessages.slice(-3).map(m => `${m.role}: ${m.text}`).join('\n');
      
      // NEW, SMARTER PROMPT
      const prompt = `You are NeoFin AI, an intelligent, sophisticated, and highly analytical Indian wealth advisor.
      You have direct access to the user's live financial data. Use it to give highly personalized, accurate advice.
      
      TONE & STYLE RULES:
      1. Be mathematically rigorous but encouraging. Never yell at the user or use aggressive Wall Street jargon.
      2. Focus on proportions. If someone is spending a tiny amount of their income on entertainment, DO NOT tell them to cut it. Focus on the big picture.
      3. Treat the user like a serious investor, not a child.
      4. Always pivot from just giving the number to offering a smart, actionable financial insight (e.g., SIPs, market opportunities, saving strategies).

      USER'S LIVE TRANSACTION DATA:
      ${finData}
      
      CONVERSATION HISTORY:
      ${ctx}`;
      
      const res = await callGeminiAPI(text, prompt);
      setAiMessages(prev => [...prev, { role: 'ai', text: res }]);
    } catch (e) { setAiMessages(prev => [...prev, { role: 'ai', text: "Connection error." }]); } 
    finally { setIsAiLoading(false); }
  };

  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to delete all messages?")) {
      setAiMessages([{ role: 'ai', text: `Memory cleared. Standing by, ${profile?.name}.` }]);
      localStorage.removeItem('neofin-ai-chats');
    }
  };

  return (
    <div className="h-[calc(100vh-14rem)] flex flex-col animate-fade-in stagger-1 bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] rounded-[2.5rem] overflow-hidden relative shadow-xl dark:shadow-2xl dark:shadow-black">
      <div className="bg-gray-50 dark:bg-[#151515] p-5 flex items-center justify-between border-b border-gray-200 dark:border-white/[0.05]">
        <div className="flex items-center gap-3"><Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-500" /><h2 className="font-black text-sm uppercase tracking-widest text-gray-900 dark:text-white">NeoFin Intelligence</h2></div>
        <button onClick={handleClearChat} className="text-gray-400 dark:text-gray-400 hover:text-rose-500 transition-colors duration-300 ease-out"><Trash2 className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {aiMessages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed transition-all duration-300 ease-out ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm shadow-md shadow-blue-500/20' : 'bg-gray-50 dark:bg-[#151515] text-gray-700 dark:text-[#A3A3A3] border border-gray-100 dark:border-white/[0.05] rounded-tl-sm'}`}>
               <span dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, msg.role === 'user' ? '<strong class="text-white">$1</strong>' : '<strong class="text-gray-900 dark:text-white">$1</strong>') }} />
            </div>
          </div>
        ))}
        {isAiLoading && <div className="flex justify-start"><div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-[#151515] flex items-center justify-center border border-gray-100 dark:border-transparent"><Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-500 animate-spin" /></div></div>}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 bg-gray-50 dark:bg-[#151515] border-t border-gray-200 dark:border-white/[0.05]">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(aiInput); }} className="relative flex items-center">
          <input type="text" value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder="Query intelligence..." className="w-full pl-5 pr-14 py-4 bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] rounded-xl outline-none text-gray-900 dark:text-white text-sm shadow-sm dark:shadow-none transition-all duration-300 ease-out focus:border-blue-500" disabled={isAiLoading} />
          <button type="submit" disabled={!aiInput.trim() || isAiLoading} className="absolute right-2 p-2.5 bg-blue-600 text-white rounded-lg disabled:opacity-50 transition-all duration-300 ease-out hover:bg-blue-700 active:scale-95 shadow-md shadow-blue-500/20"><Send className="w-4 h-4" /></button>
        </form>
      </div>
    </div>
  );
}
