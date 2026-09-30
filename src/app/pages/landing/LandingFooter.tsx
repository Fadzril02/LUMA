import React from "react";
import { GraduationCap, Mail, ShieldCheck } from "lucide-react";

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[#E5E7EB] bg-[#F9FAFB] py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-[#E5E7EB]">
          {/* Brand & Mission */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#1E3A8A] flex items-center justify-center text-white shadow-xs">
                <GraduationCap className="w-4 h-4 text-[#3B82F6]" />
              </div>
              <span className="font-serif text-xl font-bold tracking-tight text-[#1E3A8A]">
                SynGrad<span className="text-[#1E3A8A]">™</span>
              </span>
            </div>
            <p className="text-xs text-ink max-w-md leading-relaxed">
              Academic advising intelligence infrastructure. Deterministic curriculum validation, transcript degree audits, and cohort intervention.
            </p>
          </div>

          {/* Contact Details */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-xs text-ink">
            <a
              href="mailto:novusmandiri@gmail.com"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-[#E5E7EB] text-[#1E3A8A] hover:text-[#1E3A8A] hover:border-[#1E3A8A]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
            >
              <Mail className="w-3.5 h-3.5 text-[#1E3A8A]" />
              <span>Contact: novusmandiri@gmail.com</span>
            </a>
          </div>
        </div>

        {/* Legal & Regulatory Notices */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#475569] leading-relaxed">
          <div className="space-y-1">
            <p>© {currentYear} SynGrad™. All rights reserved.</p>
            <p className="text-ink-muted">SynGrad™ is a trademark of its owner.</p>
          </div>

          <div className="flex items-center gap-2 text-ink bg-white px-3 py-1.5 rounded-md border border-[#E5E7EB]">
            <ShieldCheck className="w-4 h-4 text-[#059669] shrink-0" />
            <span>Your academic data is handled under Malaysia's PDPA.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
