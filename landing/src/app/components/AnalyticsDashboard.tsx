import { useRef } from "react";
import { motion, useInView } from "motion/react";
import {
  LineChart, Line, BarChart, Bar, RadialBarChart, RadialBar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const payrollData = [
  { month: "Jan", amount: 420 }, { month: "Feb", amount: 440 }, { month: "Mar", amount: 430 },
  { month: "Apr", amount: 460 }, { month: "May", amount: 480 }, { month: "Jun", amount: 510 },
];
const performanceData = [
  { name: "Engineering", score: 88 }, { name: "Sales", score: 76 }, { name: "HR", score: 92 },
  { name: "Operations", score: 81 }, { name: "Finance", score: 85 },
];
const revenueData = [
  { month: "Jan", crm: 120, inventory: 80 }, { month: "Feb", crm: 140, inventory: 95 },
  { month: "Mar", crm: 130, inventory: 88 }, { month: "Apr", crm: 165, inventory: 110 },
  { month: "May", crm: 180, inventory: 125 }, { month: "Jun", crm: 210, inventory: 140 },
];
const kpiRadial = [
  { name: "Task Completion", value: 87, fill: "#4F46E5" },
  { name: "Attendance Rate", value: 93, fill: "#6366F1" },
  { name: "CRM Conversion", value: 68, fill: "#818CF8" },
  { name: "Inventory Accuracy", value: 96, fill: "#A5B4FC" },
];

export function AnalyticsDashboard() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-24 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-[#EEF2FF] text-[#4F46E5] text-sm font-semibold px-4 py-2 rounded-full mb-4">
            Enterprise Analytics
          </span>
          <h2 className="text-4xl font-black text-[#1E1B4B] mb-4">
            Data-Driven Workforce Intelligence
          </h2>
          <p className="text-[#475569] text-lg max-w-2xl mx-auto">
            Turn workforce data into actionable insights with real-time dashboards and predictive analytics.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Payroll trends */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-3xl p-6 border border-[#E0E7FF] shadow-sm"
          >
            <div className="font-bold text-[#1E1B4B] mb-1">Payroll Analytics</div>
            <div className="text-sm text-[#475569] mb-4">Monthly payroll spend (₹000s)</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={payrollData}>
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #E0E7FF", fontSize: 12 }} />
                <Line type="monotone" dataKey="amount" stroke="#4F46E5" strokeWidth={3} dot={{ r: 5, fill: "#4F46E5" }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Employee performance */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.25 }}
            className="bg-white rounded-3xl p-6 border border-[#E0E7FF] shadow-sm"
          >
            <div className="font-bold text-[#1E1B4B] mb-1">Department Performance</div>
            <div className="text-sm text-[#475569] mb-4">Average performance score by department</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={performanceData} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis domain={[60, 100]} tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #E0E7FF", fontSize: 12 }} />
                <Bar dataKey="score" fill="#6366F1" radius={[8, 8, 0, 0]} name="Score" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Revenue pipeline */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-3xl p-6 border border-[#E0E7FF] shadow-sm"
          >
            <div className="font-bold text-[#1E1B4B] mb-1">Revenue Pipeline</div>
            <div className="text-sm text-[#475569] mb-4">CRM revenue vs Inventory revenue (₹000s)</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueData} barCategoryGap="30%">
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #E0E7FF", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="crm" fill="#4F46E5" radius={[6, 6, 0, 0]} name="CRM Revenue" />
                <Bar dataKey="inventory" fill="#A5B4FC" radius={[6, 6, 0, 0]} name="Inventory Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* KPI radial */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.35 }}
            className="bg-white rounded-3xl p-6 border border-[#E0E7FF] shadow-sm"
          >
            <div className="font-bold text-[#1E1B4B] mb-1">KPI Monitoring</div>
            <div className="text-sm text-[#475569] mb-4">Key performance indicators at a glance</div>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={180} height={180}>
                <RadialBarChart innerRadius={20} outerRadius={80} data={kpiRadial} startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "#F1F5F9" }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {kpiRadial.map((k) => (
                  <div key={k.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: k.fill }} />
                      <span className="text-sm text-[#475569]">{k.name}</span>
                    </div>
                    <span className="text-sm font-bold text-[#1E1B4B]">{k.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
