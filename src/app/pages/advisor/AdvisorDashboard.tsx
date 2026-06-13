import React, { useState, useEffect } from "react";
import { Users, AlertTriangle, ClipboardCheck, Percent, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "../../components/ui";
import { db } from "../../../lib/supabase"; 

export function AdvisorDashboard() {
  const [roster, setRoster] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      // Fetch both datasets simultaneously
      const [studentsRes, queueRes] = await Promise.all([
        db.from('students').select('*').eq('advisor_staff_id', 'STAFF-LIYANA'),
        db.from('correction_requests').select('*')
      ]);

      if (studentsRes.data) setRoster(studentsRes.data);
      if (queueRes.data) setQueue(queueRes.data);
      setIsLoading(false);
    };
    fetchData();
  }, []);

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-[#990033] w-8 h-8" /></div>;

  // Logic to calculate dashboard stats
  const totalStudents = roster.length;
  // Use academic_status column
  const atRiskStudents = roster.filter((s) => ["At-Risk", "Probation"].includes(s.academic_status));
  // Check correction_requests status
  const pendingAudits = queue.filter((q) => q.status === "Pending").length;
  
  const totalCgpa = roster.reduce((sum, s) => sum + (Number(s.cgpa) || 0), 0);
  const averageCgpa = totalStudents > 0 ? totalCgpa / totalStudents : 0;

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Advisees" value={totalStudents} icon={Users} description="Active cohorts" badgeColor="text-blue-600" />
        <MetricCard title="At-Risk Alerts" value={atRiskStudents.length} icon={AlertTriangle} description="CGPA below 2.5" badgeColor="text-amber-500" />
        <MetricCard title="Pending Audits" value={pendingAudits} icon={ClipboardCheck} description="Awaiting authorization" badgeColor="text-[#990033]" />
        <MetricCard title="Cohort CGPA" value={averageCgpa.toFixed(2)} icon={Percent} description="Average performance" badgeColor="text-emerald-600" />
      </div>

      {/* Urgent Intervention Card */}
      <Card className="border border-amber-100 shadow-sm">
        <CardHeader className="bg-amber-50/50 border-b border-amber-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-amber-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" /> Urgent Academic Intervention
            </CardTitle>
            <Badge className="bg-amber-200 text-amber-900 font-bold">{atRiskStudents.length} Flagged</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 max-h-[350px] overflow-y-auto">
          {atRiskStudents.length === 0 ? (
            <p className="p-8 text-center text-emerald-600 text-sm">🎉 Excellent! No intervention needed.</p>
          ) : (
            atRiskStudents.map((s) => (
              <div key={s.matric_no} className="p-4 flex items-center justify-between border-b last:border-0 hover:bg-gray-50">
                <div>
                  <h4 className="font-semibold text-gray-900">{s.name}</h4>
                  <span className="font-mono text-xs text-gray-500">{s.matric_no}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-rose-600">CGPA {Number(s.cgpa).toFixed(2)}</div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Helper Component
function MetricCard({ title, value, icon: Icon, description, badgeColor }: any) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">{title}</CardTitle>
        <Icon className={`w-5 h-5 ${badgeColor}`} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-gray-900">{value}</div>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}