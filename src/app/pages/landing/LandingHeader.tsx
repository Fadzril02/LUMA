import React, { useState } from "react";
import { GraduationCap, Menu, X, ArrowRight } from "lucide-react";

interface LandingHeaderProps {
  onLoginClick: () => void;
  onGetStartedClick: () => void;
}

export function LandingHeader({ onLoginClick, onGetStartedClick }: LandingHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full bg-[#FAF8F3]/95 backdrop-blur-md border-b border-[#E7E1D4]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* SynGrad Wordmark (Text, not image) */}
        <a 
          href="#" 
          className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14213D] rounded-lg p-1"
        >
          <div className="w-10 h-10 rounded-lg bg-[#14213D] flex items-center justify-center text-white shadow-xs group-hover:bg-[#0D1629] transition-colors">
            <GraduationCap className="w-5 h-5 text-[#C9A227]" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-2xl font-bold tracking-tight text-[#14213D] leading-none">
              SynGrad<span className="text-[#7A1E3A]">™</span>
            </span>
            <span className="text-xs text-[#334155] font-medium tracking-wide">
              Smart Academic Advising
            </span>
          </div>
        </a>

        {/* Desktop Nav Actions */}
        <div className="hidden md:flex items-center gap-4">
          <button
            type="button"
            onClick={onLoginClick}
            className="px-4 py-2 text-sm font-semibold text-[#14213D] hover:text-[#7A1E3A] transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14213D] cursor-pointer"
          >
            Log in
          </button>
          <button
            type="button"
            onClick={onGetStartedClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#7A1E3A] hover:bg-[#62182E] active:bg-[#4E1325] rounded-lg shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A1E3A] cursor-pointer"
          >
            <span>Get started</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile Menu Button with aria-label */}
        <div className="flex md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="p-2 rounded-lg text-[#14213D] hover:bg-[#F3EFE6] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14213D] cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E7E1D4] bg-[#FAF8F3] px-4 pt-3 pb-5 space-y-3 shadow-md animate-fade-in">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onLoginClick();
            }}
            className="w-full text-left py-2.5 px-3 text-sm font-semibold text-[#14213D] hover:bg-[#F3EFE6] rounded-md transition-colors cursor-pointer"
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onGetStartedClick();
            }}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#7A1E3A] hover:bg-[#62182E] rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <span>Get started</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </header>
  );
}
