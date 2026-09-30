import { useState, useRef, useEffect } from "react";
import { motion, useInView } from "motion/react";
import { CheckCircle, Sparkles } from "lucide-react";

const addons = [
  {
    title: "Projects & Allocation",
    price: "₹50",
    emoji: "📊",
    highlights: [
      "Resource Scheduling",
      "Project Allocation Map",
      "Included in Standard/Premium",
      "Add-on for Starter"
    ],
  },
  {
    title: "Timesheets & Tickets",
    price: "₹50",
    emoji: "⏱️",
    highlights: [
      "Time Tracking & Approvals",
      "Ticketing & Helpdesk",
      "Included in Premium",
      "Add-on for Standard"
    ],
  },
  {
    title: "Executive Dashboard",
    price: "₹50",
    emoji: "📈",
    highlights: [
      "High-Level KPI Overviews",
      "Revenue & Expense Analytics",
      "Included in Premium",
      "Add-on for Standard"
    ],
  },
  {
    title: "Inventory Management",
    price: "₹50",
    emoji: "📦",
    highlights: [
      "Real-Time Stock Alerts",
      "Supplier Management",
      "Included in Premium",
      "Add-on for Starter & Standard"
    ],
  },
];

const tiers = [
  {
    name: "Starter",
    userPriceMonthly: "₹100",
    userPriceAnnually: "₹95",
    basePriceMonthly: "₹1,500",
    basePriceAnnually: "₹1,425",
    annualTotal: "₹17,100",
    usersIncluded: 15,
    savings: "5%",
    badge: "For Startups",
    description: "Essential workforce management for small teams.",
    features: [
      "Attendance & Leave",
      "Basic CRM",
      "Admin & User Roles",
      "My Dashboard",
      "Workflow Builder (custom states)",
      "Expense Management",
      "TO DO: Basic",
      "Priority Support: Low",
      "Up to 15 Users"
    ],
    color: "from-[#4F46E5] to-[#6366F1]",
    border: "border-[#E0E7FF]",
    bg: "bg-white",
    cta: "Get Started",
  },
  {
    name: "Standard",
    userPriceMonthly: "₹300",
    userPriceAnnually: "₹270",
    basePriceMonthly: "₹7,500",
    basePriceAnnually: "₹6,750",
    annualTotal: "₹81,000",
    usersIncluded: 25,
    savings: "10%",
    badge: "MOST POPULAR",
    description: "Perfect for growing SMEs that need workforce, payroll, and CRM management.",
    features: [
      "Everything in Starter",
      "Advanced CRM",
      "Payroll Management",
      "Invoice & AR",
      "Vendor Payments",
      "Audit Logs",
      "Basic Analytics",
      "Employee Lifecycle & HRMS (Client)",
      "Projects & Allocation (Included)",
      "TO DO: Advanced with notifications",
      "Priority Support: Medium",
      "Up to 25 Users"
    ],
    color: "from-[#4F46E5] to-[#6366F1]",
    border: "border-[#4F46E5]",
    bg: "bg-gradient-to-br from-indigo-50/30 to-white",
    featured: true,
    cta: "Request Demo",
  },
  {
    name: "Premium",
    userPriceMonthly: "Contact Sales",
    userPriceAnnually: "Contact Sales",
    basePriceMonthly: "Contact Sales",
    basePriceAnnually: "Contact Sales",
    annualTotal: "Custom Agreement",
    usersIncluded: 0, // Unlimited
    badge: "Enterprise",
    description: "Complete business management platform with all modules included.",
    features: [
      "Unlimited Users",
      "Everything in Standard",
      "Timesheets & Tickets (Included)",
      "Executive Dashboard (Included)",
      "Inventory Management (Included)",
      "Employee Lifecycle & HRMS (Full)",
      "TO DO: ✓(with team calendar)",
      "Priority Support: High"
    ],
    color: "from-purple-600 to-indigo-600",
    border: "border-[#E0E7FF]",
    bg: "bg-white",
    cta: "Contact Sales",
  },
];

const sliderSteps = [10, 15, 20, 25, 30, 50, 100, 250, 500];

function getActiveTier(users: number) {
  if (users <= 15) return 0;
  if (users <= 25) return 1;
  return 2;
}

export function PricingSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [sliderIdx, setSliderIdx] = useState(3); // Default Standard (25 users)
  const [isAnnual, setIsAnnual] = useState(false);
  const users = sliderSteps[sliderIdx];
  const activeTier = getActiveTier(users);

  useEffect(() => {
    const handleSelectTier = (e: Event) => {
      const customEvent = e as CustomEvent;
      const tierName = customEvent.detail;
      if (tierName === "Starter") {
        setSliderIdx(1); // 15 users
      } else if (tierName === "Standard") {
        setSliderIdx(3); // 25 users
      } else if (tierName === "Premium") {
        setSliderIdx(5); // 50 users
      }
    };
    window.addEventListener("select-pricing-tier", handleSelectTier);
    return () => window.removeEventListener("select-pricing-tier", handleSelectTier);
  }, []);

  return (
    <section id="pricing" className="py-24 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-[#EEF2FF] text-[#4F46E5] text-sm font-semibold px-4 py-2 rounded-full mb-4">
            Pricing
          </span>
          <h2 className="text-4xl font-black text-[#1E1B4B] mb-4">
            Simple & Transparent Pricing
          </h2>
          <p className="text-[#475569] text-lg max-w-2xl mx-auto mb-8">
            Choose the plan that fits your business today and scale as your workforce grows.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm font-bold transition-colors ${!isAnnual ? "text-[#1E1B4B]" : "text-[#94A3B8]"}`}>
              Bill Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="w-12 h-6 rounded-full relative flex items-center p-0.5 transition-colors focus:outline-none"
              style={{ backgroundColor: isAnnual ? "#4F46E5" : "#E0E7FF" }}
            >
              <motion.div
                layout
                className="w-5 h-5 rounded-full bg-white shadow-sm"
                animate={{ x: isAnnual ? 24 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
            <span className={`text-sm font-bold flex items-center gap-1.5 transition-colors ${isAnnual ? "text-[#1E1B4B]" : "text-[#94A3B8]"}`}>
              Bill Annually
              <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                Save ~10%
              </span>
            </span>
          </div>
        </motion.div>

        {/* Slider */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl border border-[#E0E7FF] shadow-sm p-8 mb-16 max-w-2xl mx-auto"
        >
          <div className="text-center mb-6">
            <p className="text-[#475569] mb-2 font-medium">Get instant estimate for</p>
            <div className="inline-flex items-center gap-2 bg-[#EEF2FF] rounded-xl px-5 py-3 mb-4">
              <span className="text-3xl font-black text-[#4F46E5]">{users === 500 ? "500+" : users}</span>
              <span className="text-[#475569] font-medium">employees</span>
            </div>
            
            <div className="text-xl font-bold text-[#1E1B4B] transition-all duration-300">
              Estimated Cost:{" "}
              <span className="text-[#4F46E5] underline decoration-indigo-200">
                {users <= 15 ? (
                  isAnnual ? "₹1,425 / Month" : "₹1,500 / Month"
                ) : users <= 25 ? (
                  isAnnual ? "₹6,750 / Month" : "₹7,500 / Month"
                ) : (
                  "Custom Enterprise Pricing"
                )}
              </span>
            </div>
            
            {isAnnual && users <= 25 && (
              <p className="text-xs text-emerald-600 font-bold mt-1">
                Billed as {users <= 15 ? "₹17,100 / Year" : "₹81,000 / Year"}
              </p>
            )}
            
            {users > 25 && (
              <motion.p
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-sm text-[#4F46E5] font-semibold mt-3 max-w-md mx-auto bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2"
              >
                Need more than 25 users? Contact our sales team for a customized enterprise solution.
              </motion.p>
            )}
          </div>

          <input
            type="range"
            min={0}
            max={sliderSteps.length - 1}
            value={sliderIdx}
            onChange={(e) => setSliderIdx(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #4F46E5 ${(sliderIdx / (sliderSteps.length - 1)) * 100}%, #E0E7FF ${(sliderIdx / (sliderSteps.length - 1)) * 100}%)`,
              accentColor: "#4F46E5",
            }}
          />
          <div className="flex justify-between mt-3">
            {sliderSteps.map((s, i) => (
              <button
                key={s}
                onClick={() => setSliderIdx(i)}
                className={`text-xs font-semibold transition-colors ${i === sliderIdx ? "text-[#4F46E5]" : "text-[#94A3B8]"}`}
              >
                {s === 500 ? "500+" : s}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-8 items-stretch">
          {tiers.map((t, i) => {
            const isActive = activeTier === i;
            return (
              <div key={t.name} className="relative group w-full h-full">
                {/* Glow effect for Standard plan */}
                {t.featured && (
                  <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5] to-[#6366F1] rounded-3xl blur-md opacity-25 group-hover:opacity-35 transition-opacity duration-300" />
                )}
                
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.1 + i * 0.12 }}
                  whileHover={{ y: -8 }}
                  className={`relative rounded-3xl p-8 border-2 transition-all duration-300 w-full h-full flex flex-col ${t.bg} ${
                    isActive ? "border-[#4F46E5] shadow-2xl" : t.border
                  }`}
                >
                  {/* Recommended/Most Popular badge */}
                  {t.featured && (
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-md"
                    >
                      <Sparkles size={12} /> {t.badge}
                    </motion.div>
                  )}
                  {!t.featured && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold px-4 py-1.5 rounded-full">
                      {t.badge}
                    </div>
                  )}

                  <div className="mb-6 pt-2">
                    <h3 className="text-2xl font-black text-[#1E1B4B] mb-2">{t.name}</h3>
                    {t.name !== "Premium" ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-4xl font-black text-[#1E1B4B]">
                            {isAnnual ? t.userPriceAnnually : t.userPriceMonthly}
                          </span>
                          <span className="text-[#475569] text-xs font-bold">/ User / Month</span>
                          {isAnnual && t.savings && (
                            <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm">
                              -{t.savings}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-bold text-slate-500">
                          Base package: {isAnnual ? t.basePriceAnnually : t.basePriceMonthly} / Month (includes {t.usersIncluded} users)
                        </div>
                        {isAnnual && t.annualTotal && (
                          <div className="text-[11px] text-emerald-600 font-bold">
                            Billed as ₹{t.annualTotal} / Year
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-[#1E1B4B]">Contact Sales</span>
                        </div>
                        <div className="text-[11px] font-bold text-slate-500">
                          Enterprise pricing for unlimited users
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-[#475569] mt-4 leading-relaxed font-medium min-h-[32px]">{t.description}</p>
                  </div>

                  {/* Scrollable container for features to maintain visual balance */}
                  <ul className={`space-y-2 mb-6 ${
                    t.name !== "Starter"
                      ? "max-h-[220px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-indigo-200"
                      : ""
                  }`}>
                    {t.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-[#475569] font-medium">
                        <CheckCircle size={15} className="text-[#4F46E5] flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <a
                    href="https://docs.google.com/forms/d/e/1FAIpQLSewsGyCmlZkT7i-uJpclxMltrsQMwoKiW2jgRRJKk2SS72rrQ/viewform"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full block text-center py-3.5 rounded-xl font-bold text-white bg-gradient-to-r ${t.color} hover:opacity-95 transition-all shadow-lg hover:shadow-xl mt-auto`}
                  >
                    {t.cta}
                  </a>
                </motion.div>
              </div>
            );
          })}
        </div>

        {/* Build Your Own Workspace Section */}
        <div className="mt-28 border-t border-[#E0E7FF] pt-20">
          <div className="text-center mb-16">
            <span className="inline-block bg-[#EEF2FF] text-[#4F46E5] text-sm font-semibold px-4 py-2 rounded-full mb-4">
              Custom Workspace
            </span>
            <h3 className="text-4xl font-black text-[#1E1B4B] mb-4">
              Build Your Own Workspace
            </h3>
            <p className="text-[#475569] text-lg max-w-2xl mx-auto">
              Add only the modules your business needs.
            </p>
          </div>

          {/* Add-On Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {addons.map((addon, idx) => (
              <motion.div
                key={addon.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: idx * 0.08, duration: 0.5 }}
                whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(79,70,229,0.08)" }}
                className="bg-white rounded-3xl p-6 border-2 border-[#E0E7FF] flex flex-col justify-between hover:border-[#4F46E5] transition-all duration-300"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] flex items-center justify-center text-2xl mb-4">
                    {addon.emoji}
                  </div>
                  <h4 className="text-lg font-bold text-[#1E1B4B] mb-1 leading-snug min-h-[44px]">{addon.title}</h4>
                  <div className="flex items-baseline gap-0.5 mb-4">
                    <span className="text-2xl font-black text-[#4F46E5]">{addon.price}</span>
                    <span className="text-[10px] text-[#475569] font-semibold">/ User / Month</span>
                  </div>
                  
                  <ul className="space-y-2.5 mb-6">
                    {addon.highlights.map((h, hi) => (
                      <li key={hi} className="flex items-center gap-1.5 text-[11px] text-[#475569] font-medium leading-tight">
                        <CheckCircle size={12} className="text-[#4F46E5] flex-shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSewsGyCmlZkT7i-uJpclxMltrsQMwoKiW2jgRRJKk2SS72rrQ/viewform"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full block text-center py-2.5 rounded-xl font-bold text-[#4F46E5] bg-[#EEF2FF] hover:bg-[#4F46E5] hover:text-white transition-all duration-300 text-xs shadow-sm"
                >
                  Add Module
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
