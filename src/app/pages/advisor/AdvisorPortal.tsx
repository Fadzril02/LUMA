import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, Bell, CheckSquare, LogOut, Menu
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../lib/supabase";

import { AdvisorDashboard } from "./AdvisorDashboard";
import { StudentsList } from "./StudentsList";
import { CorrectionsQueue } from "./CorrectionsQueue";

export function AdvisorPortal() {
  const navigate = useNavigate();
  const { profile, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [roster, setRoster] = useState<any[]>([]);
  const [auditQueue, setAuditQueue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAdvisorData = async () => {
      try {
        setIsLoading(true);
        
        const { data: queueData } = await db
          .from("uploaded_documents")
          .select("*")
          .order("uploaded_at", { ascending: false });
        if (queueData) setAuditQueue(queueData);

        const { data: studentsData } = await db
          .from("students")
          .select("*");

        const { data: resultsData } = await db
          .from("results")
          .select("*, course(credit_hour)");

        if (studentsData && resultsData) {
          const liveRoster = studentsData.map((student: any) => {
            const myResults = resultsData.filter((r: any) => r.matric_no === student.matric_no);
            
            let totalPts = 0;
            let gradedCreds = 0;
            let earnedCreds = 0;

            myResults.forEach((r: any) => {
              const credits = r.course?.credit_hour || 3;
              if (r.status === "Pass") {
                earnedCreds += credits;
                if (r.grade !== "HL" && r.grade !== "N/A") {
                  totalPts += r.point_value * credits;
                  gradedCreds += credits;
                }
              }
            });

            const cgpa = gradedCreds > 0 ? totalPts / gradedCreds : 0;
            const status = cgpa < 2.5 && myResults.length > 0 ? "At-Risk" : "Good Standing";

            return {
              id: student.matric_no,
              name: student.name || "Student",
              cgpa: cgpa,
              credits: earnedCreds,
              status: status,
              rawResults: myResults
            };
          });

          setRoster(liveRoster);
        }
      } catch (err) {
        console.error("Database sync failed inside AdvisorPortal:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAdvisorData();
  }, []);

  const atRiskCount = roster.filter(s => s.status === 'At-Risk').length;
  
  // 👈 FIXED: Now correctly counts Maker-Checker pending tickets
  const pendingDocsCount = auditQueue.filter(q => q.processing_status === "Pending_Advisor_Approval").length;

  const NavItem = ({ id, icon: Icon, label, badgeCount }: { id: string; icon: any; label: string, badgeCount?: number }) => (
    <button
      onClick={() => { setActiveTab(id); setIsMobileMenuOpen(false); }}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
        activeTab === id 
          ? "bg-[#990033] text-white shadow-md shadow-[#990033]/10" 
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      <div className="flex items-center space-x-3">
        <Icon className="w-5 h-5" />
        <span className="font-medium">{label}</span>
      </div>
      {badgeCount !== undefined && badgeCount > 0 && (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${activeTab === id ? 'bg-white text-[#990033]' : 'bg-[#FFCC00] text-[#990033]'}`}>
          {badgeCount}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex">
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out flex flex-col ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <Users className="w-8 h-8 text-[#990033]" />
            <span className="font-bold text-lg text-[#990033] leading-tight">SE Smart AA<br/><span className="text-xs text-gray-500 font-normal">Advisor: {profile?.name || "Madam Liyana"}</span></span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavItem id="dashboard" icon={Users} label="Dashboard Hub" />
          <NavItem id="students" icon={Users} label="My Advisees" badgeCount={atRiskCount} />
          {/* 👈 REMOVED THE UPLOAD TAB */}
          <NavItem id="queue" icon={CheckSquare} label="Corrections Queue" badgeCount={pendingDocsCount} />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button onClick={logout} className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center">
            <button className="lg:hidden mr-4" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
            <h1 className="text-xl font-semibold text-gray-800 capitalize">
              {activeTab === 'dashboard' && 'Cohort Diagnostics'}
              {activeTab === 'students' && 'Advisee Performance List'}
              {activeTab === 'queue' && 'Discrepancy Resolution Hub'}
            </h1>
          </div>
          <div className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full hidden sm:inline-block">
            Role Auth: Institutional Advisor
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
              className="max-w-6xl mx-auto"
            >
              {isLoading ? (
                <div className="p-12 text-center text-gray-400 font-mono text-sm animate-pulse">
                  SYNCING MASTER DATABASE INFRASTRUCTURE...
                </div>
              ) : (
                <>
                  {activeTab === "dashboard" && (
                    <AdvisorDashboard roster={roster} queue={auditQueue} />
                  )}
                  
                  {activeTab === "students" && (
                    <StudentsList roster={roster} />
                  )}
                  
                  {/* 👈 REMOVED THE UPLOAD COMPONENT */}
                  
                  {activeTab === "queue" && (
                    <CorrectionsQueue queue={auditQueue} roster={roster} />
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}