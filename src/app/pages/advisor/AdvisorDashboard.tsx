import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // Changed to react-router-dom for Vite
import { motion } from "motion/react";
import {
  Users,
  AlertTriangle,
  Clock,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "../../components/ui";
import { AppLayout } from "../../components/AppLayout";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../lib/supabase";

// We will keep the lists as mock data for the presentation's visual layout, 
// but we will make the core Hero Metrics 100% live!
const RECENT_ACTIVITIES = [
  {
    student: "Ahmad Bin Abdullah",
    action: "Uploaded result slip",
    time: "2 hours ago",
    type: "upload",
  },
  {
    student: "Sarah Binti Othman",
    action: "Submitted correction request",
    time: "5 hours ago",
    type: "correction",
  },
  {
    student: "Lim Wei Ming",
    action: "CGPA improved to 3.90",
    time: "1 day ago",
    type: "improvement",
  },
];

const AT_RISK_STUDENTS = [
  {
    id: "A20EC0023",
    name: "Sarah Binti Othman",
    cgpa: 2.15,
    issue: "Failed Prerequisite",
  },
  {
    id: "A20EC0078",
    name: "Priya a/p Ramesh",
    cgpa: 1.95,
    issue: "Academic Probation",
  },
];

export default function AdvisorDashboard() { // Note: Switched to export default to match App.tsx import
  const navigate = useNavigate();
  const { profile } = useAuth(); // ✨ Pulls live advisor identity

  // ✨ State to hold our live database counts
  const [stats, setStats] = useState({
    totalStudents: 0,
    pendingRequests: 0,
    atRiskCount: 0,
  });

  useEffect(() => {
    const fetchLiveMetrics = async () => {
      try {
        // 1. Count Total Students in the system
        const { count: studentCount } = await db
          .from("students")
          .select("*", { count: "exact", head: true });

        // 2. Count Pending Verifications from Ali's trigger
        const { count: pendingCount } = await db
          .from("correction_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "Pending");

        // 3. Count At-Risk occurrences (Failed grades)
        const { count: failCount } = await db
          .from("results")
          .select("*", { count: "exact", head: true })
          .eq("status", "Fail");

        setStats({
          totalStudents: studentCount || 0,
          pendingRequests: pendingCount || 0,
          atRiskCount: failCount || 0,
        });
      } catch (error) {
        console.error("Failed to fetch dashboard metrics:", error);
      }
    };

    fetchLiveMetrics();
  }, []);

  return (
    <AppLayout userRole="advisor" userName={profile?.name || "Academic Advisor"}>
      <div className="p-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto space-y-6"
        >
          {/* Hero Metrics */}
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">
              Academic Advisor Dashboard
            </h1>
            <p className="text-sm text-gray-500">
              Overview of your assigned students and pending tasks
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Students (LIVE) */}
            <Card
              className="border-t-4 border-t-[#990033] hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate("/advisor/students")}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase">
                      Total Students
                    </p>
                    <div className="mt-2 flex items-baseline space-x-2">
                      <span className="text-4xl font-bold text-gray-900">
                        {stats.totalStudents} {/* ✨ Live DB Variable */}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      System-wide enrollment
                    </p>
                  </div>
                  <div className="bg-[#990033]/10 p-3 rounded-lg">
                    <Users className="w-6 h-6 text-[#990033]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* At-Risk Students (LIVE) */}
            <Card className="border-t-4 border-t-destructive hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase">
                      At-Risk Alerts
                    </p>
                    <div className="mt-2 flex items-baseline space-x-2">
                      <span className="text-4xl font-bold text-destructive">
                        {stats.atRiskCount} {/* ✨ Live DB Variable */}
                      </span>
                      {stats.atRiskCount > 0 && (
                        <Badge variant="danger" className="text-xs">
                          Action Required
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Failed courses detected
                    </p>
                  </div>
                  <div className="bg-destructive/10 p-3 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pending Verifications (LIVE) */}
            <Card
              className="border-t-4 border-t-[#FFCC00] hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate("/advisor/corrections")}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase">
                      Pending Verifications
                    </p>
                    <div className="mt-2 flex items-baseline space-x-2">
                      <span className="text-4xl font-bold text-gray-900">
                        {stats.pendingRequests} {/* ✨ Live DB Variable */}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Correction requests awaiting review
                    </p>
                  </div>
                  <div className="bg-[#FFCC00]/20 p-3 rounded-lg">
                    <Clock className="w-6 h-6 text-[#997a00]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Two Column Layout (Mock Data for Presentation Layout) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* At-Risk Students Detail */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>At-Risk Watchlist</CardTitle>
                <button className="text-sm text-[#990033] hover:underline font-medium">
                  View All
                </button>
              </CardHeader>
              <CardContent className="space-y-3">
                {AT_RISK_STUDENTS.map((student) => (
                  <div
                    key={student.id}
                    className="p-4 border border-red-200 bg-red-50/50 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(`/advisor/students/${student.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-semibold text-gray-900">
                            {student.name}
                          </h4>
                          <Badge variant="danger" className="text-xs">
                            {student.issue}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{student.id}</p>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className="text-sm text-gray-600">
                            CGPA:{" "}
                            <span className="font-semibold text-destructive">
                              {student.cgpa.toFixed(2)}
                            </span>
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {RECENT_ACTIVITIES.map((activity, idx) => (
                  <div
                    key={idx}
                    className="flex items-start space-x-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0"
                  >
                    <div
                      className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                        activity.type === "upload"
                          ? "bg-blue-500"
                          : activity.type === "correction"
                            ? "bg-[#FFCC00]"
                            : "bg-green-500"
                      }`}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.student}
                      </p>
                      <p className="text-sm text-gray-600">{activity.action}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => navigate("/advisor/upload")}
                  className="p-4 border border-gray-200 rounded-lg hover:border-[#990033] hover:bg-[#990033]/5 transition-colors text-left group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-[#990033]/10 p-2 rounded-lg group-hover:bg-[#990033]/20">
                      <TrendingUp className="w-5 h-5 text-[#990033]" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Upload Results</p>
                      <p className="text-xs text-gray-500">
                        Process student result slips
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => navigate("/advisor/students")}
                  className="p-4 border border-gray-200 rounded-lg hover:border-[#990033] hover:bg-[#990033]/5 transition-colors text-left group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-[#990033]/10 p-2 rounded-lg group-hover:bg-[#990033]/20">
                      <Users className="w-5 h-5 text-[#990033]" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        View All Students
                      </p>
                      <p className="text-xs text-gray-500">
                        Search and filter records
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => navigate("/advisor/corrections")}
                  className="p-4 border border-gray-200 rounded-lg hover:border-[#990033] hover:bg-[#990033]/5 transition-colors text-left group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-[#990033]/10 p-2 rounded-lg group-hover:bg-[#990033]/20">
                      <Clock className="w-5 h-5 text-[#990033]" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        Review Corrections
                      </p>
                      <p className="text-xs text-gray-500">
                        Approve or reject requests
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}