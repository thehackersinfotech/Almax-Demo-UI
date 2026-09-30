import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { CheckCircle, Rocket, Building2, Building } from "lucide-react";

const segments = [
  {
    icon: Rocket,
    title: "Startups",
    subtitle: "Launch fast, scale smart",
    color: "from-[#4F46E5] to-[#6366F1]",
    items: ["Affordable pricing from ₹100/user/mo", "Easy same-day setup", "Scales as your team grows"],
    bg: "bg-[#EEF2FF]",
    textColor: "text-[#4F46E5]",
  },
  {
    icon: Building2,
    title: "SMEs",
    subtitle: "Run operations with confidence",
    color: "from-teal-400 to-emerald-500",
    items: ["Full workforce visibility", "Automated payroll processing", "Inventory & CRM in one place"],
    bg: "bg-teal-50",
    textColor: "text-teal-600",
    featured: true,
  },
  {
    icon: Building,
    title: "Enterprises",
    subtitle: "Power your entire organization",
    color: "from-violet-500 to-purple-600",
    items: ["Multi-department management", "Advanced analytics & reporting", "Dedicated account manager"],
    bg: "bg-violet-50",
    textColor: "text-violet-600",
  },
];

export function TargetCustomers() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const handleSelectTier = (segmentTitle: string) => {
    let tier = "Starter";
    if (segmentTitle === "Startups") tier = "Starter";
    else if (segmentTitle === "SMEs") tier = "Standard";
    else if (segmentTitle === "Enterprises") tier = "Premium";

    const event = new CustomEvent("select-pricing-tier", { detail: tier });
    window.dispatchEvent(event);

    const pricingEl = document.getElementById("pricing");
    if (pricingEl) {
      pricingEl.scrollIntoView({ behavior: "smooth" });
    }
  };

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
          <span className="inline-block bg-[#EEF2FF] text-[#4F46E5] text-sm font-semibold px-4 py-2 rounded-full mb-4">
            Who We Serve
          </span>
          <h2 className="text-4xl font-black text-[#1E1B4B] mb-4">
            Built for Every Stage of Growth
          </h2>
          <p className="text-[#475569] text-lg max-w-2xl mx-auto">
            Whether you're a startup or an enterprise, Hackers Infotech scales with your ambition.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {segments.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.15 }}
              whileHover={{ y: -8 }}
              className={`relative rounded-3xl p-8 border transition-all duration-300 ${
                s.featured
                  ? "border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50 shadow-xl shadow-teal-100"
                  : "border-[#E0E7FF] bg-white shadow-sm"
              }`}
            >
              {s.featured && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-teal-400 to-emerald-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-md">
                  Most Popular
                </div>
              )}

              <div className={`w-16 h-16 ${s.bg} rounded-2xl flex items-center justify-center mb-6`}>
                <s.icon size={28} className={s.textColor} />
              </div>

              <h3 className="text-2xl font-black text-[#1E1B4B] mb-1">{s.title}</h3>
              <p className={`text-sm font-semibold ${s.textColor} mb-6`}>{s.subtitle}</p>

              <ul className="space-y-3 mb-8">
                {s.items.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle size={16} className={`${s.textColor} flex-shrink-0 mt-0.5`} />
                    <span className="text-[#475569]">{item}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectTier(s.title)}
                className={`w-full py-3 rounded-xl font-semibold transition-all duration-200 bg-gradient-to-r ${s.color} text-white hover:opacity-90 shadow-md`}
              >
                Get Started
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
