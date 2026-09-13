import React, { useState } from "react";
import { 
  Users, 
  CheckSquare, 
  LogOut, 
  Menu, 
  X, 
  ShieldCheck, 
  LayoutDashboard, 
  Sparkles,
  ChevronRight,
  GraduationCap
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";

interface AdvisorLayoutProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
  badgeCounts?: {
    atRisk?: number;
    pendingQueue?: number;
  };
}

export function AdvisorLayout({
  activeTab,
  onTabChange,
  children,
  badgeCounts = {}
}: AdvisorLayoutProps) {
  const { profile, user, logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const advisorName = (profile as any)?.name || (profile as any)?.full_name || user?.user_metadata?.full_name || "Faculty Advisor";
  const advisorEmail = (profile as any)?.institutional_email || (profile as any)?.email || user?.email || "";
  const advisorStaffId = (profile as any)?.staff_id || user?.user_metadata?.staff_id || "STAFF-LIYANA";
  const advisorDepartment = (profile as any)?.department || "Software Engineering";

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const navItems = [
    {
      id: "dashboard",
      label: "Cohort Diagnostics",
      description: "Overview & metrics",
      icon: LayoutDashboard,
      badge: undefined
    },
    {
      id: "students",
      label: "Advisee Roster",
      description: "Student profiles & status",
      icon: Users,
      badge: badgeCounts.atRisk && badgeCounts.atRisk > 0 ? {
        text: `${badgeCounts.atRisk} At-Risk`,
        className: "bg-amber-500/20 text-amber-300 border border-amber-500/30"
      } : undefined
    },
    {
      id: "queue",
      label: "Corrections Queue",
      description: "Transcript authorizations",
      icon: CheckSquare,
      badge: badgeCounts.pendingQueue && badgeCounts.pendingQueue > 0 ? {
        text: `${badgeCounts.pendingQueue} Pending`,
        className: "bg-blue-500/20 text-blue-300 border border-blue-500/30"
      } : undefined
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900 antialiased">
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 lg:hidden transition-opacity" 
          onClick={() => setIsMobileOpen(false)} 
        />
      )}

      {/* Enterprise Dark Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-slate-950 text-slate-200 border-r border-slate-800 transform transition-transform duration-200 ease-in-out flex flex-col ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800/90">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-extrabold text-xl text-white tracking-tight">LUMA</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Advisor
                  </span>
                </div>
                <p className="text-xs text-slate-400 tracking-tight mt-0.5">
                  Degree Audit &amp; Advising Platform
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Institutional Pill */}
        <div className="px-6 py-3 bg-slate-900/60 border-b border-slate-800/80">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="truncate font-medium text-slate-300">UTM Faculty of Computing</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{advisorDepartment}</p>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
            Navigation Hub
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  setIsMobileOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left transition-all tracking-tight ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25 font-medium"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <div className="truncate">
                    <div className="text-sm">{item.label}</div>
                    <div className={`text-[11px] truncate ${isActive ? "text-blue-100" : "text-slate-400"}`}>
                      {item.description}
                    </div>
                  </div>
                </div>
                {item.badge && (
                  <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full shrink-0 ${item.badge.className}`}>
                    {item.badge.text}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Advisor Profile Card & Signout */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/40">
          <div className="flex items-center space-x-3 mb-3 p-2 rounded-lg bg-slate-900 border border-slate-800/80">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-blue-300 shrink-0">
              {getInitials(advisorName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white truncate">{advisorName}</div>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                  {advisorStaffId}
                </span>
                <span className="text-[11px] text-slate-400 truncate">{advisorEmail}</span>
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-950/30 hover:border-red-900/40 border border-transparent transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Platform</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <span>Faculty Portal</span>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="font-medium text-slate-700 capitalize">
                  {activeTab === "dashboard" && "Diagnostics Hub"}
                  {activeTab === "students" && "Advisees"}
                  {activeTab === "queue" && "Queue"}
                </span>
              </div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                {activeTab === "dashboard" && "Academic Cohort Diagnostics"}
                {activeTab === "students" && "Advisee Performance Roster"}
                {activeTab === "queue" && "Discrepancy Resolution & Verification"}
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Verified Session</span>
              <span className="text-slate-400 font-mono">[{advisorStaffId}]</span>
            </div>
          </div>
        </header>

        {/* Body Viewport */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
