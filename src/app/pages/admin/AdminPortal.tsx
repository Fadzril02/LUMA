import React, { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Settings, BookOpen, Calendar, Network, Layers, Menu, LogOut } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
// 🔌 IMPORT THE MODULES
import { CourseManagerView } from "./CourseManagerView";
import { IntakeConfigView } from "./IntakeConfigView";
// Modules we will build next:
import { PrerequisiteEngineView } from "./PrerequisiteEngineView";
import { ElectiveGroupView } from "./ElectiveGroupView";

export function AdminPortal() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState("courses");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const NavItem = ({ id, icon: Icon, label }: { id: string; icon: any; label: string }) => (
    <button
      onClick={() => {
        setActiveTab(id);
        setIsMobileMenuOpen(false);
      }}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
        activeTab === id 
          ? "bg-[#990033] text-white shadow-md shadow-[#990033]/10" 
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - STRICTLY ACADEMIC */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out flex flex-col ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <Settings className="w-8 h-8 text-[#990033]" />
            <span className="font-bold text-lg text-[#990033] leading-tight">SE Smart AA<br/><span className="text-xs text-gray-500 font-normal">Academic Admin</span></span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-2 px-4">Master Catalog</div>
          <NavItem id="courses" icon={BookOpen} label="Course Inventory" />
          <NavItem id="prereqs" icon={Network} label="Prerequisite Flow" />
          
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-6 px-4">Curriculum Design</div>
          <NavItem id="intakes" icon={Calendar} label="Batch Templates" />
          <NavItem id="electives" icon={Layers} label="Elective Groups" />
        </nav>

        <div className="p-4 border-t border-gray-100">
        <button 
          onClick={async () => {
            try {
              await logout(); // 1. Destroy the Supabase session
              navigate("/login"); // 2. Send them to the login screen
            } catch (error) {
              console.error("Error logging out:", error);
            }
          }}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center">
            <button 
              className="lg:hidden mr-4"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
            <h1 className="text-xl font-semibold text-gray-800 capitalize">
              {activeTab.replace('-', ' ')}
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-500 hidden sm:inline-flex items-center bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200">
              Curriculum Administrator
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-6xl mx-auto space-y-6"
            >
              {/* DYNAMIC COMPONENT RENDERING */}
              {activeTab === "courses" && <CourseManagerView />}
              {activeTab === "intakes" && <IntakeConfigView />}
              {activeTab === "prereqs" && <div className="text-gray-500 font-mono">Prerequisite flow builder pending...</div>}
              {activeTab === "electives" && <div className="text-gray-500 font-mono">Elective grouping system pending...</div>}
              {activeTab === "prereqs" && <PrerequisiteEngineView />}
              {activeTab === "electives" && <ElectiveGroupView />}            
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}