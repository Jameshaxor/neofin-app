import React, { useState, useEffect } from 'react';

export default function WelcomeScreen({ onLogin }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [isButtonPressed, setIsButtonPressed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const features = [
    {
      id: 0,
      title: "Track Wealth",
      desc: "Monitor cash flow & budgets",
      baseColor: "text-emerald-400",
      bgHover: "hover:bg-emerald-500/[0.03]",
      borderHover: "group-hover:border-emerald-500/30",
      glowClass: "shadow-[0_0_30px_rgba(52,211,153,0)] group-hover:shadow-[0_0_30px_rgba(52,211,153,0.15)]",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      )
    },
    {
      id: 1,
      title: "AI Advisor",
      desc: "Personalized financial guidance",
      baseColor: "text-purple-400",
      bgHover: "hover:bg-purple-500/[0.03]",
      borderHover: "group-hover:border-purple-500/30",
      glowClass: "shadow-[0_0_30px_rgba(168,85,247,0)] group-hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      )
    },
    {
      id: 2,
      title: "Cloud Sync",
      desc: "Securely access anywhere",
      baseColor: "text-blue-400",
      bgHover: "hover:bg-blue-500/[0.03]",
      borderHover: "group-hover:border-blue-500/30",
      glowClass: "shadow-[0_0_30px_rgba(59,130,246,0)] group-hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012-2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
    }
  ];

  return (
    <div className="relative min-h-screen bg-[#02040A] text-white flex flex-col justify-center items-center p-4 font-sans selection:bg-white/20 overflow-hidden">
      
      {/* Subtle dotted grid for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      
      {/* Ambient Orbs */}
      <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none animate-[spin_20s_linear_infinite] mix-blend-screen"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[40vw] h-[40vw] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none animate-[spin_25s_linear_infinite_reverse] mix-blend-screen"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[50vw] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none animate-[pulse_10s_ease-in-out_infinite] mix-blend-screen"></div>

      <div className="relative z-10 w-full max-w-[420px] bg-[#0A0D14]/80 backdrop-blur-3xl rounded-[2.5rem] p-8 pb-10 flex flex-col shadow-2xl shadow-black border border-white/[0.08] min-h-[750px] justify-between">
        
        {/* Glow overlay */}
        <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none overflow-hidden">
          <div className={`absolute w-full h-full bg-gradient-to-b from-transparent via-white/[0.02] to-transparent transition-opacity duration-700 ${hoveredFeature !== null ? 'opacity-100' : 'opacity-0'}`}></div>
        </div>

        {/* Header & Logo */}
        <div className={`relative z-10 flex flex-col items-center mt-6 transform transition-all duration-[1200ms] ease-[cubic-bezier(0.23,1,0.32,1)] ${isLoaded ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-12 opacity-0 scale-95'}`}>
          <div className="relative group mb-6">
            <div className="absolute -inset-2 bg-gradient-to-tr from-blue-500 to-emerald-400 rounded-3xl blur-[14px] opacity-20 group-hover:opacity-40 transition duration-700"></div>
            <div className="relative w-20 h-20 rounded-[1.5rem] bg-gradient-to-b from-white/10 to-transparent flex items-center justify-center border border-white/10 shadow-inner">
              <svg className="w-10 h-10 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z" />
              </svg>
            </div>
          </div>
          
          <h1 className="text-[2.75rem] font-extrabold tracking-tight mb-3 text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40">NeoFin</h1>
          <p className="text-gray-400/90 text-[15px] font-medium mb-8 text-center tracking-wide">Master your money with <br/>AI-driven insights.</p>
        </div>

        {/* Features List */}
        <div className="relative z-10 flex flex-col gap-4 mb-10 w-full">
          {features.map((feature, index) => (
            <div 
              key={feature.id}
              onMouseEnter={() => setHoveredFeature(feature.id)}
              onMouseLeave={() => setHoveredFeature(null)}
              className={`group flex items-center gap-5 p-4 rounded-2xl cursor-default transition-all duration-[800ms] ease-[cubic-bezier(0.23,1,0.32,1)] ${feature.bgHover} border border-transparent ${feature.borderHover} ${isLoaded ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-12 opacity-0 scale-95'}`}
              style={{ transitionDelay: `${(index + 1) * 150}ms` }}
            >
              <div className={`relative w-14 h-14 rounded-[14px] flex items-center justify-center shrink-0 bg-white/[0.03] border border-white/5 transition-all duration-500 group-hover:scale-110 group-hover:bg-white/[0.06] ${feature.glowClass}`}>
                <div className={`${feature.baseColor} transition-transform duration-500 group-hover:scale-110 drop-shadow-md`}>{feature.icon}</div>
              </div>
              <div className="flex flex-col text-left transition-transform duration-500 group-hover:translate-x-1">
                <h3 className="text-white font-semibold text-[17px] tracking-wide mb-1 transition-colors duration-300">{feature.title}</h3>
                <p className="text-gray-400 text-[13px] font-medium transition-colors duration-300 group-hover:text-gray-300">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Action Button & Footer */}
        <div className={`relative z-10 flex flex-col items-center mt-auto transform transition-all duration-[1200ms] ease-[cubic-bezier(0.23,1,0.32,1)] delay-[700ms] ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
          <button 
            onMouseDown={() => setIsButtonPressed(true)}
            onMouseUp={() => setIsButtonPressed(false)}
            onMouseLeave={() => setIsButtonPressed(false)}
            onTouchStart={() => setIsButtonPressed(true)}
            onTouchEnd={() => setIsButtonPressed(false)}
            onClick={onLogin} 
            className={`group relative flex items-center justify-center gap-4 px-8 py-[18px] w-full rounded-2xl bg-[#141824] border border-white/10 overflow-hidden transition-all duration-300 ${isButtonPressed ? 'scale-[0.97] shadow-none' : 'shadow-[0_8px_30px_rgba(0,0,0,0.5)] hover:shadow-[0_8px_30px_rgba(255,255,255,0.1)] hover:border-white/20'}`}
          >
            <div className={`absolute inset-0 bg-white transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] z-0 ${isButtonPressed ? 'translate-y-0 scale-y-100' : 'translate-y-[110%] scale-y-50'} md:group-hover:translate-y-0 md:group-hover:scale-y-100 origin-bottom`}></div>

            <div className={`relative z-10 flex items-center gap-3 transition-colors duration-300 ${isButtonPressed ? 'text-black' : 'text-white'} md:group-hover:text-black`}>
              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center p-[2px] shadow-sm transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
                <svg className="w-full h-full" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              </div>
              <span className="font-bold text-[16px] tracking-wide">Continue with Google</span>
            </div>
          </button>

          <p className="mt-6 text-[12px] text-gray-500 font-medium tracking-wide flex items-center gap-1.5 opacity-80">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Bank-grade encryption synced securely.
          </p>
        </div>

      </div>
    </div>
  );
}
