import React, { useState, useEffect } from "react";
import { Search, Filter, AlertTriangle, CheckCircle2, ChevronRight, GraduationCap, Loader2, AlertOctagon } from "lucide-react";
import { Card, Input, Button } from "../../components/ui";
import { db } from "../../../lib/supabase"; // 🔌 SUPABASE IMPORT

// 🔌 IMPORT YOUR STUDENT deep-dive view
import { StudentView } from "./StudentView";

// Notice we removed the props! This component now fetches its own data.
export function StudentsList() {
  const [roster, setRoster] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All"); // 'All', 'At-Risk', 'Safe'
  
  // 👈 Track who Madam Liyana clicked on
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);


useEffect(() => {
  const fetchStudents = async () => {
    try {
      // 1. Get the current advisor's ID (e.g., 'STAFF-LIYANA')
      // You can get this from your AuthContext or simply filter by the hardcoded ID 
      // to match your DB column 'advisor_staff_id'
      const currentAdvisorId = 'STAFF-LIYANA'; 

      const { data, error } = await db
        .from('students')
        .select('*')
        .eq('advisor_staff_id', currentAdvisorId) // 👈 THE MAGIC FILTER
        .order('name', { ascending: true }); 

      if (error) {
        setDbError(error.message);
        throw error;
      }
      
      if (data) {
        setRoster(data);
        setDbError(null);
      }
    } catch (error: any) {
      console.error("Error fetching students:", error);
    } finally {
      setIsLoading(false);
    }
  };

  fetchStudents();
}, []);

  // 🔍 Dynamic Filtering Logic (Mapped to Supabase columns)
  const filteredRoster = roster.filter((student) => {
    const matchesSearch = 
      student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.matric_no?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Map database academic_status to your UI filters
    const isAtRisk = ["At-Risk", "Probation"].includes(student.academic_status);
    
    const matchesStatus = 
      statusFilter === "All" ? true :
      statusFilter === "At-Risk" ? isAtRisk :
      !isAtRisk; // "Safe" means they aren't At-Risk or Probation
    
    return matchesSearch && matchesStatus;
  });

  // 🔄 ROUTER: If a student is clicked, show their specific profile instead of the list
  if (selectedStudent) {
    return (
      <StudentView 
        student={selectedStudent} 
        onBack={() => setSelectedStudent(null)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      
      {/* 🛑 ERROR BANNER (If Supabase connection fails) */}
      {dbError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start space-x-3">
          <AlertOctagon className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold">Database Connection Error</h4>
            <p className="text-sm font-mono mt-1">{dbError}</p>
          </div>
        </div>
      )}

      {/* HEADER & SEARCH CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Advisee Roster</h2>
          <p className="text-sm text-gray-500">Manage and monitor student academic health.</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input 
              placeholder="Search name or matric no..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 border-gray-200"
            />
          </div>
          <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button 
              onClick={() => setStatusFilter("All")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${statusFilter === "All" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              All
            </button>
            <button 
              onClick={() => setStatusFilter("Good Standing")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${statusFilter === "Good Standing" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Safe
            </button>
            <button 
              onClick={() => setStatusFilter("At-Risk")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center ${statusFilter === "At-Risk" ? "bg-white text-amber-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              At-Risk
            </button>
          </div>
        </div>
      </div>

      {/* THE CRM DATA TABLE */}
      <Card className="border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student Profile</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Academic Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Current CGPA</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Credits Earned</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              
              {/* LOADING STATE */}
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="w-8 h-8 mx-auto text-[#990033] animate-spin mb-3" />
                    <p>Fetching advisees from Supabase...</p>
                  </td>
                </tr>
              ) : filteredRoster.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <Filter className="w-8 h-8 text-gray-300 mb-3" />
                      <p>No students match your current filters.</p>
                      <Button variant="outline" size="sm" className="mt-4" onClick={() => {setSearchTerm(""); setStatusFilter("All");}}>Clear Filters</Button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRoster.map((student) => {
                  const isAtRisk = ["At-Risk", "Probation"].includes(student.academic_status);
                  // Mocking credits visually based on CGPA just so the UI bar doesn't break
                  const visualCredits = student.credits || Math.min(Math.floor(Number(student.cgpa) * 30), 130) || 90;

                  return (
                    <tr key={student.matric_no} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100 text-indigo-700">
                            <GraduationCap className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{student.name}</div>
                            <div className="font-mono text-xs text-[#990033]">{student.matric_no}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isAtRisk ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3 h-3 mr-1.5" /> {student.academic_status}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1.5" /> {student.academic_status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-bold ${Number(student.cgpa) < 2.5 ? 'text-rose-600' : 'text-gray-900'}`}>
                          {Number(student.cgpa).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 font-medium">{visualCredits} / 130</div>
                        <div className="w-24 bg-gray-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${isAtRisk ? 'bg-amber-400' : 'bg-emerald-500'}`} 
                            style={{ width: `${(visualCredits / 130) * 100}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setSelectedStudent(student)}
                          className="text-[#990033] hover:bg-red-50 hover:text-[#80002A] group-hover:translate-x-1 transition-transform"
                        >
                          Open Profile <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}