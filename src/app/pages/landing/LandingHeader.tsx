import React, { useState } from "react";
import { GraduationCap, Menu, X, ArrowRight } from "lucide-react";

interface LandingHeaderProps {
  onLoginClick: () => void;
  onGetStartedClick: () => void;
}

export function LandingHeader({ onLoginClick, onGetStartedClick }: LandingHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full bg-[#F9FAFB]/95 backdrop-blur-md border-b border-[#E5E7EB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* SynGrad Wordmark (Text, not image) */}
        <a 
          href="#" 
          className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] rounded-lg p-1"
        >
          <div className="w-10 h-10 rounded-lg bg-[#1E3A8A] flex items-center justify-center text-white shadow-xs group-hover:bg-[#1E40AF] transition-colors">
            <GraduationCap className="w-5 h-5 text-[#3B82F6]" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-2xl font-bold tracking-tight text-[#1E3A8A] leading-none">
              SynGrad<span className="text-[#1E3A8A]">™</span>
            </span>
            <span className="text-xs text-ink font-medium tracking-wide">
              Smart Academic Advising
            </span>
          </div>
        </a>

        {/* Desktop Nav Actions */}
        <div className="hidden md:flex items-center gap-4">
          <button
            type="button"
            onClick={onLoginClick}
            className="px-4 py-2 text-sm font-semibold text-[#1E3A8A] hover:text-[#1E3A8A] transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] cursor-pointer"
          >
            Log in
          </button>
          <button
            type="button"
            onClick={onGetStartedClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1E3A8A] hover:bg-[#1E40AF] active:bg-[#1E40AF] rounded-lg shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] cursor-pointer"
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
            className="p-2 rounded-lg text-[#1E3A8A] hover:bg-[#F3F4F6] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E5E7EB] bg-[#F9FAFB] px-4 pt-3 pb-5 space-y-3 shadow-md animate-fade-in">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onLoginClick();
            }}
            className="w-full text-left py-2.5 px-3 text-sm font-semibold text-[#1E3A8A] hover:bg-[#F3F4F6] rounded-md transition-colors cursor-pointer"
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onGetStartedClick();
            }}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#1E3A8A] hover:bg-[#1E40AF] rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <span>Get started</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </header>
  );
}
