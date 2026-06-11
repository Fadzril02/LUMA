import React, { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, Bell, CheckSquare, Search, Filter, AlertCircle, ChevronRight, X, Menu, LogOut, Check, XCircle
} from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Input } from "../../components/ui";

const MOCK_STUDENTS = [
  { id: "A20EC0001", name: "Ahmad Bin Abdullah", cgpa: 3.75, credits: 88, status: "Good Standing" },
  { id: "A20EC0023", name: "Sarah Binti Othman", cgpa: 2.15, credits: 45, status: "At-Risk", alert: "Failed Prerequisite: SECJ1013" },
  { id: "A20EC0045", name: "Lim Wei Ming", cgpa: 3.90, credits: 110, status: "Good Standing" },
  { id: "A20EC0078", name: "Priya a/p Ramesh", cgpa: 1.95, credits: 36, status: "At-Risk", alert: "Academic Probation" },
];

const MOCK_QUEUE = [
  { id: "REQ-001", student: "Ahmad Bin Abdullah (A20EC0001)", course: "SECR1013", detail: "Grade discrepancy: Uploaded A, System shows B+", status: "Pending" },
  { id: "REQ-002", student: "Sarah Binti Othman (A20EC0023)", course: "SECJ1023", detail: "Missing course from extraction", status: "Pending" },
];

export function AdvisorPortal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStudents = MOCK_STUDENTS.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const NavItem = ({ id, icon: Icon, label, alertCount }: { id: string; icon: any; label: string, alertCount?: number }) => (
    <button
      onClick={() => {
        setActiveTab(id);
        setSelectedStudent(null);
        setIsMobileMenuOpen(false);
      }}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
        activeTab === id && !selectedStudent 
          ? "bg-[#990033] text-white" 
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      <div className="flex items-center space-x-3">
        <Icon className="w-5 h-5" />
        <span className="font-medium">{label}</span>
      </div>
      {alertCount !== undefined && alertCount > 0 && (
        <span className="bg-[#FFCC00] text-[#990033] text-xs font-bold px-2 py-0.5 rounded-full">
          {alertCount}
        </span>
      )}
    </button>
  );

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
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <Users className="w-8 h-8 text-[#990033]" />
            <span className="font-bold text-lg text-[#990033] leading-tight">SE Smart AA<br/><span className="text-xs text-gray-500 font-normal">Advisor Portal</span></span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavItem id="dashboard" icon={Users} label="My Students" />
          <NavItem id="alerts" icon={Bell} label="At-Risk Alerts" alertCount={2} />
          <NavItem id="queue" icon={CheckSquare} label="Approval Queue" alertCount={MOCK_QUEUE.length} />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={() => navigate("/")}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
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
              {selectedStudent ? `Student Detail: ${selectedStudent.id}` : 
               activeTab === 'dashboard' ? 'Assigned Students' : 
               activeTab === 'alerts' ? 'At-Risk Students' : 'Correction Queue'}
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-500 hidden sm:inline-flex items-center bg-gray-100 px-3 py-1.5 rounded-full">
              Verified Role: Academic Advisor
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedStudent ? "detail" : activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-6xl mx-auto space-y-6"
            >
              {!selectedStudent && activeTab === "dashboard" && (
                <>
                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <Input 
                        placeholder="Search student name or ID..." 
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Button variant="outline"><Filter className="w-4 h-4 mr-2"/> Filter</Button>
                  </div>

                  <Card>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50/50">
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Student ID</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Name</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">CGPA</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Credits</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStudents.map((student) => (
                            <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 font-medium text-gray-900">{student.id}</td>
                              <td className="px-6 py-4 text-gray-600">{student.name}</td>
                              <td className="px-6 py-4 font-semibold text-gray-900">{student.cgpa.toFixed(2)}</td>
                              <td className="px-6 py-4 text-gray-600">{student.credits}</td>
                              <td className="px-6 py-4">
                                <Badge variant={student.status === 'Good Standing' ? 'success' : 'danger'}>
                                  {student.status}
                                </Badge>
                              </td>
                              <td className="px-6 py-4">
                                <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(student)}>
                                  View <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </>
              )}

              {!selectedStudent && activeTab === "alerts" && (
                <div className="space-y-4">
                  {MOCK_STUDENTS.filter(s => s.status === 'At-Risk').map(student => (
                    <Card key={student.id} className="border-l-4 border-l-[#FFCC00]">
                      <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
                        <div className="flex items-start space-x-4">
                          <div className="bg-[#FFCC00]/20 p-3 rounded-full">
                            <AlertCircle className="w-6 h-6 text-[#997a00]" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 text-lg">{student.name} ({student.id})</h3>
                            <p className="text-[#990033] font-medium mt-1">{student.alert}</p>
                            <div className="flex space-x-4 mt-2 text-sm text-gray-600">
                              <span>CGPA: <strong>{student.cgpa.toFixed(2)}</strong></span>
                              <span>Credits: <strong>{student.credits}</strong></span>
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" onClick={() => setSelectedStudent(student)}>
                          Review Record
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {!selectedStudent && activeTab === "queue" && (
                <div className="space-y-4">
                  {MOCK_QUEUE.map(req => (
                    <Card key={req.id}>
                      <CardContent className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
                        <div>
                          <div className="flex items-center space-x-3 mb-2">
                            <Badge variant="warning">{req.status}</Badge>
                            <span className="text-sm font-medium text-gray-500">{req.id}</span>
                          </div>
                          <h3 className="font-semibold text-gray-900">{req.student}</h3>
                          <p className="text-gray-600 mt-1">
                            <span className="font-medium text-gray-900">{req.course}:</span> {req.detail}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">Submitted on 12 May 2026</p>
                        </div>
                        <div className="flex space-x-2 w-full md:w-auto">
                          <Button variant="danger" className="flex-1 md:flex-none" onClick={() => {}}>
                            <XCircle className="w-4 h-4 mr-2" /> Reject
                          </Button>
                          <Button variant="primary" className="flex-1 md:flex-none" onClick={() => {}}>
                            <Check className="w-4 h-4 mr-2" /> Approve
                          </Button>
                        </div>
                      </CardContent>
                      <div className="px-6 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
                        * Approving this request will modify the student's official academic record. Verified by Lecturer log will be created.
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Student Detail View */}
              {selectedStudent && (
                <div className="space-y-6">
                  <div className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
                    <button onClick={() => setSelectedStudent(null)} className="hover:text-[#990033]">Dashboard</button>
                    <ChevronRight className="w-4 h-4" />
                    <span className="text-gray-900">{selectedStudent.id}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="md:col-span-2">
                      <CardHeader>
                        <CardTitle>Course Structure Progress</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {/* Placeholder for complex curriculum tree or list */}
                        <div className="space-y-4">
                          <div className="p-4 border border-gray-200 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="font-semibold text-gray-800">Core Courses (Year 1 & 2)</h4>
                              <Badge variant="success">Completed</Badge>
                            </div>
                            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-green-500 h-full rounded-full" style={{ width: '100%' }} />
                            </div>
                          </div>
                          <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="font-semibold text-gray-800">Elective Modules</h4>
                              <Badge variant="danger">Action Required</Badge>
                            </div>
                            <p className="text-sm text-red-600 mb-2">Failed prerequisite SECJ1013 - Cannot register for SECJ2013.</p>
                            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-[#990033] h-full rounded-full" style={{ width: '45%' }} />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Student Snapshot</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-semibold">Name</p>
                          <p className="font-medium text-gray-900">{selectedStudent.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-semibold">CGPA</p>
                          <p className="font-bold text-2xl text-[#990033]">{selectedStudent.cgpa.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-semibold">Status</p>
                          <Badge variant={selectedStudent.status === 'Good Standing' ? 'success' : 'danger'} className="mt-1">
                            {selectedStudent.status}
                          </Badge>
                        </div>
                        <div className="pt-4 border-t border-gray-100">
                          <Button variant="outline" className="w-full">Message Student</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
