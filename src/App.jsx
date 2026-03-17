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
  Bell, Filter, ChevronRight
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

// --- INITIAL DATA ---
const INITIAL_BUDGETS = { Housing: 9000, Food: 3500, Transport: 2000, Investing: 3000, Education: 1500, Entertainment: 1500 };
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6', '#f43f5e'];

// --- UTILITY FUNCTIONS ---
const formatCurrency = (amount) => {
  if (typeof amount !== 'number') return '₹0';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
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
  if (desc.match(/netflix|spotify|movie|bookmyshow|hotstar|hostar|prime|jiocinema|jiohotstar|subscription/)) return 'Entertainment';
  if (desc.match(/amazon|flipkart|myntra|ajio|cloth|shoe/)) return 'Shopping';
  if (desc.match(/rent|hostel|pg|room|maintenance|electric|wifi|broadband|recharge|jio fiber/)) return 'Housing';
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

// --- TAVILY SEARCH INTEGRATION ---
const searchWeb = async (query) => {
  const tavilyKey = import.meta.env.VITE_TAVILY_API_KEY; 
  if (!tavilyKey) return "No live data available.";
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: tavilyKey, query: query, search_depth: "basic", max_results: 3 })
    });
    const data = await response.json();
    if (!data.results || data.results.length === 0) return "No real-time data found.";
    return data.results.map(r => `Source: ${r.title}\nInfo: ${r.content}`).join('\n\n');
  } catch (e) { return "Could not fetch real-time data."; }
};

// --- GEMINI API INTEGRATION ---
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
    let totalIncome = 0; let totalExpense = 0;
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
        }
      }
    });

    const balance = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
    const pieData = Object.keys(categoryTotals).map(key => ({ name: key, value: categoryTotals[key] })).sort((a, b) => b.value - a.value);

    return { totalIncome, totalExpense, balance, savingsRate, pieData, monthlyTrendData: Object.values(monthlyDataMap), currentMonthExpenses };
  }, [transactions, selectedMonth]);

  const handleCreateProfile = async (name) => {
    if (!name.trim()) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const baseRef = `artifacts/${appId}/users/${currentUser.uid}`;
    try {
      const profileSnap = await getDoc(doc(db, baseRef, 'profile', 'data'));
      if (!profileSnap.exists()) {
        await setDoc(doc(db, baseRef, 'profile', 'data'), { name: name.trim(), joinedAt: new Date().toISOString() });
        await setDoc(doc(db, baseRef, 'budgets', 'data'), INITIAL_BUDGETS);
      }
    } catch (e) { console.error("Failed to setup profile:", e); } 
    finally { setIsInitializingAccount(false); }
  };

  const handleLogout = () => { if(window.confirm('Sign out of NeoFin?')) signOut(auth); };

  // ROUTING
  if (authLoading || (user && profile === null && !isInitializingAccount)) {
    return <div className="min-h-screen bg-[#02040A] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
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
    <div className="min-h-screen bg-[#02040A] text-white font-sans selection:bg-blue-500/30 overflow-x-hidden pb-32 text-[15px]">
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-0"></div>
      
      <div className="relative z-10 max-w-xl mx-auto px-5 pt-8">
        
        {/* HEADER */}
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl font-bold tracking-tight italic">NeoFin</span>
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-2 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleLogout} className="relative w-11 h-11 rounded-2xl bg-[#0D0D0D] border border-white/[0.05] flex items-center justify-center transition-all hover:bg-white/[0.02]">
               <LogOut className="w-5 h-5 text-[#525252] hover:text-rose-500 transition-colors" />
            </button>
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 p-[1px]">
              <div className="w-full h-full rounded-2xl bg-[#0D0D0D] overflow-hidden flex items-center justify-center">
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

        {/* MONTH SELECTOR (Global) */}
        <div className="flex justify-end mb-6">
          <div className="bg-[#0D0D0D] border border-white/[0.05] rounded-xl px-3 py-1.5 flex items-center">
             <Calendar className="w-4 h-4 text-[#525252] mr-2" />
             <select 
               value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
               className="bg-transparent text-[11px] font-bold text-white uppercase tracking-widest outline-none appearance-none pr-4 cursor-pointer"
             >
               <option value="all" className="bg-[#0D0D0D] text-white">ALL TIME</option>
               {availableMonths.map(m => (
                 <option key={m} value={m} className="bg-[#0D0D0D] text-white">{m}</option>
               ))}
             </select>
          </div>
        </div>

        {/* DYNAMIC VIEWS */}
        {activeTab === 'home' && <DashboardView analytics={analytics} transactions={transactions} selectedMonth={selectedMonth} />}
        {activeTab === 'tx' && <TransactionsView transactions={transactions} selectedMonth={selectedMonth} db={db} user={user} appId={appId} />}
        {activeTab === 'budgets' && <BudgetsView budgets={budgets} currentExpenses={analytics.currentMonthExpenses} db={db} user={user} appId={appId} selectedMonth={selectedMonth} />}
        {activeTab === 'goals' && <GoalsView goals={goals} db={db} user={user} appId={appId} />}
        {activeTab === 'ai' && <AIAssistantView transactions={transactions} analytics={analytics} profile={profile} selectedMonth={selectedMonth} />}

      </div>

      {/* COMMANDER DOCK */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-md z-50">
        <div className="bg-[#0D0D0D]/95 backdrop-blur-3xl border border-white/[0.05] rounded-[2.5rem] p-1.5 flex items-center justify-between shadow-2xl shadow-black relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          {navItems.map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)} 
              className={`flex flex-col items-center justify-center flex-1 py-3 rounded-3xl transition-all duration-300 ${activeTab === item.id ? 'text-white' : 'text-[#525252] hover:text-white'}`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-500 mb-1 ${activeTab === item.id ? 'bg-blue-600/10 shadow-[0_0_20px_rgba(37,99,235,0.2)]' : ''}`}>
                <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'stroke-[2.5px] text-blue-500' : 'stroke-[1.5px]'}`} />
              </div>
              <span className={`text-[8px] font-bold uppercase tracking-[0.15em] ${activeTab === item.id ? 'opacity-100' : 'opacity-40'}`}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s ease-out forwards; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1A1A1A; border-radius: 4px; }
        /* Fix recharts tooltip outline */
        .recharts-tooltip-wrapper { outline: none !important; }
      `}} />
    </div>
  );
}

// ==========================================
// DASHBOARD VIEW
// ==========================================
function DashboardView({ analytics, transactions, selectedMonth }) {
  const filteredTx = selectedMonth === 'all' ? transactions : transactions.filter(t => t.date && t.date.substring(0, 7) === selectedMonth);
  const recentTransactions = filteredTx.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);
  
  let aiAlert = "Analyzing your data patterns...";
  if (analytics.savingsRate > 40) aiAlert = "High liquidity detected. Excellent cycle for investments.";
  else if (analytics.savingsRate < 10 && analytics.totalExpense > 0) aiAlert = "High burn rate detected this cycle. Monitor discretionary spends.";
  else if (analytics.totalExpense === 0) aiAlert = "Your ledger is clean. Start logging to generate insights.";
  else aiAlert = "Financial velocity is stable. Keep tracking to refine your AI model.";

  return (
    <div className="animate-fade-in">
      <div className="mb-10 text-center">
        <p className="text-[10px] font-bold text-[#525252] uppercase tracking-[0.4em] mb-4">Available Liquidity</p>
        <div className="flex items-center justify-center">
          <span className="text-2xl font-medium text-[#525252] mr-3 mt-1">₹</span>
          <h2 className="text-6xl md:text-7xl font-black tracking-tighter">{analytics.balance.toLocaleString('en-IN')}</h2>
        </div>
        <div className="flex justify-center gap-2 mt-8">
          <div className="px-5 py-2.5 rounded-full bg-[#0D0D0D] border border-white/[0.05] flex items-center gap-2.5 shadow-sm">
            <ArrowDownRight className={`w-3.5 h-3.5 ${analytics.savingsRate >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
            <span className={`text-xs font-bold ${analytics.savingsRate >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{analytics.savingsRate.toFixed(1)}%</span>
          </div>
          <div className="px-5 py-2.5 rounded-full bg-[#0D0D0D] border border-white/[0.05] flex items-center gap-2">
            <span className="text-[10px] font-bold text-[#525252] uppercase tracking-widest">Savings Rate</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-[#0D0D0D] border border-white/[0.05] rounded-[2rem] p-6 shadow-sm hover:border-white/10 transition-colors group">
          <p className="text-[10px] font-bold text-[#525252] uppercase tracking-widest mb-3">Total Inflow</p>
          <p className="text-2xl font-bold">₹{analytics.totalIncome.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-[#0D0D0D] border border-white/[0.05] rounded-[2rem] p-6 shadow-sm hover:border-white/10 transition-colors group">
          <p className="text-[10px] font-bold text-[#525252] uppercase tracking-widest mb-3">Total Spends</p>
          <p className="text-2xl font-bold text-blue-500">₹{analytics.totalExpense.toLocaleString('en-IN')}</p>
        </div>
      </div>

      <div className="bg-blue-600 rounded-[2.5rem] p-7 mb-8 text-white relative overflow-hidden group shadow-2xl shadow-blue-900/20">
        <div className="absolute right-[-5%] top-[-10%] w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-4">
            <Sparkles className="w-4 h-4 text-white" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Strategic Note</span>
          </div>
          <p className="text-lg font-bold leading-[1.3] mb-5 tracking-tight">"{aiAlert}"</p>
        </div>
      </div>

      <div className="bg-[#0D0D0D] border border-white/[0.05] rounded-[2.5rem] p-7 mb-8 shadow-sm group">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Cash Flow</h3>
          <span className="text-[10px] font-bold text-[#525252] bg-white/[0.03] px-2.5 py-1 rounded-lg border border-white/5 uppercase tracking-widest">History</span>
        </div>
        <div className="h-48 w-full cursor-crosshair">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analytics.monthlyTrendData}>
              <XAxis dataKey="name" hide={true} />
              <YAxis hide={true} />
              <Tooltip cursor={false} content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-[#0D0D0D] border border-white/10 p-3 rounded-2xl shadow-2xl">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#525252] mb-2">{label}</p>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-emerald-400">Income: ₹{payload[0]?.value}</p>
                          <p className="text-xs font-bold text-rose-400">Expense: ₹{payload[1]?.value}</p>
                        </div>
                      </div>
                    );
                  } return null;
                }}
              />
              <Line type="monotone" name="Income" dataKey="Income" stroke="#10b981" strokeWidth={4} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }} animationDuration={1500} />
              <Line type="monotone" name="Expense" dataKey="Expense" stroke="#ef4444" strokeWidth={4} dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0, fill: '#ef4444' }} animationDuration={1500} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-6">
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[10px] font-bold text-[#525252] uppercase tracking-widest">Income</span></div>
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500"></div><span className="text-[10px] font-bold text-[#525252] uppercase tracking-widest">Expense</span></div>
        </div>
      </div>

      <div className="bg-[#0D0D0D] border border-white/[0.05] rounded-[2.5rem] p-7 mb-8 shadow-sm overflow-hidden transition-all hover:border-white/10">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white mb-2">Spends Breakdown</h3>
        <p className="text-[10px] font-bold text-[#525252] uppercase tracking-widest mb-6">Current Cycle</p>
        <div className="flex flex-col items-center">
          <div className="relative h-56 w-full flex items-center justify-center mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={analytics.pieData} innerRadius={70} outerRadius={90} paddingAngle={8} dataKey="value" stroke="none" animationDuration={1200}>
                  {analytics.pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} className="hover:opacity-70 outline-none" />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-widest mb-1">Total Spends</span>
              <span className="text-3xl font-black text-white">₹{analytics.totalExpense}</span>
            </div>
          </div>
          <div className="w-full grid grid-cols-2 gap-y-4 gap-x-8 px-2">
            {analytics.pieData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}></div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-white tracking-wide">{item.name}</span>
                  <span className="text-[10px] font-bold text-[#525252] uppercase">₹{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-xs font-black uppercase tracking-[0.4em] text-[#525252]">Journal</h3>
      </div>
      <div className="space-y-3">
        {recentTransactions.map((tx) => {
          const { day, month } = formatToDateBlock(tx.date);
          return (
            <div key={tx.id} className="flex items-center justify-between p-5 bg-[#0D0D0D] border border-white/[0.03] rounded-3xl group transition-all">
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center justify-center bg-[#151515] w-12 h-12 rounded-2xl border border-white/5 shrink-0 shadow-inner">
                  <span className="text-[10px] font-bold text-[#525252] uppercase leading-none mb-1">{month}</span>
                  <span className="text-sm font-black text-white leading-none">{day}</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white tracking-wide line-clamp-1">{tx.description}</h4>
                  <p className="text-[10px] font-bold text-[#525252] uppercase mt-1 tracking-widest leading-none">{tx.category}</p>
                </div>
              </div>
              <span className={`text-sm font-black whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-500' : 'text-white'}`}>
                {tx.type === 'income' ? '+' : '-'}₹{tx.amount}
              </span>
            </div>
          );
        })}
        {recentTransactions.length === 0 && <p className="text-center text-[#525252] text-sm py-4">No data to display.</p>}
      </div>
    </div>
  );
}

// ==========================================
// TRANSACTIONS VIEW (LEDGER)
// ==========================================
function TransactionsView({ transactions, selectedMonth, db, user, appId }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ type: 'expense', amount: '', date: new Date().toISOString().split('T')[0], description: '', category: 'Other' });

  const filteredData = selectedMonth === 'all' ? transactions : transactions.filter(t => t.date && t.date.substring(0, 7) === selectedMonth);
  const sortedData = [...filteredData].sort((a, b) => new Date(b.date) - new Date(a.date));

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
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8 px-2">
        <h2 className="text-2xl font-black tracking-tight">Ledger</h2>
        <button onClick={() => setShowAddForm(!showAddForm)} className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
          <Plus className="w-5 h-5 text-white" />
        </button>
      </div>

      {showAddForm && (
        <div className="bg-[#0D0D0D] border border-white/[0.05] p-6 rounded-[2rem] shadow-2xl mb-8">
          <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest">New Entry</h3>
          <form onSubmit={handleAddTransaction} className="space-y-4">
            <div className="flex gap-4">
               <div className="flex-1 space-y-1.5"><label className="text-[10px] font-bold text-[#525252] uppercase tracking-widest">Type</label>
                 <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full px-4 py-3 bg-[#151515] border border-white/[0.05] rounded-xl outline-none text-sm text-white">
                   <option value="expense">Expense</option><option value="income">Income</option>
                 </select>
               </div>
               <div className="flex-1 space-y-1.5"><label className="text-[10px] font-bold text-[#525252] uppercase tracking-widest">Amount</label>
                 <input type="number" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0" className="w-full px-4 py-3 bg-[#151515] border border-white/[0.05] rounded-xl outline-none text-sm text-white" />
               </div>
            </div>
            <div className="space-y-1.5"><label className="text-[10px] font-bold text-[#525252] uppercase tracking-widest">Description</label>
              <input type="text" required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="e.g., Rent, Coffee" className="w-full px-4 py-3 bg-[#151515] border border-white/[0.05] rounded-xl outline-none text-sm text-white" />
            </div>
            <div className="space-y-1.5"><label className="text-[10px] font-bold text-[#525252] uppercase tracking-widest">Date</label>
              <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-3 bg-[#151515] border border-white/[0.05] rounded-xl outline-none text-sm text-white" style={{colorScheme: 'dark'}} />
            </div>
            <div className="flex gap-3 pt-2">
               <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-3 bg-[#151515] text-white rounded-xl text-xs font-bold uppercase tracking-widest">Cancel</button>
               <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest">Save</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {sortedData.map(tx => {
          const { day, month } = formatToDateBlock(tx.date);
          return (
            <div key={tx.id} className="flex items-center justify-between p-5 bg-[#0D0D0D] border border-white/[0.03] rounded-3xl group">
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center justify-center bg-[#151515] w-12 h-12 rounded-2xl border border-white/5 shrink-0">
                  <span className="text-[10px] font-bold text-[#525252] uppercase leading-none mb-1">{month}</span>
                  <span className="text-sm font-black text-white leading-none">{day}</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white tracking-wide">{tx.description}</h4>
                  <p className="text-[10px] font-bold text-[#525252] uppercase mt-1 tracking-widest leading-none">{tx.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-black whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-500' : 'text-white'}`}>
                  {tx.type === 'income' ? '+' : '-'}₹{tx.amount}
                </span>
                <button onClick={() => handleDelete(tx.id)} className="text-[#525252] hover:text-rose-500 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
        {sortedData.length === 0 && <p className="text-center text-[#525252] text-sm py-10">No entries for this period.</p>}
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
    <div className="animate-fade-in space-y-6">
      <div className="mb-8 px-2"><h2 className="text-2xl font-black tracking-tight">Budgets</h2></div>
      {Object.keys(budgets).map(category => {
        const limit = budgets[category] || 0; const spent = currentExpenses[category] || 0;
        const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : (spent > 0 ? 100 : 0);
        let statusColor = percentage > 75 ? "bg-[#f59e0b]" : "bg-[#10b981]"; 
        let textColor = percentage > 75 ? "text-[#f59e0b]" : "text-[#10b981]";
        if (percentage >= 100) { statusColor = "bg-[#ef4444]"; textColor = "text-[#ef4444]"; }

        return (
          <div key={category} className="bg-[#0D0D0D] p-6 rounded-[2rem] border border-white/[0.05]">
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-bold text-white text-lg tracking-wide">{category}</h3>
              <div className="text-right">
                <span className={`text-sm font-black ${textColor}`}>{percentage.toFixed(0)}%</span>
                <p className="text-[9px] uppercase tracking-[0.2em] text-[#525252]">Consumed</p>
              </div>
            </div>
            <div className="w-full bg-[#1A1A1A] rounded-full h-1.5 mb-6 overflow-hidden">
              <div className={`h-full rounded-full ${statusColor} transition-all duration-1000`} style={{ width: `${percentage}%` }}></div>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[9px] uppercase tracking-[0.2em] text-[#525252] mb-1">Spent</p>
                <p className="font-bold text-white text-sm">₹{spent.toLocaleString('en-IN')}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-[0.2em] text-[#525252] mb-1">Limit</p>
                <div className="flex items-center justify-end"><span className="text-[#525252] mr-1 text-xs">₹</span><input type="number" value={limit} onChange={(e) => handleUpdateBudget(category, e.target.value)} className="w-16 bg-transparent outline-none font-bold text-white text-sm text-right" /></div>
              </div>
            </div>
          </div>
        );
      })}
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
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between mb-8 px-2">
        <h2 className="text-2xl font-black tracking-tight">Targets</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"><Plus className="w-5 h-5 text-white" /></button>
      </div>
      {showAdd && (
        <div className="bg-[#0D0D0D] border border-white/[0.05] p-6 rounded-[2rem] shadow-2xl mb-8">
           <form onSubmit={handleAdd} className="space-y-4">
             <div className="space-y-1.5"><label className="text-[10px] font-bold text-[#525252] uppercase tracking-widest">Goal Name</label><input required type="text" value={newGoal.name} onChange={e=>setNewGoal({...newGoal, name: e.target.value})} className="w-full px-4 py-3 bg-[#151515] border border-white/[0.05] rounded-xl outline-none text-white text-sm" /></div>
             <div className="space-y-1.5"><label className="text-[10px] font-bold text-[#525252] uppercase tracking-widest">Target Amount (₹)</label><input required type="number" value={newGoal.target} onChange={e=>setNewGoal({...newGoal, target: e.target.value})} className="w-full px-4 py-3 bg-[#151515] border border-white/[0.05] rounded-xl outline-none text-white text-sm" /></div>
             <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest mt-2">Create Target</button>
           </form>
        </div>
      )}
      <div className="space-y-4">
        {goals.map(goal => {
          const percent = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
          return (
            <div key={goal.id} className="bg-[#0D0D0D] border border-white/[0.05] p-6 rounded-[2rem]">
              <div className="flex justify-between items-start mb-5">
                <h3 className="text-lg font-bold text-white">{goal.name}</h3>
                <span className="text-xl font-black" style={{ color: goal.color }}>{percent.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-[#1A1A1A] rounded-full h-1.5 mb-5 overflow-hidden"><div className="h-full rounded-full transition-all duration-1000" style={{ width: `${percent}%`, backgroundColor: goal.color }}></div></div>
              <div className="flex justify-between text-[10px] font-bold text-[#525252] uppercase tracking-widest mb-6"><span>₹{goal.current} Saved</span><span>₹{goal.target} Target</span></div>
              <div className="flex gap-3">
                <button onClick={() => addFunds(goal, 500)} className="flex-1 py-3 text-xs font-bold uppercase tracking-widest bg-[#151515] text-white rounded-xl hover:bg-[#202020] transition-colors">+ ₹500</button>
                <button onClick={() => deleteGoal(goal.id)} className="px-4 bg-[#151515] text-[#525252] hover:text-rose-500 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
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
function AIAssistantView({ transactions, analytics, profile, selectedMonth }) {
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
      let liveWebData = "";
      if (["market", "nifty", "stock", "news"].some(w => text.toLowerCase().includes(w))) liveWebData = await searchWeb(text);
      const finData = transactions.length > 0 ? transactions.map(t => `- ${t.type}: ₹${t.amount} on ${t.category}`).join('\n') : "No data.";
      const ctx = aiMessages.slice(-3).map(m => `${m.role}: ${m.text}`).join('\n');
      
      const prompt = `You are NeoFin AI, an elite wealth advisor. TONE: Sharp, professional, concise. No fluff. No step-by-step math explanations. Give final numbers. 
      USER DATA: ${finData}
      WEB: ${liveWebData}
      HISTORY: ${ctx}`;
      
      const res = await callGeminiAPI(text, prompt);
      setAiMessages(prev => [...prev, { role: 'ai', text: res }]);
    } catch (e) { setAiMessages(prev => [...prev, { role: 'ai', text: "Connection error." }]); } 
    finally { setIsAiLoading(false); }
  };

  return (
    <div className="h-[calc(100vh-14rem)] flex flex-col animate-fade-in bg-[#0D0D0D] border border-white/[0.05] rounded-[2.5rem] overflow-hidden relative shadow-2xl shadow-black">
      <div className="bg-[#151515] p-5 flex items-center justify-between border-b border-white/[0.05]">
        <div className="flex items-center gap-3"><Sparkles className="w-5 h-5 text-blue-500" /><h2 className="font-black text-sm uppercase tracking-widest text-white">NeoFin Intelligence</h2></div>
        <button onClick={() => setAiMessages([{ role: 'ai', text: "Memory cleared. Standing by." }])} className="text-[#525252] hover:text-white transition-colors"><Trash2 className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {aiMessages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-[#151515] text-[#A3A3A3] border border-white/[0.05] rounded-tl-sm'}`}>
               <span dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
            </div>
          </div>
        ))}
        {isAiLoading && <div className="flex justify-start"><div className="w-8 h-8 rounded-full bg-[#151515] flex items-center justify-center"><Sparkles className="w-4 h-4 text-blue-500 animate-spin" /></div></div>}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 bg-[#151515] border-t border-white/[0.05]">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(aiInput); }} className="relative flex items-center">
          <input type="text" value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder="Query intelligence..." className="w-full pl-5 pr-14 py-4 bg-[#0D0D0D] border border-white/[0.05] rounded-xl outline-none text-white text-sm" disabled={isAiLoading} />
          <button type="submit" disabled={!aiInput.trim() || isAiLoading} className="absolute right-2 p-2.5 bg-blue-600 text-white rounded-lg disabled:opacity-50"><Send className="w-4 h-4" /></button>
        </form>
      </div>
    </div>
  );
}
