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

  const advisorStaffId = (profile as any)?.staff_id || user?.user_metadata?.staff_id || "STAFF-LIYANA";

  useEffect(() => {
    const fetchAdvisorData = async () => {
      try {
        setIsLoading(true);

        // 1. Fetch uploaded documents queue
        const { data: queueData } = await db
          .from("uploaded_documents")
          .select("*")
          .order("uploaded_at", { ascending: false });
        if (queueData) setAuditQueue(queueData);

        // 2. Fetch assigned students
        let studentsQuery = db.from("students").select("*");
        if (advisorStaffId) {
          studentsQuery = studentsQuery.eq("advisor_staff_id", advisorStaffId);
        }
        const { data: studentsData } = await studentsQuery;

        // 3. Fetch academic records
        const { data: recordsData } = await db
          .from("academic_records")
          .select("*");

        if (studentsData) {
          const liveRoster = studentsData.map((student: any) => {
            const studentRecords = (recordsData || []).filter(
              (r: any) => r.matric_no === student.matric_no
            );

            let totalPts = 0;
            let gradedCreds = 0;
            let earnedCreds = 0;

            studentRecords.forEach((r: any) => {
              const credits = Number(r.credits) || 3;
              if (r.status === "Pass" || r.status === "Passed") {
                earnedCreds += credits;
                if (r.grade !== "HL" && r.grade !== "N/A" && r.grade_point !== null && r.grade_point !== undefined) {
                  totalPts += Number(r.grade_point) * credits;
                  gradedCreds += credits;
                }
              }
            });

            const cgpa = gradedCreds > 0 ? totalPts / gradedCreds : Number(student.cgpa || 0);
            const isAtRisk = cgpa < 2.5 && studentRecords.length > 0;
            const status = isAtRisk ? "At-Risk" : (student.academic_status || "Good Standing");

            return {
              id: student.matric_no,
              name: student.name || "Student",
              matric_no: student.matric_no,
              program: student.program || "SECJ",
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

    fetchAdvisorData();
  }, [advisorStaffId]);

  const atRiskCount = roster.filter(s => s.status === "At-Risk" || s.academic_status === "At-Risk").length;
  const pendingDocsCount = auditQueue.filter(
    q => q.processing_status === "Pending_Advisor_Approval" || q.processing_status === "Pending"
  ).length;

  return (
    <AdvisorLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
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
                <CorrectionsQueue queue={auditQueue} roster={roster} />
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </AdvisorLayout>
  );
}