import React, { useEffect } from 'react';
import { ArrowRight, Lock, Activity, Compass, Target } from 'lucide-react';

// Crisp, lightweight Google 'G' SVG
const GoogleLogo = () => (
  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export default function WelcomeScreen({ onLogin }) {
  // Force dark mode for the preview to show off the premium OLED look
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const handleLogin = () => {
    if (onLogin) {
      onLogin();
    } else {
      alert("Authentication sequence initiated.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#02040A] flex flex-col items-center justify-center p-6 text-gray-900 dark:text-white relative overflow-hidden transition-colors duration-500 ease-out">
      
      {/* Background Texture */}
      <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-0"></div>

      {/* Subtle Premium Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[100vw] h-[100vw] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center animate-page-enter">
        
        {/* Elite Logo */}
        <div className="flex items-center gap-2.5 mb-8 stagger-1">
          <span className="text-4xl font-black tracking-tight italic text-gray-900 dark:text-white">NeoFin</span>
          <div className="h-2 w-2 rounded-full bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)]"></div>
        </div>

        {/* Hero Typography */}
        <div className="text-center mb-10 w-full">
          <p className="text-[10px] font-bold text-gray-500 dark:text-[#525252] uppercase tracking-[0.4em] mb-3 stagger-2">Wealth Architecture</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-[1.15] mb-5 stagger-2">
            Command your <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-400 dark:to-indigo-500">
              capital.
            </span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium max-w-[280px] mx-auto leading-relaxed stagger-3">
            The private ledger and intelligence engine for the modern investor.
          </p>
        </div>

        {/* Value Propositions */}
        <div className="w-full space-y-3 mb-10 stagger-3">
           <div className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] shadow-sm dark:shadow-none transition-all duration-300 hover:border-gray-300 dark:hover:border-white/10">
             <div className="w-11 h-11 rounded-xl bg-gray-50 dark:bg-[#151515] flex items-center justify-center border border-gray-100 dark:border-white/[0.02]">
               <Activity className="w-5 h-5 text-gray-900 dark:text-white" />
             </div>
             <div>
               <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-0.5">Real-Time Ledger</h3>
               <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Track liquidity instantly.</p>
             </div>
           </div>

           <div className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] shadow-sm dark:shadow-none transition-all duration-300 hover:border-gray-300 dark:hover:border-white/10">
             <div className="w-11 h-11 rounded-xl bg-gray-50 dark:bg-[#151515] flex items-center justify-center border border-gray-100 dark:border-white/[0.02]">
               <Target className="w-5 h-5 text-gray-900 dark:text-white" />
             </div>
             <div>
               <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-0.5">Smart Targets</h3>
               <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Accelerate your savings.</p>
             </div>
           </div>

           <div className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-[#0D0D0D] border border-gray-200 dark:border-white/[0.05] shadow-sm dark:shadow-none transition-all duration-300 hover:border-gray-300 dark:hover:border-white/10">
             <div className="w-11 h-11 rounded-xl bg-gray-50 dark:bg-[#151515] flex items-center justify-center border border-gray-100 dark:border-white/[0.02]">
               <Compass className="w-5 h-5 text-gray-900 dark:text-white" />
             </div>
             <div>
               <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-0.5">AI Strategy</h3>
               <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Proactive wealth insights.</p>
             </div>
           </div>
        </div>

        {/* Authentication Button */}
        <div className="w-full stagger-4">
          <button 
            onClick={handleLogin}
            className="group relative w-full flex items-center justify-center py-4 bg-gray-900 dark:bg-white text-white dark:text-black rounded-2xl transition-all duration-300 ease-out hover:scale-[1.02] active:scale-95 shadow-xl dark:shadow-[0_0_30px_rgba(255,255,255,0.1)]"
          >
            {/* Absolute positioning keeps the logo anchored to the left without disrupting the text centering */}
            <div className="absolute left-5 flex items-center justify-center">
              <GoogleLogo />
            </div>
            
            <span className="font-bold uppercase tracking-widest text-[11px] sm:text-xs">Authenticate with Google</span>
            
            {/* Absolute positioning keeps the arrow anchored to the right */}
            <div className="absolute right-5 flex items-center justify-center">
              <ArrowRight className="w-4 h-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
            </div>
          </button>
        </div>

        <p className="mt-5 text-[10px] font-bold text-gray-400 dark:text-[#525252] uppercase tracking-widest flex items-center gap-1.5 stagger-4">
          <Lock className="w-3 h-3" /> Encrypted Session
        </p>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pageEnter { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-page-enter { animation: pageEnter 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .stagger-1 { animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.1s; opacity: 0; }
        .stagger-2 { animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.2s; opacity: 0; }
        .stagger-3 { animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.3s; opacity: 0; }
        .stagger-4 { animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.4s; opacity: 0; }
      `}} />
    </div>
  );
}
