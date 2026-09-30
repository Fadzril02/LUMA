import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../lib/supabase";

import { AdvisorLayout } from "./AdvisorLayout";
import { AdvisorDashboard } from "./AdvisorDashboard";
import { StudentsList } from "./StudentsList";
import { CorrectionsQueue } from "./CorrectionsQueue";

export function AdvisorPortal() {
  const { profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");

  const [roster, setRoster] = useState<any[]>([]);
  const [auditQueue, setAuditQueue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const advisorStaffId = (profile as any)?.staff_id;

  const fetchAdvisorData = async (isSilent: boolean = false) => {
    // Security Check: Guard to ensure advisor context is loaded before querying
    if (!advisorStaffId) {
      setIsLoading(false);
      return;
    }

    try {
      // Only show the full-page spinner on first load; background refreshes must not unmount children (e.g. open upload modal)
      if (!isSilent) setIsLoading(true);

      // 1. Fetch assigned students: prefer backend-computed advisee_roster_summary view, fallback to students table
      let studentsData: any[] | null = null;
      try {
        const { data: summaryRows, error: summaryErr } = await db
          .from("advisee_roster_summary")
          .select("*")
          .eq("advisor_staff_id", advisorStaffId);

        if (!summaryErr && summaryRows && summaryRows.length > 0) {
          studentsData = summaryRows;
        }
      } catch (e) {
        console.warn("[AdvisorPortal] advisee_roster_summary notice:", e);
      }

      if (!studentsData) {
        const { data: fallbackRows } = await db
          .from("students")
          .select("*")
          .eq("advisor_staff_id", advisorStaffId);
        studentsData = fallbackRows;
      }

      const adviseeMatricNos = (studentsData || []).map((s: any) => s.matric_no).filter(Boolean);

      // 2. Fetch uploaded documents queue for this advisor's advisees
      let queueQuery = db
        .from("uploaded_documents")
        .select("*")
        .order("uploaded_at", { ascending: false });
      if (adviseeMatricNos.length > 0) {
        queueQuery = queueQuery.in("matric_no", adviseeMatricNos);
      }
      const { data: queueData } = await queueQuery;
      if (queueData) setAuditQueue(queueData);

      // 3. Fetch academic records strictly for this advisor's advisees
      let recordsQuery = db.from("academic_records").select("*");
      if (adviseeMatricNos.length > 0) {
        recordsQuery = recordsQuery.in("matric_no", adviseeMatricNos);
      }
      const { data: recordsData } = await recordsQuery;

      if (studentsData) {
        const liveRoster = studentsData.map((student: any) => {
          const studentRecords = (recordsData || []).filter(
            (r: any) => r.matric_no === student.matric_no
          );

          // Use backend-computed values from students.cgpa and total_earned_credits
          const rawCgpa = student.current_cgpa ?? student.cgpa;
          const cgpa = rawCgpa !== null && rawCgpa !== undefined ? Number(rawCgpa) : 0;
          const rawCredits = student.total_earned_credits ?? student.credits;
          const earnedCreds = rawCredits !== null && rawCredits !== undefined ? Number(rawCredits) : 0;

          const isAtRisk = (cgpa < 2.5 && cgpa > 0) || student.academic_status === "At-Risk" || student.academic_status === "Probation";
          const status = student.academic_status || (isAtRisk ? "At-Risk" : "Good Standing");

          return {
            id: student.matric_no,
            name: student.student_name || student.name || "Student",
            matric_no: student.matric_no,
            program: student.program || "Unassigned",
            cgpa: cgpa,
            credits: earnedCreds,
            status: status,
            academic_status: status,
            rawRecords: studentRecords
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

  useEffect(() => {
    fetchAdvisorData();

    // Safety timer (2.5 seconds): unconditionally flips page-level loading state to false
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [advisorStaffId]);

  // Task 4: Wake-Up Data Refresh on window focus
  useEffect(() => {
    const handleFocus = () => {
      console.log("Tab regained focus. Refreshing advisor portal data...");
      fetchAdvisorData(true);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [advisorStaffId]);

  // Task 3: Unblocked side-menu tab change handler
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    fetchAdvisorData(true);
  };

  const atRiskCount = roster.filter(s => s.status === "At-Risk" || s.academic_status === "At-Risk").length;
  const pendingDocsCount = auditQueue.filter(
    q => q.processing_status === "Pending_Advisor_Approval" || q.processing_status === "Pending"
  ).length;

  return (
    <AdvisorLayout
      activeTab={activeTab}
      onTabChange={handleTabChange}
      badgeCounts={{
        atRisk: atRiskCount,
        pendingQueue: pendingDocsCount
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="w-full"
        >
          {isLoading ? (
            <div className="p-16 text-center text-slate-400 font-mono text-xs flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="tracking-widest uppercase">INITIALIZING COHORT DIAGNOSTICS CONTEXT...</span>
            </div>
          ) : (
            <>
              {activeTab === "dashboard" && (
                <AdvisorDashboard />
              )}

              {activeTab === "students" && (
                <StudentsList />
              )}

              {activeTab === "queue" && (
                <CorrectionsQueue queue={auditQueue} roster={roster} onApproved={fetchAdvisorData} />
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </AdvisorLayout>
  );
}