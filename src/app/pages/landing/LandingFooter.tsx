import React from "react";
import { GraduationCap, Mail, ShieldCheck } from "lucide-react";

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[#E7E1D4] bg-[#FAF8F3] py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-[#E7E1D4]">
          {/* Brand & Mission */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#14213D] flex items-center justify-center text-white shadow-xs">
                <GraduationCap className="w-4 h-4 text-[#C9A227]" />
              </div>
              <span className="font-serif text-xl font-bold tracking-tight text-[#14213D]">
                SynGrad<span className="text-[#7A1E3A]">™</span>
              </span>
            </div>
            <p className="text-xs text-[#334155] max-w-md leading-relaxed">
              Academic advising intelligence infrastructure. Deterministic curriculum validation, transcript degree audits, and cohort intervention.
            </p>
          </div>

          {/* Contact Details */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-xs text-[#334155]">
            <a
              href="mailto:novusmandiri@gmail.com"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-[#E7E1D4] text-[#14213D] hover:text-[#7A1E3A] hover:border-[#7A1E3A]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14213D]"
            >
              <Mail className="w-3.5 h-3.5 text-[#7A1E3A]" />
              <span>Contact: novusmandiri@gmail.com</span>
            </a>
          </div>
        </div>

        {/* Legal & Regulatory Notices */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#475569] leading-relaxed">
          <div className="space-y-1">
            <p>© {currentYear} SynGrad™. All rights reserved.</p>
            <p className="text-[#64748B]">SynGrad™ is a trademark of its owner.</p>
          </div>

          <div className="flex items-center gap-2 text-[#334155] bg-white px-3 py-1.5 rounded-md border border-[#E7E1D4]">
            <ShieldCheck className="w-4 h-4 text-[#059669] shrink-0" />
            <span>Your academic data is handled under Malaysia's PDPA.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
