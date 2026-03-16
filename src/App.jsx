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
  TrendingUp, Compass, Calendar, ChevronDown, Loader2, LogOut
} from 'lucide-react';

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

// --- MOCK DATA FOR NEW USERS ---
const MOCK_TRANSACTIONS = [
  { id: '1', date: '2026-03-01', amount: 15000, type: 'income', category: 'Income', description: 'Monthly Allowance' },
  { id: '2', date: '2026-03-05', amount: 2000, type: 'expense', category: 'Investing', description: 'Zerodha Fund Transfer' },
  { id: '3', date: '2026-03-08', amount: 8500, type: 'expense', category: 'Housing', description: 'Room Rent & Utilities' },
  { id: '4', date: '2026-03-12', amount: 1000, type: 'expense', category: 'Investing', description: 'Groww SIP (Nifty 50)' },
  { id: '5', date: '2026-03-15', amount: 450, type: 'expense', category: 'Food', description: 'Local Cafe' },
];

const INITIAL_BUDGETS = { Housing: 9000, Food: 3500, Transport: 2000, Investing: 3000, Education: 1500, Entertainment: 1500 };
const INITIAL_GOALS = [{ id: 'g1', name: 'Emergency Fund', target: 50000, current: 15000, color: '#10b981' }];
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6', '#f43f5e'];

// --- UTILITY FUNCTIONS ---
const formatCurrency = (amount) => {
  if (typeof amount !== 'number') return '₹0';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

const formatDate = (dateString) => {
  try { return new Date(dateString).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }); } 
  catch (e) { return dateString; }
};

const getMonthYearString = (dateObj) => {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
};

const autoCategorize = (description) => {
  const desc = (description || '').toLowerCase();
  
  if (desc.match(/zerodha|groww|upstox|angelone|indmoney|sip|mutual fund|stock/)) return 'Investing';
  if (desc.match(/course|udemy|coursera|books|fees|college|tuition/)) return 'Education';
  if (desc.match(/uber|ola|rapido|metro|irctc|redbus|bus|train|petrol|fuel/)) return 'Transport';
  if (desc.match(/cafe|mess|food|grocery|restaurant|swiggy|zomato|zepto|blinkit/)) return 'Food';
  // Added variations of jiohotstar, jiocinema, and common typos!
  if (desc.match(/netflix|spotify|movie|bookmyshow|hotstar|hostar|prime|jiocinema|jiohotstar|subscription/)) return 'Entertainment';
  if (desc.match(/amazon|flipkart|myntra|ajio|cloth|shoe/)) return 'Shopping';
  // Made Housing strictly look for wifi/recharge keywords instead of just 'jio'
  if (desc.match(/rent|hostel|pg|room|maintenance|electric|wifi|broadband|recharge|jio fiber/)) return 'Housing';
  
  return 'Other';
};

// --- GEMINI API INTEGRATION ---
const callGeminiAPI = async (prompt, systemInstruction) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY; 
  
  // 1. Strict safety check for the API key
  if (!apiKey || apiKey === 'undefined') {
    return "Setup Error: VITE_GEMINI_API_KEY is missing! Please add it to Vercel and click REDEPLOY.";
  }

  // 2. Using the exact, verified Gemini 1.5 Flash endpoint
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const payload = { 
    contents: [{ role: "user", parts: [{ text: `System Context: ${systemInstruction}\n\nUser Question: ${prompt}` }] }] 
  };
  
  try {
    const response = await fetch(url, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(payload) 
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error("Gemini API Error details:", data);
      return `AI Error (${response.status}): ${data.error?.message || "Check API Key and Model Name"}`;
    }
    
    if (data.candidates && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    }
    
    return "I couldn't generate a specific response. Try rephrasing.";
  } catch (error) { 
    console.error("Fetch error:", error);
    return "Network error. Please check your internet connection."; 
  }
};


// ==========================================
// MAIN APPLICATION COMPONENT
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState(null); 
  const [isInitializingAccount, setIsInitializingAccount] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('neofin-theme') !== 'light');
  useEffect(() => {
    if (darkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('neofin-theme', 'dark'); } 
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('neofin-theme', 'light'); }
  }, [darkMode]);

  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [goals, setGoals] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(getMonthYearString(new Date()));

  // 1. CLEAN AUTH LISTENER
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. DATA FETCHING
  useEffect(() => {
    if (!user) return;
    const baseRef = `artifacts/${appId}/users/${user.uid}`;

    const unsubProfile = onSnapshot(doc(db, baseRef, 'profile', 'data'), (docSnap) => {
      if (docSnap.exists()) setProfile(docSnap.data());
      else setProfile(false); 
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
    let totalIncome = 0; let totalExpense = 0; let totalInvestedMonth = 0;
    const categoryTotals = {}; const monthlyDataMap = {}; const currentMonthExpenses = {};

    const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedTx.forEach(t => {
      if (!t.date || !t.amount) return;
      const tMonthKey = t.date.substring(0, 7); 
      const tDateObj = new Date(t.date);
      const monthLabel = tDateObj.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

      if (!monthlyDataMap[tMonthKey]) monthlyDataMap[tMonthKey] = { name: monthLabel, income: 0, expense: 0, key: tMonthKey };
      if (t.type === 'income') monthlyDataMap[tMonthKey].income += t.amount;
      else monthlyDataMap[tMonthKey].expense += t.amount;

      if (selectedMonth === 'all' || selectedMonth === tMonthKey) {
        if (t.type === 'income') totalIncome += t.amount;
        else {
          totalExpense += t.amount;
          currentMonthExpenses[t.category] = (currentMonthExpenses[t.category] || 0) + t.amount;
          categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
          if (t.category === 'Investing') totalInvestedMonth += t.amount;
        }
      }
    });

    const balance = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
    const pieData = Object.keys(categoryTotals).map(key => ({ name: key, value: categoryTotals[key] })).sort((a, b) => b.value - a.value);

    return { totalIncome, totalExpense, balance, savingsRate, totalInvestedMonth, pieData, monthlyTrendData: Object.values(monthlyDataMap), currentMonthExpenses };
  }, [transactions, selectedMonth]);

  // 3. SECURE PROFILE CREATION
  const handleCreateProfile = async (name) => {
    if (!name.trim()) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    
    const baseRef = `artifacts/${appId}/users/${currentUser.uid}`;
    
    try {
      // 1. Check if the user already exists in the database
      const profileSnap = await getDoc(doc(db, baseRef, 'profile', 'data'));
      
      // 2. ONLY inject data if this is a brand new account
      if (!profileSnap.exists()) {
        await setDoc(doc(db, baseRef, 'profile', 'data'), { name: name.trim(), joinedAt: new Date().toISOString() });
        await setDoc(doc(db, baseRef, 'budgets', 'data'), INITIAL_BUDGETS);
        // Notice: The Mock Data injection line is completely gone!
      }
    } catch (e) { 
      console.error("Failed to setup profile:", e); 
    } finally { 
      setIsInitializingAccount(false); 
    }
  };
  const handleLogout = () => { signOut(auth); };

  // =========================================================
  // THE NEW, BULLETPROOF "TRAFFIC COP" ROUTING LOGIC
  // =========================================================
  
  // A. Still checking Firebase connection...
  if (authLoading || (user && profile === null && !isInitializingAccount)) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  // B. Not logged in, OR no profile data exists, OR currently creating account -> Lock them on Welcome Screen
  if (!user || profile === false || isInitializingAccount) {
    return <OnboardingScreen onComplete={handleCreateProfile} onLoginStart={() => setIsInitializingAccount(true)} isLoading={isInitializingAccount} />;
  }

  // C. Fully Logged in & Data Loaded -> Let them into the Dashboard!
  const themeClass = darkMode ? 'dark' : '';
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
    { id: 'transactions', icon: Receipt, label: 'History' },
    { id: 'budgets', icon: Activity, label: 'Budgets' },
    { id: 'goals', icon: Target, label: 'Goals' },
    { id: 'ai', icon: Sparkles, label: 'AI Advisor' },
  ];

  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 ${themeClass}`}>
      <div className="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-screen flex flex-col md:flex-row pb-16 md:pb-0">
        
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 fixed h-full z-40">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-3 text-blue-600 dark:text-blue-500">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><Compass className="w-6 h-6" /></div>
              <span className="text-xl font-bold tracking-tight">NeoFin</span>
            </div>
          </div>

          <div className="px-6 mb-4">
            <div className="bg-gray-100 dark:bg-gray-800/50 rounded-xl p-3 flex items-center space-x-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                {profile?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">Hi, {profile?.name}</p>
                <button onClick={handleLogout} className="text-xs text-rose-500 hover:text-rose-600 font-medium">Sign Out</button>
              </div>
            </div>
          </div>

          <nav className="px-4 py-2 space-y-1 flex-1">
            {navItems.map((item) => (
              <button
                key={item.id} onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === item.id ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : ''}`} />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 flex flex-col min-w-0 md:ml-64 relative">
          <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white capitalize hidden md:block">
                {navItems.find(n => n.id === activeTab)?.label}
              </h1>
              <div className="md:hidden flex items-center space-x-2 text-blue-600 dark:text-blue-500">
                <Compass className="w-6 h-6" />
                <span className="text-lg font-bold tracking-tight">NeoFin</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="relative group">
                <select 
                  value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                  className="appearance-none bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-1.5 pl-3 pr-8 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">All Time</option>
                  {availableMonths.map(m => {
                    const [year, month] = m.split('-');
                    const date = new Date(year, month - 1);
                    return <option key={m} value={m}>{date.toLocaleString('default', { month: 'short' })} {year}</option>;
                  })}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none" />
              </div>
              <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button 
    onClick={() => { if(window.confirm('Are you sure you want to sign out?')) handleLogout(); }} 
    className="md:hidden p-2 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-800/50 transition-colors"
    title="Sign Out"
  >
    <LogOut className="w-5 h-5" />
  </button>
            </div>
          </header>

          <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 custom-scrollbar bg-gray-50 dark:bg-gray-950">
            {activeTab === 'dashboard' && <DashboardView analytics={analytics} transactions={transactions} selectedMonth={selectedMonth} />}
            {activeTab === 'transactions' && <TransactionsView transactions={transactions} selectedMonth={selectedMonth} db={db} user={user} appId={appId} />}
            {activeTab === 'budgets' && <BudgetsView budgets={budgets} currentExpenses={analytics.currentMonthExpenses} db={db} user={user} appId={appId} selectedMonth={selectedMonth} />}
            {activeTab === 'goals' && <GoalsView goals={goals} db={db} user={user} appId={appId} />}
            {activeTab === 'ai' && <AIAssistantView transactions={transactions} analytics={analytics} budgets={budgets} goals={goals} profile={profile} selectedMonth={selectedMonth} />}
          </div>
        </main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-50 px-2 pb-safe pt-2 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
          <div className="flex justify-around items-center h-14">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id} onClick={() => setActiveTab(item.id)}
                  className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 0px); }
      `}} />
    </div>
  );
}

// ==========================================
// ONBOARDING SCREEN (Landing Page Style)
// ==========================================
function OnboardingScreen({ onComplete, onLoginStart, isLoading }) {
  const [isGreeting, setIsGreeting] = useState(false);
  const [displayName, setDisplayName] = useState('');

  const handleGoogleLogin = async () => {
    try {
      if (onLoginStart) onLoginStart();
      const auth = getAuth();
      const provider = new GoogleAuthProvider();
      
      const result = await signInWithPopup(auth, provider);
      const fullName = result.user.displayName || "there";
      const firstName = fullName.split(' ')[0];
      setDisplayName(firstName);
      
      setIsGreeting(true);
      setTimeout(() => { onComplete(firstName); }, 2000);
    } catch (error) {
      console.error("Google Login Error:", error);
      alert("Sign in failed or was cancelled. Please try again.");
    }
  };

  if (isGreeting || isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 p-6 transition-colors duration-200">
        <div className="flex flex-col items-center animate-fade-in">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-6" />
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome, {displayName}.</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Preparing your secure workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4 md:p-6 transition-colors duration-200">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 p-8 rounded-[2rem] shadow-xl border border-gray-200 dark:border-gray-800 animate-fade-in relative overflow-hidden">
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600"></div>

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center shadow-inner border border-blue-100 dark:border-blue-800/50">
            <Compass className="w-8 h-8 text-blue-600 dark:text-blue-500" />
          </div>
        </div>

        {/* Hero Text */}
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white text-center mb-3 tracking-tight">NeoFin</h1>
        <p className="text-base text-gray-500 dark:text-gray-400 text-center mb-8">Master your money with AI-driven insights.</p>

        {/* Feature List */}
        <div className="space-y-6 mb-10">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Track Wealth</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Monitor cash flow & budgets</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">AI Advisor</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Personalized financial guidance</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Cloud Sync</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Securely access anywhere</p>
            </div>
          </div>
        </div>

        {/* Google Login Button */}
        <button onClick={handleGoogleLogin} disabled={isLoading} className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg">
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>
        <p className="mt-4 text-[10px] text-center text-gray-500 dark:text-gray-400">
          Your financial data is encrypted and securely synced.
        </p>
      </div>
    </div>
  );
}

// ==========================================
// DASHBOARD VIEW
// ==========================================
function DashboardView({ analytics, transactions, selectedMonth }) {
  const filteredTx = selectedMonth === 'all' 
    ? transactions 
    : transactions.filter(t => t.date && t.date.substring(0, 7) === selectedMonth);
    
  const recentTransactions = filteredTx.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const monthText = selectedMonth === 'all' ? 'All Time' : 'This Month';

  const statCards = [
    { title: "Net Balance", value: analytics.balance, icon: Wallet, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30", sub: monthText },
    { title: "Inflow", value: analytics.totalIncome, icon: ArrowDownRight, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30", sub: monthText },
    { title: "Spends", value: analytics.totalExpense, icon: ArrowUpRight, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-900/30", sub: monthText },
    { title: "Invested", value: analytics.totalInvestedMonth, icon: TrendingUp, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30", sub: monthText },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 flex flex-col justify-between relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <div className={`p-2.5 rounded-xl ${stat.bg} relative z-10`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
            <div className="relative z-10">
              <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 line-clamp-1">{stat.title}</p>
              <h3 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {formatCurrency(stat.value)}
              </h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
             <h3 className="text-lg font-bold text-gray-900 dark:text-white">Historical Cash Flow</h3>
             <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">All Time</span>
          </div>
          <div className="h-64 md:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.monthlyTrendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dx={-10} tickFormatter={(val) => `₹${val}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '0.75rem', color: '#fff' }}
                  itemStyle={{ color: '#e5e7eb' }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Line type="monotone" name="Inflow" dataKey="income" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} />
                <Line type="monotone" name="Outflow" dataKey="expense" stroke="#ef4444" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 flex flex-col">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Spends Breakdown</h3>
          <p className="text-xs text-gray-500 mb-2">{monthText}</p>
          <div className="flex-1 min-h-[220px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={analytics.pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                  {analytics.pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ borderRadius: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-gray-500 dark:text-gray-400">Total Spent</span>
              <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(analytics.totalExpense)}</span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 justify-center">
             {analytics.pieData.slice(0, 4).map((entry, idx) => (
               <div key={idx} className="flex items-center text-xs text-gray-600 dark:text-gray-300">
                 <span className="w-2.5 h-2.5 rounded-full mr-1.5" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                 {entry.name}
               </div>
             ))}
             {analytics.pieData.length === 0 && <span className="text-xs text-gray-400">No data for {monthText}</span>}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 mb-4 md:mb-0">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Log ({monthText})</h3>
        </div>
        <div className="space-y-3">
          {recentTransactions.map(tx => (
            <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-700/50">
              <div className="flex items-center space-x-3 md:space-x-4">
                <div className={`p-2.5 md:p-3 rounded-full shrink-0 ${
                    tx.type === 'income' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' 
                    : tx.category === 'Investing' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                  {tx.type === 'income' ? <ArrowDownRight className="w-4 h-4 md:w-5 md:h-5" /> 
                   : tx.category === 'Investing' ? <TrendingUp className="w-4 h-4 md:w-5 md:h-5" /> 
                   : <Receipt className="w-4 h-4 md:w-5 md:h-5" />}
                </div>
                <div>
                  <p className="font-semibold text-sm md:text-base text-gray-900 dark:text-white line-clamp-1">{tx.description}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(tx.date)} • {tx.category}</p>
                </div>
              </div>
              <span className={`font-bold text-sm md:text-base whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-500' : 'text-gray-900 dark:text-white'}`}>
                {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
              </span>
            </div>
          ))}
          {recentTransactions.length === 0 && (
            <div className="text-center text-gray-500 py-6">No transactions found for {monthText}.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// TRANSACTIONS VIEW
// ==========================================
function TransactionsView({ transactions, selectedMonth, db, user, appId }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ type: 'expense', amount: '', date: new Date().toISOString().split('T')[0], description: '', category: 'Other' });

  const baseTx = selectedMonth === 'all' ? transactions : transactions.filter(t => t.date && t.date.substring(0, 7) === selectedMonth);
  const categories = ['All', ...new Set(baseTx.map(t => t.category))];

  const filteredData = baseTx.filter(t => {
    const matchesSearch = (t.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = filterCategory === 'All' || t.category === filterCategory;
    return matchesSearch && matchesCat;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const handleExportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," + "Date,Description,Category,Type,Amount\n" + filteredData.map(e => `${e.date},"${e.description}",${e.category},${e.type},${e.amount}`).join("\n");
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `neofin_tx_${selectedMonth}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!user || !formData.amount || !formData.description) return;
    
    let finalCategory = formData.category;
    
    // SMART FIX: Handle Income vs Expense properly
    if (finalCategory === 'Other') {
      if (formData.type === 'income') {
        finalCategory = 'Income';
      } else {
        finalCategory = autoCategorize(formData.description);
      }
    }

    const newId = Date.now().toString();
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', newId), { 
        id: newId, 
        ...formData, 
        amount: parseFloat(formData.amount), 
        category: finalCategory 
      });
      setShowAddForm(false); 
      setFormData({ type: 'expense', amount: '', date: new Date().toISOString().split('T')[0], description: '', category: 'Other' });
    } catch (e) { console.error("Error adding:", e); }
  };

  const handleDelete = async (id) => {
    if(!user) return;
    try { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id)); } catch(e) {}
  };

  return (
    <div className="space-y-6 animate-fade-in mb-6 md:mb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50">
        <div className="flex flex-col sm:flex-row items-center w-full md:w-auto gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder={`Search...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white text-sm" />
          </div>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full sm:w-auto px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white text-sm">
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <button onClick={handleExportCSV} className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium">
            <Download className="w-4 h-4" /> <span>CSV</span>
          </button>
          <button onClick={() => setShowAddForm(!showAddForm)} className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all text-sm font-medium">
            <Plus className="w-4 h-4" /> <span>Add</span>
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 bg-blue-500 h-full"></div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center"><Receipt className="w-5 h-5 mr-2 text-blue-500" /> Record Entry</h3>
          <form onSubmit={handleAddTransaction} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1"><label className="text-xs font-semibold text-gray-500 uppercase">Type</label><select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white outline-none text-sm"><option value="expense">Expense</option><option value="income">Income</option></select></div>
            <div className="space-y-1"><label className="text-xs font-semibold text-gray-500 uppercase">Amount (₹)</label><input type="number" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0" className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white outline-none text-sm" /></div>
            <div className="space-y-1 lg:col-span-2"><label className="text-xs font-semibold text-gray-500 uppercase">Description</label><input type="text" required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="e.g., Zomato, Rent" className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white outline-none text-sm" /></div>
            <div className="space-y-1"><label className="text-xs font-semibold text-gray-500 uppercase">Date</label><input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white outline-none text-sm" /></div>
            <div className="lg:col-span-5 flex justify-end space-x-3 mt-2">
               <button type="button" onClick={() => setShowAddForm(false)} className="px-4 md:px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">Cancel</button>
               <button type="submit" className="px-4 md:px-5 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md transition-colors flex items-center">Save <CheckCircle className="w-4 h-4 ml-2 hidden sm:block" /></button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                <th className="p-4 font-semibold">Details</th><th className="p-4 font-semibold hidden md:table-cell">Category</th><th className="p-4 font-semibold text-right">Amount</th><th className="p-4 font-semibold text-center w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredData.map(tx => (
                <tr key={tx.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors group">
                  <td className="p-4"><p className="text-sm font-medium text-gray-900 dark:text-white">{tx.description}</p><p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatDate(tx.date)} <span className="md:hidden">• {tx.category}</span></p></td>
                  <td className="p-4 hidden md:table-cell"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${tx.category === 'Investing' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>{tx.category}</span></td>
                  <td className={`p-4 text-sm font-bold text-right whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-500' : 'text-gray-900 dark:text-white'}`}>{tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}</td>
                  <td className="p-4 text-center"><button onClick={() => handleDelete(tx.id)} className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors md:opacity-0 md:group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
              {filteredData.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-gray-500">No transactions found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// BUDGETS VIEW
// ==========================================
function BudgetsView({ budgets, currentExpenses, db, user, appId, selectedMonth }) {
  const handleUpdateBudget = async (cat, val) => {
    if(!user) return;
    try { await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'budgets', 'data'), { ...budgets, [cat]: parseFloat(val) || 0 }); } catch(e) {}
  };

  return (
    <div className="space-y-6 animate-fade-in mb-6 md:mb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-2">
        <div><h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Budgets</h2><p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">Showing spent for {selectedMonth}</p></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
        {Object.keys(budgets).map(category => {
          const limit = budgets[category] || 0; const spent = currentExpenses[category] || 0;
          const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : (spent > 0 ? 100 : 0);
          let statusColor = percentage > 75 ? "bg-amber-500" : "bg-emerald-500"; let textColor = percentage > 75 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";
          if (percentage >= 100) { statusColor = "bg-rose-500"; textColor = "text-rose-600 dark:text-rose-400"; }
          if (category === 'Investing') { statusColor = "bg-purple-500"; textColor = "text-purple-600 dark:text-purple-400"; }

          return (
            <div key={category} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3"><div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-700`}>{category === 'Investing' ? <TrendingUp className="w-5 h-5 text-gray-600 dark:text-gray-300" /> : <Activity className="w-5 h-5 text-gray-600 dark:text-gray-300" />}</div><h3 className="font-bold text-gray-900 dark:text-white">{category}</h3></div>
                <div className="text-right"><span className={`text-sm font-bold ${textColor}`}>{percentage.toFixed(0)}%</span><p className="text-[10px] uppercase text-gray-500 tracking-wider">Used</p></div>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 mb-4 overflow-hidden"><div className={`h-full rounded-full ${statusColor} transition-all duration-500`} style={{ width: `${percentage}%` }}></div></div>
              <div className="flex justify-between items-end text-sm">
                <div><p className="text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-wider mb-1">Spent</p><p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(spent)}</p></div>
                <div className="text-right">
                  <p className="text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-wider mb-1">Monthly Limit</p>
                  <div className="flex items-center border-b border-gray-200 dark:border-gray-600 focus-within:border-blue-500"><span className="text-gray-500 mr-1 text-xs">₹</span><input type="number" value={limit} onChange={(e) => handleUpdateBudget(category, e.target.value)} className="w-16 md:w-20 bg-transparent outline-none font-semibold text-gray-900 dark:text-white text-right" /></div>
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

  const addFunds = async (goal, amount) => {
    if(!user) return;
    try { await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'goals', goal.id), { ...goal, current: Math.min(goal.target, goal.current + amount) }); } catch(e){}
  };

  const deleteGoal = async (id) => { if(!user) return; try { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'goals', id)); } catch(e){} }

  return (
    <div className="space-y-6 animate-fade-in mb-6 md:mb-0">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-gradient-to-r from-blue-600 to-indigo-600 p-6 md:p-8 rounded-3xl shadow-lg text-white gap-4">
        <div><h2 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2 flex items-center"><Target className="w-6 h-6 mr-3 opacity-80" /> Savings Goals</h2></div>
        <button onClick={() => setShowAdd(!showAdd)} className="bg-white text-blue-600 px-5 py-2.5 rounded-xl font-bold shadow-sm hover:bg-blue-50 transition-colors flex items-center justify-center sm:shrink-0 w-full sm:w-auto"><Plus className="w-5 h-5 mr-2" /> New Goal</button>
      </div>

      {showAdd && (
        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
           <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-end">
             <div className="flex-1 w-full space-y-1"><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Goal Name</label><input required type="text" value={newGoal.name} onChange={e=>setNewGoal({...newGoal, name: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none dark:text-white text-sm" /></div>
             <div className="w-full md:w-48 space-y-1"><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Target (₹)</label><input required type="number" value={newGoal.target} onChange={e=>setNewGoal({...newGoal, target: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none dark:text-white text-sm" /></div>
             <button type="submit" className="w-full md:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors text-sm">Save</button>
           </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {goals.map(goal => {
          const percent = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
          return (
            <div key={goal.id} className="bg-white dark:bg-gray-800 p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 group">
              <div className="flex justify-between items-start mb-4"><h3 className="text-lg font-bold text-gray-900 dark:text-white">{goal.name}</h3><span className="text-xl font-black" style={{ color: goal.color }}>{percent.toFixed(0)}%</span></div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 mb-2 overflow-hidden shadow-inner"><div className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden" style={{ width: `${percent}%`, backgroundColor: goal.color }}></div></div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-5"><span>{formatCurrency(goal.current)} saved</span><span>{formatCurrency(goal.target)} target</span></div>
              <div className="flex space-x-2">
                <button onClick={() => addFunds(goal, 500)} className="flex-1 py-2 text-xs font-medium bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors">+ ₹500</button>
                <button onClick={() => deleteGoal(goal.id)} className="px-3 py-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}

// ==========================================
// AI ASSISTANT VIEW
// ==========================================
function AIAssistantView({ transactions, analytics, budgets, goals, profile, selectedMonth }) {
  const [messages, setMessages] = useState([{ role: 'assistant', text: `Hey ${profile?.name}! 👋 I'm your NeoFin Wealth Advisor. I'm currently analyzing your data for ${selectedMonth === 'all' ? 'All Time' : selectedMonth}.` }]);
  const [input, setInput] = useState(''); const [loading, setLoading] = useState(false); const messagesEndRef = useRef(null);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async (textPrompt) => {
    const userMessage = typeof textPrompt === 'string' ? textPrompt.trim() : input.trim();
    if (!userMessage || loading) return;
    setInput(''); setMessages(prev => [...prev, { role: 'user', text: userMessage }]); setLoading(true);

    const systemPrompt = `You are a friendly personal finance advisor for a young Indian adult. User: ${profile?.name}. Focus on managing monthly income effectively, compounding, and SIPs. Use ₹ symbol. Data Context: Income: ₹${analytics.totalIncome}, Expenses: ₹${analytics.totalExpense}, Balance: ₹${analytics.balance}, Budgets: ${JSON.stringify(budgets)}`;
    const aiResponseText = await callGeminiAPI(userMessage, systemPrompt);
    setMessages(prev => [...prev, { role: 'assistant', text: aiResponseText }]); setLoading(false);
  };

  const suggestedPrompts = [`Analyze my spends`, "Am I saving enough?", "How to start a ₹500 SIP?"];

  return (
    <div className="h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)] flex flex-col animate-fade-in bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 overflow-hidden relative">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 md:p-4 text-white flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center space-x-3"><div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm"><Bot className="w-5 h-5 md:w-6 md:h-6" /></div><div><h2 className="font-bold text-base md:text-lg">NeoFin Advisor</h2></div></div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 md:space-y-6 custom-scrollbar bg-gray-50/50 dark:bg-gray-900/50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[88%] md:max-w-[75%] space-x-2 md:space-x-3 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
              <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>
                {msg.role === 'user' ? <User className="w-3 h-3 md:w-4 md:h-4 text-white" /> : <Sparkles className="w-3 h-3 md:w-4 md:h-4" />}
              </div>
              <div className={`p-3 md:p-4 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-sm'}`}>
                <div className="text-xs md:text-sm whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: (msg.text || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
              </div>
            </div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="flex space-x-2 md:space-x-3"><div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0"><Sparkles className="w-3 h-3 md:w-4 md:h-4 animate-spin" /></div></div></div>}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-3 md:p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
        {messages.length === 1 && (
          <div className="flex overflow-x-auto gap-2 pb-3 mb-1 custom-scrollbar hide-scrollbar-mobile">
            {suggestedPrompts.map((prompt, i) => <button key={i} onClick={() => handleSend(prompt)} className="whitespace-nowrap px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-full border border-gray-200 dark:border-gray-600 transition-colors">{prompt}</button>)}
          </div>
        )}
        <form onSubmit={handleSend} className="relative flex items-center">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Ask a question...`} className="w-full pl-4 pr-12 py-3 md:py-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white text-sm transition-shadow" disabled={loading} />
          <button type="submit" disabled={!input.trim() || loading} className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"><Send className="w-4 h-4 md:w-5 md:h-5" /></button>
        </form>
      </div>
    </div>
  );
}
