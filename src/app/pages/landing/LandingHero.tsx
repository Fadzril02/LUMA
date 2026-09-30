import React from "react";
import { GraduationCap, Users, ShieldCheck, CheckCircle2 } from "lucide-react";

interface LandingHeroProps {
  onSelectAdvisor: () => void;
  onSelectStudent: () => void;
}

export function LandingHero({ onSelectAdvisor, onSelectStudent }: LandingHeroProps) {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Institutional Assurance Badge */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#E5E7EB] shadow-xs text-xs font-medium text-ink">
        <ShieldCheck className="w-4 h-4 text-[#1E3A8A] shrink-0" />
        <span>Institutional Degree Audit &amp; Advising System</span>
      </div>

      {/* Main Single H1 */}
      <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#1E3A8A] leading-[1.18]">
        Know exactly where every student stands on the path to graduation.
      </h1>

      {/* Descriptive Subline */}
      <p className="text-base sm:text-lg text-ink leading-relaxed max-w-2xl font-normal">
        Automatic degree audits, prerequisite verification, and credit tracking generated straight from uploaded academic transcripts — built for faculty advisors and university students.
      </p>

      {/* Dual Role CTAs */}
      <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={onSelectAdvisor}
          className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 text-sm font-semibold text-white bg-[#1E3A8A] hover:bg-[#1E40AF] active:bg-[#1E40AF] rounded-xl shadow-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] cursor-pointer"
        >
          <Users className="w-4 h-4 text-[#3B82F6]" />
          <span>I'm an advisor</span>
        </button>

        <button
          type="button"
          onClick={onSelectStudent}
          className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 text-sm font-semibold text-[#1E3A8A] bg-white hover:bg-[#F9FAFB] active:bg-[#F3F4F6] border border-[#E5E7EB] hover:border-[#1E3A8A]/30 rounded-xl shadow-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] cursor-pointer"
        >
          <GraduationCap className="w-4 h-4 text-[#1E3A8A]" />
          <span>I'm a student</span>
        </button>
      </div>

      {/* Honest Value Highlights */}
      <div className="pt-4 border-t border-[#E5E7EB]/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-ink">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
          <span>Deterministic curriculum validation</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
          <span>Zero-waste transcript parsing with instant purge</span>
        </div>
      </div>
    </div>
  );
}
