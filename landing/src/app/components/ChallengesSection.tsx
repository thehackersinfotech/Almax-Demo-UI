import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Eye, AlertCircle, BarChart2, Users } from "lucide-react";

const challenges = [
  {
    icon: Eye,
    title: "Task Visibility",
    desc: "Difficulty tracking employee progress across projects and departments.",
    color: "from-[#4F46E5] to-[#6366F1]",
    bg: "bg-[#EEF2FF]",
    emoji: "🔍",
  },
  {
    icon: AlertCircle,
    title: "Missed Deadlines",
    desc: "Lack of centralized monitoring leads to project delays and missed targets.",
    color: "from-rose-500 to-pink-500",
    bg: "bg-rose-50",
    emoji: "⏰",
  },
  {
    icon: BarChart2,
    title: "Productivity Measurement",
    desc: "Limited workforce insights make it hard to identify bottlenecks and optimize performance.",
    color: "from-amber-400 to-orange-500",
    bg: "bg-amber-50",
    emoji: "📊",
  },
  {
    icon: Users,
    title: "Team Coordination",
    desc: "Communication gaps across departments reduce efficiency and collaboration.",
    color: "from-teal-400 to-emerald-500",
    bg: "bg-teal-50",
    emoji: "🤝",
  },
];

export function ChallengesSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-rose-50 text-rose-500 text-sm font-semibold px-4 py-2 rounded-full mb-4">
            The Problem
          </span>
          <h2 className="text-4xl font-black text-[#1E1B4B] mb-4">
            Challenges Growing Businesses Face
          </h2>
          <p className="text-[#475569] text-lg max-w-2xl mx-auto">
            Without a unified platform, businesses struggle with fragmented tools and siloed data.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {challenges.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.12 }}
              whileHover={{ y: -8, boxShadow: "0 20px 60px rgba(79,70,229,0.12)" }}
              className="group bg-white rounded-3xl p-8 border border-[#E0E7FF] shadow-sm cursor-pointer transition-all duration-300"
            >
              <div className={`w-16 h-16 rounded-2xl ${c.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <span className="text-3xl">{c.emoji}</span>
              </div>
              <h3 className="text-xl font-bold text-[#1E1B4B] mb-3">{c.title}</h3>
              <p className="text-[#475569] leading-relaxed">{c.desc}</p>
              <div className={`mt-6 h-1 w-12 rounded-full bg-gradient-to-r ${c.color} group-hover:w-full transition-all duration-500`} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
