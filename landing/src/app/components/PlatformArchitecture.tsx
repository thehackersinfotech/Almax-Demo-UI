import { useState, useRef } from "react";
import { motion, useInView } from "motion/react";

const modules = [
  { label: "Task Management", emoji: "✅", angle: 0 },
  { label: "Project Mgmt", emoji: "📋", angle: 36 },
  { label: "CRM", emoji: "🤝", angle: 72 },
  { label: "Attendance", emoji: "⏰", angle: 108 },
  { label: "Leave Mgmt", emoji: "🌴", angle: 144 },
  { label: "Payroll", emoji: "💰", angle: 180 },
  { label: "Employee Lifecycle", emoji: "👥", angle: 216 },
  { label: "Inventory", emoji: "📦", angle: 252 },
  { label: "Analytics", emoji: "📊", angle: 288 },
  { label: "Security", emoji: "🔒", angle: 324 },
];

export function PlatformArchitecture() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  const R = 200; // orbit radius (in px, from center)

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
            Unified Architecture
          </span>
          <h2 className="text-4xl font-black text-[#1E1B4B] mb-4">
            One Ecosystem. All Connected.
          </h2>
          <p className="text-[#475569] text-lg max-w-2xl mx-auto">
            A unified workforce ecosystem designed to streamline operations, improve accountability, and increase productivity.
          </p>
        </motion.div>

        {/* Hub-and-spoke diagram */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative flex items-center justify-center"
          style={{ height: 520 }}
        >
          {/* Centered HTML-based spokes for perfect alignment */}
          {modules.map((mod, i) => {
            const isHovered = hoveredLabel === mod.label;
            return (
              <motion.div
                key={`spoke-${i}`}
                initial={{ width: 0, opacity: 0 }}
                animate={inView ? { 
                  width: R, 
                  opacity: isHovered ? 1 : 0.4,
                  borderTopColor: isHovered ? "#4F46E5" : "#C7D2FE",
                  borderTopWidth: isHovered ? "2.5px" : "1.5px"
                } : {}}
                transition={{
                  width: { delay: 0.4 + i * 0.06, duration: 0.5 },
                  opacity: { duration: 0.25 },
                  borderTopColor: { duration: 0.25 },
                  borderTopWidth: { duration: 0.2 }
                }}
                className="absolute pointer-events-none"
                style={{
                  left: "50%",
                  top: "50%",
                  y: "-50%",
                  rotate: mod.angle - 90,
                  transformOrigin: "left center",
                  borderTopStyle: "dashed",
                  height: 0,
                }}
              />
            );
          })}

          {/* Rotating dashed circles (Outer orbit and Inner hub shield) */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            className="absolute pointer-events-none"
            style={{
              width: "400px",
              height: "400px",
              minWidth: "400px",
              minHeight: "400px",
              maxWidth: "none",
              maxHeight: "none",
              left: "50%",
              top: "50%",
              x: "-50%",
              y: "-50%",
            }}
          >
            {/* Outer orbit circle (passes exactly through the centers of the emojis) */}
            <div className="w-full h-full rounded-full border border-dashed border-[#C7D2FE] opacity-35" />
            
            {/* Inner circle (just outside the center solid blue hub) */}
            <div 
              className="absolute rounded-full border-2 border-dashed border-[#C7D2FE] opacity-40 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" 
              style={{ width: 192, height: 192 }}
            />
          </motion.div>

          {/* Center hub (Framer Motion driven to guarantee alignment with hardware accelerated layers) */}
          <motion.div 
            className="absolute z-10 w-40 h-40 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#818CF8] flex flex-col items-center justify-center shadow-2xl shadow-indigo-200"
            style={{
              left: "50%",
              top: "50%",
              x: "-50%",
              y: "-50%",
              width: 160,
              height: 160,
            }}
          >
            {/* Wiggling and pulsing lightning bolt on hover */}
            <motion.div 
              animate={hoveredLabel ? { scale: [1, 1.25, 1], rotate: [0, 15, -15, 0] } : {}}
              transition={{ duration: 0.5 }}
              className="text-3xl mb-1 select-none"
            >
              ⚡
            </motion.div>
            <div className="text-white font-bold text-center text-sm leading-tight px-2">
              Hackers<br />Infotech
            </div>
          </motion.div>

          {/* Module nodes */}
          {modules.map((mod, i) => {
            const rad = (mod.angle - 90) * (Math.PI / 180);
            // position relative to center — use transform approach
            const x = Math.cos(rad) * R;
            const y = Math.sin(rad) * R;

            return (
              <motion.div
                key={mod.label}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: 0.5 + i * 0.07, type: "spring", stiffness: 200 }}
                whileHover={{ scale: 1.08 }}
                onMouseEnter={() => setHoveredLabel(mod.label)}
                onMouseLeave={() => setHoveredLabel(null)}
                className="absolute cursor-pointer group"
                style={{
                  left: `calc(50% + ${x}px)`,
                  top: `calc(50% + ${y}px)`,
                  x: "-50%",
                  y: "-50%",
                  width: 56,
                  height: 56,
                }}
              >
                {/* Floating container inside the absolute node */}
                <motion.div
                  animate={{ 
                    y: [0, -4, 0],
                  }}
                  transition={{
                    duration: 3 + (i % 3) * 0.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="flex flex-col items-center w-full h-full relative"
                >
                  {/* Emoji button */}
                  <div className="w-14 h-14 bg-white rounded-2xl shadow-lg border border-[#E0E7FF] flex items-center justify-center text-2xl group-hover:border-[#4F46E5] group-hover:shadow-xl group-hover:shadow-indigo-100 transition-all duration-300">
                    {mod.emoji}
                  </div>
                  {/* Label */}
                  <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 text-xs font-semibold text-[#1E1B4B] text-center whitespace-nowrap bg-white px-2 py-0.5 rounded-full border border-[#E0E7FF] shadow-sm pointer-events-none group-hover:border-[#4F46E5] group-hover:text-[#4F46E5] transition-all duration-300">
                    {mod.label}
                  </span>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
