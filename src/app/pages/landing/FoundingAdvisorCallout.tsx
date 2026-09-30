import React from "react";
import { Sparkles, ArrowRight, ShieldCheck } from "lucide-react";

interface FoundingAdvisorCalloutProps {
  onJoinAsAdvisor: () => void;
}

export function FoundingAdvisorCallout({ onJoinAsAdvisor }: FoundingAdvisorCalloutProps) {
  return (
    <section className="py-16 sm:py-20 bg-[#F9FAFB] border-t border-[#E5E7EB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#1E3A8A] text-white rounded-2xl p-8 sm:p-12 lg:p-14 shadow-md border border-[#1E40AF] relative overflow-hidden">
          {/* Subtle Accent Glow */}
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 rounded-full bg-[#3B82F6]/10 blur-3xl pointer-events-none" />

          <div className="max-w-3xl relative z-10 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-[#3B82F6] border border-[#3B82F6]/30">
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
                className="inline-flex items-center gap-2.5 px-6 py-3 text-sm font-semibold text-white bg-[#1E3A8A] hover:bg-[#1E40AF] active:bg-[#1E40AF] rounded-xl shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] cursor-pointer"
              >
                <span>Register as a founding advisor</span>
                <ArrowRight className="w-4 h-4 text-[#3B82F6]" />
              </button>

              <div className="flex items-center gap-2 text-xs text-gray-300">
                <ShieldCheck className="w-4 h-4 text-[#3B82F6] shrink-0" />
                <span>Zero software licensing fees during the pilot period</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
