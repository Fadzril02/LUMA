import React, { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { 
  Settings, Book, Calendar, Plus, Edit2, Trash2, Menu, X, LogOut, Save
} from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Badge } from "../../components/ui";

const MOCK_COURSES = [
  { code: "SECJ1013", name: "Programming Technique I", credits: 3, prereqs: "None", type: "Core" },
  { code: "SECJ1023", name: "Programming Technique II", credits: 3, prereqs: "SECJ1013", type: "Core" },
  { code: "SECP1513", name: "Technology & Information System", credits: 3, prereqs: "None", type: "Core" },
];

const MOCK_INTAKES = [
  { year: "2020/2021", name: "SE Curriculum Rev A", status: "Active", totalCredits: 130 },
  { year: "2022/2023", name: "SE Curriculum Rev B", status: "Active", totalCredits: 132 },
  { year: "2024/2025", name: "SE Curriculum Rev C", status: "Draft", totalCredits: 128 },
];

export function AdminPortal() {
  const navigate = useNavigate();
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
          ? "bg-[#990033] text-white" 
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
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
            <Settings className="w-8 h-8 text-[#990033]" />
            <span className="font-bold text-lg text-[#990033] leading-tight">SE Smart AA<br/><span className="text-xs text-gray-500 font-normal">System Admin</span></span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavItem id="courses" icon={Book} label="Course Manager" />
          <NavItem id="intakes" icon={Calendar} label="Intake Configuration" />
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
              {activeTab === 'courses' ? 'Course & Prerequisite Manager' : 'Intake Configuration'}
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-500 hidden sm:inline-flex items-center bg-gray-100 px-3 py-1.5 rounded-full">
              System Administrator
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
              {activeTab === "courses" && (
                <>
                  <div className="flex justify-between items-center">
                    <p className="text-gray-600">Define course dependencies, credits, and rules.</p>
                    <Button><Plus className="w-4 h-4 mr-2"/> Add Course</Button>
                  </div>

                  <Card>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50/50">
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Course Code</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Name</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Credits</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Prerequisites</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Type</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MOCK_COURSES.map((course) => (
                            <tr key={course.code} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 font-medium text-[#990033]">{course.code}</td>
                              <td className="px-6 py-4 text-gray-900">{course.name}</td>
                              <td className="px-6 py-4 text-gray-600">{course.credits}</td>
                              <td className="px-6 py-4 text-gray-600">
                                {course.prereqs === 'None' ? (
                                  <span className="text-gray-400 italic">None</span>
                                ) : (
                                  <Badge variant="outline">{course.prereqs}</Badge>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <Badge>{course.type}</Badge>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex space-x-2">
                                  <button className="p-1.5 text-gray-500 hover:text-[#990033] transition-colors rounded hover:bg-red-50">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button className="p-1.5 text-gray-500 hover:text-red-600 transition-colors rounded hover:bg-red-50">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </>
              )}

              {activeTab === "intakes" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">Configured Intakes</h3>
                      <Button variant="outline"><Plus className="w-4 h-4 mr-2"/> New Intake</Button>
                    </div>
                    {MOCK_INTAKES.map((intake) => (
                      <Card key={intake.year} className="group hover:border-[#990033]/50 transition-colors">
                        <CardContent className="p-6 flex justify-between items-center">
                          <div>
                            <div className="flex items-center space-x-3 mb-1">
                              <h4 className="text-lg font-bold text-gray-900">{intake.year}</h4>
                              <Badge variant={intake.status === 'Active' ? 'success' : 'warning'}>{intake.status}</Badge>
                            </div>
                            <p className="text-gray-600">{intake.name} • {intake.totalCredits} Credits Total</p>
                          </div>
                          <Button variant="ghost" size="icon">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card className="h-fit">
                    <CardHeader>
                      <CardTitle className="flex items-center"><Plus className="w-5 h-5 mr-2" /> Quick Add</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Intake Session</Label>
                        <Input placeholder="e.g. 2025/2026" />
                      </div>
                      <div className="space-y-2">
                        <Label>Curriculum Template</Label>
                        <select className="flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#990033]">
                          <option>Clone from 2024/2025</option>
                          <option>Blank Template</option>
                        </select>
                      </div>
                      <Button className="w-full mt-4"><Save className="w-4 h-4 mr-2"/> Create Intake</Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
