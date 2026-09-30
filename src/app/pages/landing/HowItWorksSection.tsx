import React from "react";
import { FileSpreadsheet, FileText, CheckCircle2, ArrowRight } from "lucide-react";

export function HowItWorksSection() {
  const steps = [
    {
      step: "01",
      title: "Advisor uploads the curriculum",
      description: "Department advisors ingest the degree blueprint via CSV — defining compulsory courses, elective slot requirements, credit weights, and prerequisite sequences.",
      icon: FileSpreadsheet,
    },
    {
      step: "02",
      title: "Student uploads their transcript",
      description: "Students upload their official university semester academic slip. Courses, grades, credit hours, and academic status are extracted automatically.",
      icon: FileText,
    },
    {
      step: "03",
      title: "SynGrad audits progress & flags risks",
      description: "The engine maps completed coursework against the syllabus, checks prerequisite chains, highlights unmet requirements, and projects remaining credits.",
      icon: CheckCircle2,
    },
  ];

  return (
    <section className="py-16 sm:py-24 border-t border-[#E7E1D4] bg-[#FAF8F3]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-[#7A1E3A]">
            Streamlined Advising Workflow
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-[#14213D] mt-2">
            How it works in three steps
          </h2>
          <p className="text-sm sm:text-base text-[#334155] mt-3 leading-relaxed">
            Eliminate manual transcript tallying and fragmented spreadsheets with automated, curriculum-grounded degree verification.
          </p>
        </div>

        {/* 3 Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="bg-white rounded-2xl border border-[#E7E1D4] p-6 sm:p-8 flex flex-col justify-between shadow-xs relative group hover:border-[#14213D]/40 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-serif text-xl font-bold text-[#C9A227] tracking-tight">
                      Step {item.step}
                    </span>
                    <div className="w-12 h-12 rounded-xl bg-[#FAF8F3] border border-[#E7E1D4] flex items-center justify-center text-[#14213D] group-hover:bg-[#14213D] group-hover:text-white transition-colors">
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                  <h3 className="font-serif text-lg font-bold text-[#14213D] mb-3 leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[#334155] leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-[#E7E1D4]/60 flex items-center text-xs font-semibold text-[#14213D] gap-1.5">
                  <span>{idx === 0 ? "Curriculum Setup" : idx === 1 ? "Slip Verification" : "Automated Audit"}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#7A1E3A]" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
