import { motion } from "motion/react";
import {
  Users, BarChart2, Package, Clock, CheckCircle, TrendingUp,
  Zap, Shield, ArrowRight, Play
} from "lucide-react";

const stats = [
  { value: "90%", label: "Faster Workforce Tracking" },
  { value: "60%", label: "Reduced Admin Work" },
  { value: "Real-Time", label: "Monitoring" },
  { value: "∞", label: "Scalability" },
];

const floatingCards = [
  { icon: BarChart2, label: "Productivity +42%", color: "from-[#4F46E5] to-[#6366F1]", x: "top-8 right-8" },
  { icon: Users, label: "128 Employees Active", color: "from-[#6366F1] to-[#818CF8]", x: "top-40 left-4" },
  { icon: Package, label: "Inventory Synced", color: "from-[#818CF8] to-[#A5B4FC]", x: "bottom-24 right-12" },
  { icon: CheckCircle, label: "32 Tasks Done Today", color: "from-emerald-400 to-teal-500", x: "bottom-8 left-8" },
];

export function HeroSection() {
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center overflow-hidden bg-white pt-20"
    >
      {/* Wave BG */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg
          className="absolute top-0 right-0 w-[70%] h-full opacity-90"
          viewBox="0 0 800 700"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#EEF2FF" />
              <stop offset="60%" stopColor="#E0E7FF" />
              <stop offset="100%" stopColor="#C7D2FE" />
            </linearGradient>
          </defs>
          <path
            d="M200,0 C350,50 500,0 800,80 L800,700 L0,700 L0,200 C100,150 150,80 200,0Z"
            fill="url(#waveGrad)"
          />
          <path
            d="M350,0 C500,80 650,20 800,120 L800,700 L200,700 C300,600 280,500 350,400 C420,300 500,200 350,0Z"
            fill="#E0E7FF"
            opacity="0.5"
          />
        </svg>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          className="space-y-8"
        >
          <div className="inline-flex items-center gap-2 bg-[#EEF2FF] border border-[#C7D2FE] rounded-full px-4 py-2">
            <Zap size={14} className="text-[#4F46E5]" />
            <span className="text-sm font-semibold text-[#4F46E5]">Workforce Intelligence Platform</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl lg:text-6xl font-black text-[#1E1B4B] leading-tight">
              One Platform.<br />
              <span className="bg-gradient-to-r from-[#4F46E5] to-[#818CF8] bg-clip-text text-transparent">
                All Your Workforce
              </span>{" "}
              Needs.
            </h1>
            <p className="text-lg text-[#475569] leading-relaxed max-w-lg">
              Manage Tasks, Employees, Attendance, Payroll, CRM, Inventory Management, and Workforce Productivity through one intelligent platform.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <motion.a
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              href="https://docs.google.com/forms/d/e/1FAIpQLSewsGyCmlZkT7i-uJpclxMltrsQMwoKiW2jgRRJKk2SS72rrQ/viewform"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#6366F1] text-white font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all"
            >
              Let's Connect <ArrowRight size={18} />
            </motion.a>
            <motion.a
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              href="https://docs.google.com/forms/d/e/1FAIpQLSewsGyCmlZkT7i-uJpclxMltrsQMwoKiW2jgRRJKk2SS72rrQ/viewform"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl border-2 border-[#4F46E5] text-[#4F46E5] font-bold hover:bg-[#EEF2FF] transition-all"
            >
              <Play size={16} fill="currentColor" /> Contact Sales
            </motion.a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 pt-4">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="bg-white rounded-2xl p-4 border border-[#E0E7FF] shadow-sm"
              >
                <div className="text-2xl font-black text-[#4F46E5]">{s.value}</div>
                <div className="text-sm text-[#475569] mt-1">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Right – Illustration */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative h-[520px] hidden lg:block"
        >
          {/* Central illustration placeholder */}
          <div className="absolute inset-8 rounded-3xl bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] flex items-center justify-center overflow-hidden">
            {/* SVG Illustration */}
            <svg viewBox="0 0 400 340" className="w-full h-full p-8" xmlns="http://www.w3.org/2000/svg">
              {/* Desk */}
              <rect x="60" y="220" width="280" height="12" rx="4" fill="#C7D2FE" />
              <rect x="80" y="232" width="8" height="60" rx="4" fill="#A5B4FC" />
              <rect x="312" y="232" width="8" height="60" rx="4" fill="#A5B4FC" />
              {/* Monitor */}
              <rect x="100" y="130" width="200" height="90" rx="10" fill="white" stroke="#818CF8" strokeWidth="3" />
              <rect x="110" y="140" width="180" height="70" rx="6" fill="#EEF2FF" />
              {/* Screen bars */}
              <rect x="118" y="152" width="80" height="6" rx="3" fill="#4F46E5" />
              <rect x="118" y="164" width="60" height="4" rx="2" fill="#818CF8" />
              <rect x="118" y="174" width="70" height="4" rx="2" fill="#C7D2FE" />
              <rect x="210" y="148" width="72" height="56" rx="6" fill="white" stroke="#E0E7FF" strokeWidth="1.5" />
              {/* Mini chart */}
              <polyline points="218,194 230,178 242,185 254,165 266,172 278,158" fill="none" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {/* Monitor stand */}
              <rect x="190" y="220" width="20" height="12" rx="2" fill="#A5B4FC" />
              <rect x="175" y="230" width="50" height="6" rx="3" fill="#C7D2FE" />
              {/* Person left */}
              <circle cx="130" cy="108" r="20" fill="#FED7AA" />
              <rect x="112" y="128" width="36" height="44" rx="10" fill="#4F46E5" />
              <rect x="100" y="135" width="14" height="28" rx="7" fill="#FED7AA" />
              <rect x="148" y="135" width="14" height="28" rx="7" fill="#FED7AA" />
              {/* Person right */}
              <circle cx="270" cy="105" r="20" fill="#FBBF24" />
              <rect x="252" y="125" width="36" height="44" rx="10" fill="#6366F1" />
              <rect x="240" y="132" width="14" height="28" rx="7" fill="#FBBF24" />
              <rect x="288" y="132" width="14" height="28" rx="7" fill="#FBBF24" />
              {/* Chat bubbles */}
              <rect x="148" y="80" width="104" height="28" rx="10" fill="white" stroke="#C7D2FE" strokeWidth="1.5" />
              <text x="157" y="99" fontSize="10" fill="#4F46E5" fontWeight="600">📋 Task assigned!</text>
              {/* Floating icons */}
              <rect x="54" y="60" width="36" height="36" rx="10" fill="white" stroke="#E0E7FF" strokeWidth="1.5" />
              <text x="65" y="83" fontSize="16">📊</text>
              <rect x="310" y="72" width="36" height="36" rx="10" fill="white" stroke="#E0E7FF" strokeWidth="1.5" />
              <text x="321" y="95" fontSize="16">🏭</text>
              <rect x="54" y="185" width="36" height="36" rx="10" fill="white" stroke="#E0E7FF" strokeWidth="1.5" />
              <text x="65" y="208" fontSize="16">💼</text>
              <rect x="310" y="175" width="36" height="36" rx="10" fill="white" stroke="#E0E7FF" strokeWidth="1.5" />
              <text x="321" y="198" fontSize="16">✅</text>
            </svg>
          </div>

          {/* Floating badge cards */}
          {floatingCards.map((card, i) => (
            <motion.div
              key={card.label}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
              className={`absolute ${card.x} bg-white rounded-2xl shadow-xl border border-[#E0E7FF] px-4 py-3 flex items-center gap-3`}
            >
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                <card.icon size={16} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-[#1E1B4B] whitespace-nowrap">{card.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
