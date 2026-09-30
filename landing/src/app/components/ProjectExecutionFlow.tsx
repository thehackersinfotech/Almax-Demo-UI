import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Rocket, Users, Clock, Package, FileText, CheckCircle2 } from "lucide-react";

const steps = [
  {
    step: "01",
    icon: Rocket,
    title: "Kickoff & Milestone Setup",
    desc: "Launch projects, outline custom phases, and assign milestones. Keep target deliverables perfectly tracked.",
    color: "from-indigo-500 to-blue-600",
    shadow: "shadow-indigo-100",
    badgeBg: "bg-indigo-50 text-indigo-600",
    mockup: (
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2.5 shadow-sm text-left">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-[10px] font-bold text-slate-800">Milestone Tracker</span>
          <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full">Active</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
            <span className="line-through opacity-60">Phase 1: DB Schema Setup</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
            <span className="line-through opacity-60">Phase 2: API Integrations</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <div className="w-3.5 h-3.5 rounded-full border border-indigo-500 flex items-center justify-center flex-shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            </div>
            <span className="font-semibold text-slate-800">Phase 3: Frontend Connect</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    step: "02",
    icon: Users,
    title: "Smart Resource Allocation",
    desc: "Allocate qualified team members to project tasks. Monitor workload levels in real-time to avoid developer burnout.",
    color: "from-teal-400 to-emerald-500",
    shadow: "shadow-teal-100",
    badgeBg: "bg-teal-50 text-teal-600",
    mockup: (
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3 shadow-sm text-left">
        <span className="text-[10px] font-bold text-slate-800">Team Workloads</span>
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] text-slate-600 font-medium">
              <span>Rohit S. (Backend)</span>
              <span className="font-bold text-emerald-600">80% Load</span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: "80%" }} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] text-slate-600 font-medium">
              <span>Priya K. (Design)</span>
              <span className="font-bold text-amber-500">95% Load</span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: "95%" }} />
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    step: "03",
    icon: Clock,
    title: "Activity & Time Logging",
    desc: "Developers track daily hours against issues. Timesheets sync directly for client billing and automatic manager approval.",
    color: "from-amber-400 to-orange-500",
    shadow: "shadow-orange-100",
    badgeBg: "bg-orange-50 text-orange-600",
    mockup: (
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2 shadow-sm text-left">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-800">Time Card</span>
          <span className="text-[8px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full">Running</span>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-2.5 flex justify-between items-center">
          <div>
            <div className="text-[9px] text-slate-500">HK-291: API Optimization</div>
            <div className="text-[10px] font-bold text-slate-800">03h 42m 15s</div>
          </div>
          <div className="w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center text-xs">⏱️</div>
        </div>
      </div>
    ),
  },
  {
    step: "04",
    icon: Package,
    title: "Inventory & Asset Dispatch",
    desc: "Seamlessly allocate materials, test items, or company laptops to project members with full stock level monitoring.",
    color: "from-sky-400 to-blue-500",
    shadow: "shadow-blue-100",
    badgeBg: "bg-blue-50 text-blue-600",
    mockup: (
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2 shadow-sm text-left">
        <span className="text-[10px] font-bold text-slate-800">Asset Dispatch</span>
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-2.5 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-semibold text-slate-700">HP ProBook Laptop</span>
            <span className="text-[8px] font-bold text-[#4F46E5] bg-indigo-50 px-1.5 py-0.5 rounded">Sent</span>
          </div>
          <div className="flex justify-between text-[8px] text-slate-500">
            <span>Assignee: Priya K.</span>
            <span>Stock: 14 Left</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    step: "05",
    icon: FileText,
    title: "Automated Billing & Analytics",
    desc: "Convert timesheets and expenses into structured client invoices with automated TDS, tax, and revenue tracking.",
    color: "from-violet-500 to-purple-600",
    shadow: "shadow-purple-100",
    badgeBg: "bg-purple-50 text-purple-600",
    mockup: (
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2.5 shadow-sm text-left">
        <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
          <span className="text-[10px] font-bold text-slate-800">Invoice #INV-2901</span>
          <span className="text-[8px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">Paid</span>
        </div>
        <div className="flex justify-between items-center">
          <div>
            <div className="text-[8px] text-slate-500">Total (82.5 hrs)</div>
            <div className="text-[11px] font-black text-slate-800">₹1,24,500.00</div>
          </div>
          <div className="text-[8px] font-bold text-[#4F46E5]">Receipt →</div>
        </div>
      </div>
    ),
  },
];

export function ProjectExecutionFlow() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <span className="inline-block bg-[#EEF2FF] text-[#4F46E5] text-sm font-semibold px-4 py-2 rounded-full mb-4">
            Operations Logic
          </span>
          <h2 className="text-4xl font-black text-[#1E1B4B] mb-4">
            End-to-End Project Execution Logic
          </h2>
          <p className="text-[#475569] text-lg max-w-2xl mx-auto">
            From project kickoff to automated billing, see how our unified ecosystem coordinates your workspace.
          </p>
        </motion.div>

        {/* Steps Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 relative">
          {/* Connecting Line (Only visible on large screens) */}
          <div className="absolute top-[28%] left-8 right-8 h-0.5 bg-gradient-to-r from-indigo-100 via-emerald-100 to-indigo-100 hidden lg:block z-0 pointer-events-none" />

          {steps.map((s, i) => {
            return (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 + i * 0.12, duration: 0.6 }}
                whileHover={{ y: -8 }}
                className="relative bg-white rounded-3xl p-6 border border-[#E0E7FF] shadow-sm hover:border-[#4F46E5] hover:shadow-xl transition-all duration-300 z-10 flex flex-col justify-between"
              >
                <div>
                  {/* Step bubble */}
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white shadow-lg ${s.shadow}`}>
                      <s.icon size={20} />
                    </div>
                    <span className={`text-xs font-black px-3 py-1 rounded-full ${s.badgeBg}`}>
                      Step {s.step}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#1E1B4B] mb-2 leading-snug">{s.title}</h3>
                  <p className="text-xs text-[#475569] leading-relaxed mb-6 font-medium">{s.desc}</p>
                </div>

                {/* Inline HTML mockup container */}
                <div className="mt-auto pt-2">
                  <div className="border-t border-slate-100 pt-4">
                    {s.mockup}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
