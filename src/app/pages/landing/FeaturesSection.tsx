import React from "react";
import { Users, GraduationCap, CheckCircle2 } from "lucide-react";

export function FeaturesSection() {
  const advisorFeatures = [
    {
      title: "Curriculum upload with elective slots",
      detail: "Define degree structures via CSV with full support for program core modules, university electives, and semester credit minimums.",
    },
    {
      title: "Transcript extraction & approval queue",
      detail: "Review OCR-extracted academic slips from advisees in a dedicated queue with one-click verification and automated binary purging.",
    },
    {
      title: "Advising notes with private entries",
      detail: "Maintain permanent advising logs with action items and follow-up dates, keeping sensitive records private or sharing agreed next steps with students.",
    },
    {
      title: "Advisee roster & standing monitoring",
      detail: "Track student credit milestones, calculated CGPA, and standing status (Good Standing vs. Academic Risk) in real time.",
    },
  ];

  const studentFeatures = [
    {
      title: "Automated degree audit & credit ledger",
      detail: "Instantly view completed coursework grouped by syllabus requirements, earned credit hours, and progress toward total degree completion.",
    },
    {
      title: "Prerequisite DAG tracking & warning flags",
      detail: "Identify unmet prerequisite dependencies before semester enrollment to avoid course registration setbacks and graduation delays.",
    },
    {
      title: "Interactive grade predictor & what-if calculator",
      detail: "Simulate future target grades and credit loads to model anticipated semester GPA and cumulative CGPA trajectories.",
    },
    {
      title: "Shared advising notes & agreed next steps",
      detail: "Access official post-meeting intervention notes, recommended courses, and follow-up deadlines recorded by your academic advisor.",
    },
  ];

  return (
    <section className="py-16 sm:py-24 border-t border-[#E7E1D4] bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-[#7A1E3A]">
            Built For Higher Education
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-[#14213D] mt-2">
            Engineered for advisors. Clear for students.
          </h2>
          <p className="text-sm sm:text-base text-[#334155] mt-3 leading-relaxed">
            Every capability in SynGrad is tailored strictly to verified university academic workflows.
          </p>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* For Advisors Column */}
          <div className="rounded-2xl border border-[#E7E1D4] bg-[#FAF8F3] p-6 sm:p-8 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#E7E1D4]">
                <div className="w-10 h-10 rounded-xl bg-[#14213D] flex items-center justify-center text-white shadow-xs">
                  <Users className="w-5 h-5 text-[#C9A227]" />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#14213D]">
                    For Academic Advisors
                  </h3>
                  <p className="text-xs text-[#334155] font-medium">
                    Faculty intervention, cohort oversight, and curriculum management
                  </p>
                </div>
              </div>

              <ul className="space-y-4">
                {advisorFeatures.map((feat, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#059669] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-[#14213D]">
                        {feat.title}
                      </h4>
                      <p className="text-xs text-[#334155] mt-0.5 leading-relaxed">
                        {feat.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 pt-4 border-t border-[#E7E1D4] text-xs font-medium text-[#334155]">
              Includes faculty cohort invite codes and single-advisor advisee rosters.
            </div>
          </div>

          {/* For Students Column */}
          <div className="rounded-2xl border border-[#E7E1D4] bg-[#FAF8F3] p-6 sm:p-8 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#E7E1D4]">
                <div className="w-10 h-10 rounded-xl bg-[#7A1E3A] flex items-center justify-center text-white shadow-xs">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#14213D]">
                    For University Students
                  </h3>
                  <p className="text-xs text-[#334155] font-medium">
                    Clear degree progress, prerequisite safety, and academic planning
                  </p>
                </div>
              </div>

              <ul className="space-y-4">
                {studentFeatures.map((feat, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#059669] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-[#14213D]">
                        {feat.title}
                      </h4>
                      <p className="text-xs text-[#334155] mt-0.5 leading-relaxed">
                        {feat.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 pt-4 border-t border-[#E7E1D4] text-xs font-medium text-[#334155]">
              Accessible anytime via institutional email credentials.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
