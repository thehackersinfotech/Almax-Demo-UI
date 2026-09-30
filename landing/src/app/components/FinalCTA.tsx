import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { ArrowRight, Phone } from "lucide-react";

export function FinalCTA() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      id="contact"
      className="py-28 bg-gradient-to-br from-[#1E1B4B] via-[#2D2A6E] to-[#4F46E5] relative overflow-hidden"
    >
      {/* Decorative blobs */}
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 6, repeat: Infinity }}
        className="absolute top-0 left-1/4 w-80 h-80 bg-[#818CF8] rounded-full blur-3xl"
      />
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 8, repeat: Infinity, delay: 2 }}
        className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#6366F1] rounded-full blur-3xl"
      />

      {/* Floating icons */}
      {["📊", "✅", "💰", "📦", "🤝", "⚡"].map((emoji, i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
          transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.7 }}
          className="absolute text-3xl opacity-20 pointer-events-none select-none"
          style={{
            left: `${10 + i * 15}%`,
            top: `${20 + (i % 2) * 50}%`,
          }}
        >
          {emoji}
        </motion.div>
      ))}

      <div className="relative max-w-4xl mx-auto px-6 text-center" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="space-y-8"
        >
          <span className="inline-block bg-white/10 text-[#A5B4FC] text-sm font-semibold px-4 py-2 rounded-full border border-white/10">
            Get Started Today
          </span>

          <h2 className="text-5xl font-black text-white leading-tight">
            Transform Workforce Productivity<br />
            <span className="bg-gradient-to-r from-[#818CF8] to-[#C7D2FE] bg-clip-text text-transparent">
              with Hackers Infotech
            </span>
          </h2>

          <p className="text-[#A5B4FC] text-xl max-w-2xl mx-auto leading-relaxed">
            Manage your employees, tasks, payroll, attendance, CRM, inventory, and business productivity through one unified platform.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <motion.a
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              href="https://docs.google.com/forms/d/e/1FAIpQLSewsGyCmlZkT7i-uJpclxMltrsQMwoKiW2jgRRJKk2SS72rrQ/viewform"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white text-[#4F46E5] font-bold text-lg shadow-2xl hover:shadow-white/20 transition-all"
            >
              Let's Connect <ArrowRight size={20} />
            </motion.a>
            <motion.a
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              href="https://docs.google.com/forms/d/e/1FAIpQLSewsGyCmlZkT7i-uJpclxMltrsQMwoKiW2jgRRJKk2SS72rrQ/viewform"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl border-2 border-white/30 text-white font-bold text-lg hover:bg-white/10 transition-all"
            >
              <Phone size={18} /> Contact Sales
            </motion.a>
          </div>

        </motion.div>
      </div>
    </section>
  );
}
