import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { CheckCircle } from "lucide-react";

const features = [
  {
    emoji: "✅",
    title: "Task Management",
    color: "from-[#4F46E5] to-[#6366F1]",
    bg: "bg-[#EEF2FF]",
    items: ["Task Assignment", "Milestone Tracking", "Collaboration Boards", "Team Calendar"],
  },
  {
    emoji: "🤝",
    title: "CRM",
    color: "from-teal-400 to-emerald-500",
    bg: "bg-teal-50",
    items: ["Client Database", "Lead Management", "Deal Pipeline", "Communication Logs"],
  },
  {
    emoji: "⏰",
    title: "Workforce Management",
    color: "from-amber-400 to-orange-500",
    bg: "bg-amber-50",
    items: ["Attendance Tracking", "Check-In / Check-Out", "Shift Scheduling", "Overtime Tracking"],
  },
  {
    emoji: "🌴",
    title: "Leave Management",
    color: "from-sky-400 to-blue-500",
    bg: "bg-sky-50",
    items: ["Leave Requests", "Approvals", "Leave Balance Tracking"],
  },
  {
    emoji: "💰",
    title: "Payroll",
    color: "from-violet-400 to-purple-600",
    bg: "bg-violet-50",
    items: ["Salary Processing", "TDS Calculation", "PF Calculation", "Payslip Generation"],
  },
  {
    emoji: "👥",
    title: "Employee Lifecycle",
    color: "from-rose-400 to-pink-500",
    bg: "bg-rose-50",
    items: ["Onboarding", "Role Assignment", "Employee Self-Service", "Offboarding"],
  },
  {
    emoji: "📦",
    title: "Inventory Management",
    color: "from-indigo-400 to-[#4F46E5]",
    bg: "bg-indigo-50",
    items: ["Inventory Tracking", "Asset Management", "Stock Monitoring", "Vendor Management", "Low Stock Alerts", "Inventory Reports"],
  },
  {
    emoji: "🔒",
    title: "Security",
    color: "from-slate-600 to-slate-800",
    bg: "bg-slate-50",
    items: ["RBAC", "Audit Trails", "User Access Management", "Activity Monitoring"],
  },
];

export function FeaturesSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="solutions" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-[#EEF2FF] text-[#4F46E5] text-sm font-semibold px-4 py-2 rounded-full mb-4">
            Feature Suite
          </span>
          <h2 className="text-4xl font-black text-[#1E1B4B] mb-4">
            Comprehensive Feature Suite
          </h2>
          <p className="text-[#475569] text-lg max-w-2xl mx-auto">
            Every tool your team needs — built into one coherent, powerful platform.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.05 * i }}
              whileHover={{ y: -6, boxShadow: "0 20px 50px rgba(79,70,229,0.10)" }}
              className="group bg-white rounded-3xl p-6 border border-[#E0E7FF] shadow-sm transition-all duration-300"
            >
              <div className={`w-14 h-14 ${f.bg} rounded-2xl flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform`}>
                {f.emoji}
              </div>
              <h3 className="font-bold text-[#1E1B4B] text-lg mb-4">{f.title}</h3>
              <ul className="space-y-2">
                {f.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-[#475569]">
                    <CheckCircle size={14} className="text-[#4F46E5] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className={`mt-5 h-1 w-8 rounded-full bg-gradient-to-r ${f.color} group-hover:w-full transition-all duration-500`} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
