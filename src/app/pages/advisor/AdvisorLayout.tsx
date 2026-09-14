import React, { useState } from "react";
import { 
  Users, 
  CheckSquare, 
  LogOut, 
  Menu, 
  X, 
  LayoutDashboard, 
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

  const advisorName = (profile as any)?.name || (profile as any)?.full_name || "Faculty Advisor";
  const advisorEmail = (profile as any)?.institutional_email || (profile as any)?.email || "";
  const advisorStaffId = (profile as any)?.staff_id || "";

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
      label: "Dashboard",
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
        className: "bg-rose-50 text-rose-700 border border-rose-200"
      } : undefined
    },
    {
      id: "queue",
      label: "Corrections Queue",
      description: "Transcript authorizations",
      icon: CheckSquare,
      badge: badgeCounts.pendingQueue && badgeCounts.pendingQueue > 0 ? {
        text: `${badgeCounts.pendingQueue} Pending`,
        className: "bg-blue-50 text-blue-900 border border-blue-200"
      } : undefined
    }
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex font-sans text-gray-900 antialiased">
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs z-40 lg:hidden transition-opacity" 
          onClick={() => setIsMobileOpen(false)} 
        />
      )}

      {/* Academic Minimalist Light Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white text-gray-900 border-r border-gray-200 transform transition-transform duration-200 ease-in-out flex flex-col ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-blue-900 flex items-center justify-center text-white shadow-sm">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-extrabold text-xl text-blue-900 tracking-tight">LUMA</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 font-semibold">
                    Advisor
                  </span>
                </div>
                <p className="text-xs text-gray-500 tracking-tight mt-0.5">
                  Academic Advising Platform
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider font-mono">
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
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left transition-colors tracking-tight ${
                  isActive
                    ? "text-blue-900 bg-blue-50 font-semibold border border-blue-100 shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-blue-900" : "text-gray-500"}`} />
                  <div className="truncate">
                    <div className="text-sm">{item.label}</div>
                    <div className={`text-[11px] truncate ${isActive ? "text-blue-700 font-normal" : "text-gray-400"}`}>
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

        {/* Advisor Profile Badge & Signout */}
        <div className="p-4 border-t border-gray-200 bg-gray-50/50">
          <div className="flex items-center space-x-3 mb-3 p-2.5 rounded-lg bg-white border border-gray-200 shadow-xs">
            <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-xs text-blue-900 shrink-0">
              {getInitials(advisorName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-gray-900 truncate">{advisorName}</div>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="text-[10px] font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-medium">
                  {advisorStaffId}
                </span>
                <span className="text-[11px] text-gray-500 truncate">{advisorEmail}</span>
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 border border-transparent transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Platform</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <span>Advisor Portal</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-medium text-gray-700">
                  {activeTab === "dashboard" && "Dashboard"}
                  {activeTab === "students" && "Advisees"}
                  {activeTab === "queue" && "Queue"}
                </span>
              </div>
              <h1 className="text-lg font-bold text-gray-900 tracking-tight">
                {activeTab === "dashboard" && "Dashboard"}
                {activeTab === "students" && "Advisee Roster"}
                {activeTab === "queue" && "Corrections Queue"}
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>Verified Session</span>
              <span className="text-gray-500 font-mono">[{advisorStaffId}]</span>
            </div>
          </div>
        </header>

        {/* Body Viewport */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#F9FAFB]">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
