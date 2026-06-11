import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom"; // Use react-router-dom for Vite
import { useAuth } from "../../context/AuthContext";
import {
  Users, Bell, CheckSquare, Upload, LogOut, Menu, X, LayoutDashboard, Settings, ShieldAlert, GraduationCap
} from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
  userRole?: "student" | "advisor" | "admin";
  userName?: string;
}

export function AppLayout({ children, userRole = "advisor", userName = "System User" }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // ✨ PULL THE MASTER LOGOUT COMMAND FROM CONTEXT
  const { logout } = useAuth();

  // 🧭 DYNAMIC SIDEBAR MENUS: Changes automatically based on who logs in!
  const navMenus = {
    student: [
      { id: "dashboard", path: "/student/dashboard", icon: LayoutDashboard, label: "My Dashboard" },
    ],
    advisor: [
      { id: "dashboard", path: "/advisor/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { id: "students", path: "/advisor/students", icon: Users, label: "My Students" },
      { id: "upload", path: "/advisor/upload", icon: Upload, label: "Upload Results" },
      { id: "corrections", path: "/advisor/corrections", icon: CheckSquare, label: "Corrections" },
    ],
    admin: [
      { id: "dashboard", path: "/admin/dashboard", icon: ShieldAlert, label: "Admin Control" },
      { id: "settings", path: "/admin/settings", icon: Settings, label: "System Config" },
    ]
  };

  // Grab the correct menu for the current logged-in user
  const currentNavItems = navMenus[userRole] || navMenus.student;

  const NavItem = ({ path, icon: Icon, label, badge }: { path: string; icon: any; label: string; badge?: number }) => {
    // Advanced active state checking
    const isActive = location.pathname === path || location.pathname.startsWith(`${path}/`);

    return (
      <button
        onClick={() => {
          navigate(path);
          setIsMobileMenuOpen(false);
        }}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
          isActive
            ? "bg-[#990033] text-white shadow-md"
            : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <div className="flex items-center space-x-3">
          <Icon className="w-5 h-5" />
          <span className="font-medium">{label}</span>
        </div>
        {badge !== undefined && badge > 0 && (
          <span className="bg-[#FFCC00] text-[#990033] text-xs font-bold px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out flex flex-col
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* Dynamic Logo Icon based on Role */}
            {userRole === "admin" ? <ShieldAlert className="w-8 h-8 text-[#990033]" /> : 
             userRole === "student" ? <GraduationCap className="w-8 h-8 text-[#990033]" /> : 
             <Users className="w-8 h-8 text-[#990033]" />}
             
            <div className="leading-tight">
              <span className="font-bold text-lg text-[#990033] block">SE Smart AA</span>
              <span className="text-xs text-gray-500 font-normal capitalize">
                {userRole} Portal
              </span>
            </div>
          </div>
          <button className="lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {currentNavItems.map((item) => (
            <NavItem key={item.id} {...item} />
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="mb-3 px-2">
            <p className="text-xs text-gray-500 font-medium">Logged in as</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
          </div>
          {/* ✨ THE FIXED LOGOUT BUTTON */}
          <button
            onClick={logout} 
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center space-x-4">
            <button
              className="lg:hidden cursor-pointer"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
            <div className="h-8 w-px bg-gray-200 hidden lg:block" />
            <div className="text-sm text-gray-500 hidden sm:block">
              <span className="font-medium text-gray-900">UTM</span> / Software Engineering
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#990033] rounded-full" />
            </button>
            <div className="flex items-center space-x-3 pl-3 border-l border-gray-200">
              <div className="w-8 h-8 bg-[#990033] text-white rounded-full flex items-center justify-center font-semibold text-sm">
                {userName.charAt(0)}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{userName}</p>
                <p className="text-xs text-gray-500 capitalize">{userRole}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}