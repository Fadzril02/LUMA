import React from "react";
import { Sparkles, ArrowRight, ShieldCheck } from "lucide-react";

interface FoundingAdvisorCalloutProps {
  onJoinAsAdvisor: () => void;
}

export function FoundingAdvisorCallout({ onJoinAsAdvisor }: FoundingAdvisorCalloutProps) {
  return (
    <section className="py-16 sm:py-20 bg-[#FAF8F3] border-t border-[#E7E1D4]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#14213D] text-white rounded-2xl p-8 sm:p-12 lg:p-14 shadow-md border border-[#0D1629] relative overflow-hidden">
          {/* Subtle Accent Glow */}
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 rounded-full bg-[#C9A227]/10 blur-3xl pointer-events-none" />

          <div className="max-w-3xl relative z-10 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-[#C9A227] border border-[#C9A227]/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Institutional Pilot Program</span>
            </div>

            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight">
              Founding advisors get lifetime free access during our pilot.
            </h2>

            <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-2xl">
              Faculty members and academic coordinators who adopt SynGrad during our university deployment phase receive full platform access, curriculum ingestion support, and dedicated onboarding at no charge.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <button
                type="button"
                onClick={onJoinAsAdvisor}
                className="inline-flex items-center gap-2.5 px-6 py-3 text-sm font-semibold text-white bg-[#7A1E3A] hover:bg-[#62182E] active:bg-[#4E1325] rounded-xl shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] cursor-pointer"
              >
                <span>Register as a founding advisor</span>
                <ArrowRight className="w-4 h-4 text-[#C9A227]" />
              </button>

              <div className="flex items-center gap-2 text-xs text-gray-300">
                <ShieldCheck className="w-4 h-4 text-[#C9A227] shrink-0" />
                <span>Zero software licensing fees during the pilot period</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
