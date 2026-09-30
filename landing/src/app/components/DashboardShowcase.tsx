import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";
import { TrendingUp, Users, Package, DollarSign, CheckCircle, Clock } from "lucide-react";

const productivityData = [
  { month: "Jan", value: 65 }, { month: "Feb", value: 72 }, { month: "Mar", value: 68 },
  { month: "Apr", value: 85 }, { month: "May", value: 78 }, { month: "Jun", value: 92 },
];
const attendanceData = [
  { day: "Mon", present: 92, absent: 8 }, { day: "Tue", present: 88, absent: 12 },
  { day: "Wed", present: 95, absent: 5 }, { day: "Thu", present: 90, absent: 10 },
  { day: "Fri", present: 85, absent: 15 },
];
const crmData = [
  { name: "Leads", value: 40 }, { name: "Qualified", value: 28 }, { name: "Proposals", value: 18 }, { name: "Won", value: 14 },
];
const COLORS = ["#4F46E5", "#6366F1", "#818CF8", "#A5B4FC"];

function CountUp({ end, suffix = "" }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = end / 40;
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 40);
    return () => clearInterval(timer);
  }, [inView, end]);
  return <span ref={ref}>{count}{suffix}</span>;
}

const kpiCards = [
  { icon: CheckCircle, label: "Tasks Completed", value: 1284, suffix: "", color: "text-emerald-500", bg: "bg-emerald-50" },
  { icon: Users, label: "Active Employees", value: 348, suffix: "", color: "text-[#4F46E5]", bg: "bg-[#EEF2FF]" },
  { icon: DollarSign, label: "Payroll Processed", value: 98, suffix: "%", color: "text-amber-500", bg: "bg-amber-50" },
  { icon: Package, label: "Inventory Items", value: 2640, suffix: "", color: "text-teal-500", bg: "bg-teal-50" },
  { icon: TrendingUp, label: "CRM Deals", value: 56, suffix: "", color: "text-violet-500", bg: "bg-violet-50" },
  { icon: Clock, label: "Avg. Task Time", value: 2, suffix: "h", color: "text-rose-500", bg: "bg-rose-50" },
];

export function DashboardShowcase() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="features" className="py-24 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-[#EEF2FF] text-[#4F46E5] text-sm font-semibold px-4 py-2 rounded-full mb-4">
            Live Dashboard
          </span>
          <h2 className="text-4xl font-black text-[#1E1B4B] mb-4">
            Everything You Need In One Dashboard
          </h2>
          <p className="text-[#475569] text-lg max-w-2xl mx-auto">
            Real-time visibility across all your workforce operations — from tasks to payroll to inventory.
          </p>
        </motion.div>

        {/* Dashboard frame */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="bg-white rounded-3xl shadow-2xl border border-[#E0E7FF] overflow-hidden"
        >
          {/* Top bar */}
          <div className="bg-[#1E1B4B] px-6 py-3 flex items-center gap-3">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 bg-[#2D2A6E] rounded-md px-3 py-1 text-xs text-[#818CF8] text-center">
              almax.hackersinfotech.com/dashboard
            </div>
          </div>

          {/* Dashboard content */}
          <div className="p-6 space-y-6">
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {kpiCards.map((k, i) => (
                <motion.div
                  key={k.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={inView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: 0.3 + i * 0.07 }}
                  whileHover={{ scale: 1.04, boxShadow: "0 8px 30px rgba(79,70,229,0.12)" }}
                  className="bg-[#F8FAFC] rounded-2xl p-4 border border-[#E0E7FF] cursor-pointer transition-all"
                >
                  <div className={`w-9 h-9 ${k.bg} rounded-xl flex items-center justify-center mb-3`}>
                    <k.icon size={18} className={k.color} />
                  </div>
                  <div className={`text-2xl font-black ${k.color}`}>
                    <CountUp end={k.value} suffix={k.suffix} />
                  </div>
                  <div className="text-xs text-[#475569] mt-1">{k.label}</div>
                </motion.div>
              ))}
            </div>

            {/* Charts row */}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#F8FAFC] rounded-2xl p-5 border border-[#E0E7FF]">
                <div className="font-semibold text-[#1E1B4B] mb-4">Productivity Trends</div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={productivityData}>
                    <defs>
                      <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #E0E7FF", fontSize: 12 }} />
                    <Area type="monotone" dataKey="value" stroke="#4F46E5" fill="url(#prodGrad)" strokeWidth={2.5} dot={{ r: 4, fill: "#4F46E5" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-[#F8FAFC] rounded-2xl p-5 border border-[#E0E7FF]">
                <div className="font-semibold text-[#1E1B4B] mb-4">CRM Pipeline</div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={crmData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                      {crmData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #E0E7FF", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {crmData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
                      <span className="text-xs text-[#475569]">{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Attendance bar chart */}
            <div className="bg-[#F8FAFC] rounded-2xl p-5 border border-[#E0E7FF]">
              <div className="font-semibold text-[#1E1B4B] mb-4">Attendance Overview This Week</div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={attendanceData} barCategoryGap="30%">
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #E0E7FF", fontSize: 12 }} />
                  <Bar dataKey="present" fill="#4F46E5" radius={[6, 6, 0, 0]} name="Present %" />
                  <Bar dataKey="absent" fill="#E0E7FF" radius={[6, 6, 0, 0]} name="Absent %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
