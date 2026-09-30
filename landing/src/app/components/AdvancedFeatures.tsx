import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Brain, AlertTriangle, Workflow, BarChart3, Bell, Lock, Monitor, TrendingUp } from "lucide-react";

const advanced = [
  { icon: Brain, title: "AI Productivity Insights", desc: "Smart recommendations powered by machine learning to optimize team output.", color: "from-violet-500 to-purple-600" },
  { icon: AlertTriangle, title: "Deadline Risk Prediction", desc: "Predict project delays before they happen with intelligent risk scoring.", color: "from-amber-400 to-orange-500" },
  { icon: Workflow, title: "Workflow Automation", desc: "Automate repetitive tasks and approvals to save hours every week.", color: "from-[#4F46E5] to-[#6366F1]" },
  { icon: BarChart3, title: "Business Intelligence", desc: "Enterprise-grade BI dashboards with drill-down reporting capabilities.", color: "from-teal-400 to-emerald-500" },
  { icon: Bell, title: "Real-Time Notifications", desc: "Instant alerts for critical events across all modules and teams.", color: "from-sky-400 to-blue-500" },
  { icon: Lock, title: "Custom Permissions", desc: "Granular role-based access control to secure sensitive business data.", color: "from-slate-500 to-slate-700" },
  { icon: Monitor, title: "Smart Workforce Monitoring", desc: "Live activity tracking and productivity scoring for remote and in-office teams.", color: "from-rose-400 to-pink-500" },
  { icon: TrendingUp, title: "Performance Analytics", desc: "Individual and team performance dashboards with actionable insights.", color: "from-indigo-400 to-[#4F46E5]" },
];

export function AdvancedFeatures() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-24 bg-gradient-to-br from-[#1E1B4B] to-[#2D2A6E] relative overflow-hidden">
      {/* BG decoration */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-[#4F46E5] rounded-full opacity-10 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#818CF8] rounded-full opacity-10 blur-3xl translate-x-1/2 translate-y-1/2" />

      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-white/10 text-[#818CF8] text-sm font-semibold px-4 py-2 rounded-full mb-4 border border-white/10">
            Premium Intelligence
          </span>
          <h2 className="text-4xl font-black text-white mb-4">
            Advanced Features for Modern Teams
          </h2>
          <p className="text-[#A5B4FC] text-lg max-w-2xl mx-auto">
            Go beyond basic management with AI-powered tools built for enterprises that demand more.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {advanced.map((a, i) => (
            <motion.div
              key={a.title}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.06 * i }}
              whileHover={{ scale: 1.04, boxShadow: "0 0 40px rgba(129,140,248,0.2)" }}
              className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm cursor-pointer transition-all duration-300 group"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <a.icon size={20} className="text-white" />
              </div>
              <h3 className="font-bold text-white text-base mb-2">{a.title}</h3>
              <p className="text-[#A5B4FC] text-sm leading-relaxed">{a.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
