import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { CheckCircle, X } from "lucide-react";

const features = [
  "Affordable Pricing",
  "Faster Implementation",
  "SME Focused",
  "Payroll Included",
  "CRM Included",
  "Inventory Included",
  "Workforce Monitoring",
  "All-In-One Platform",
];

const competitors = [
  { name: "Hackers Infotech", featured: true, support: [true, true, true, true, true, true, true, true] },
  { name: "Asana", featured: false, support: [false, true, false, false, false, false, false, false] },
  { name: "ClickUp", featured: false, support: [true, true, false, false, false, false, false, false] },
  { name: "Monday.com", featured: false, support: [false, false, false, false, false, false, false, false] },
  { name: "Jira", featured: false, support: [false, false, false, false, false, false, false, false] },
  { name: "Trello", featured: false, support: [true, true, false, false, false, false, false, false] },
];

export function CompetitiveAdvantage() {
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
          <span className="inline-block bg-[#EEF2FF] text-[#4F46E5] text-sm font-semibold px-4 py-2 rounded-full mb-4">
            Why Choose Us
          </span>
          <h2 className="text-4xl font-black text-[#1E1B4B] mb-4">
            Hackers Infotech vs. The Rest
          </h2>
          <p className="text-[#475569] text-lg max-w-2xl mx-auto">
            See why businesses choose Hackers Infotech over fragmented, costly alternatives.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          className="overflow-x-auto"
        >
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left p-4 text-[#475569] font-medium w-52">Feature</th>
                {competitors.map((c) => (
                  <th
                    key={c.name}
                    className={`p-4 text-center font-bold ${
                      c.featured
                        ? "text-white bg-gradient-to-b from-[#4F46E5] to-[#6366F1] rounded-t-2xl"
                        : "text-[#1E1B4B]"
                    }`}
                  >
                    {c.featured && (
                      <div className="text-xs font-semibold text-[#EEF2FF] mb-1">⭐ Best Choice</div>
                    )}
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((f, fi) => (
                <tr
                  key={f}
                  className={fi % 2 === 0 ? "bg-[#F8FAFC]" : "bg-white"}
                >
                  <td className="p-4 text-sm font-medium text-[#1E1B4B] rounded-l-xl">{f}</td>
                  {competitors.map((c) => (
                    <td
                      key={c.name}
                      className={`p-4 text-center ${
                        c.featured ? "bg-[#EEF2FF]" : ""
                      } ${fi === features.length - 1 && c.featured ? "rounded-b-2xl" : ""}`}
                    >
                      {c.support[fi] ? (
                        <CheckCircle size={20} className={`mx-auto ${c.featured ? "text-[#4F46E5]" : "text-emerald-600"}`} />
                      ) : (
                        <X size={20} className="mx-auto text-slate-400" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}
