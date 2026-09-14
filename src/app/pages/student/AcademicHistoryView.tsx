import React, { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

export function AcademicHistoryView({ courseHistory = [] }: { courseHistory?: any[] }) {
  const [expandedSems, setExpandedSems] = useState<string[]>([]);

  // Real DB academic history — no fake fallback data
  const dataToRender = courseHistory || [];

  // Group courses by semester
  const groupedResults = dataToRender.reduce((acc, course) => {
    const sem = course.session_semester || "Unknown Semester";
    if (!acc[sem]) acc[sem] = [];
    acc[sem].push(course);
    return acc;
  }, {} as Record<string, any[]>);

  const sortedSemesters = Object.keys(groupedResults).sort();

  const toggleSem = (sem: string) => {
    setExpandedSems(prev => prev.includes(sem) ? prev.filter(s => s !== sem) : [...prev, sem]);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="text-blue-900" size={20} />
          <span>Categorized Academic Timeline</span>
        </h2>
        <span className="text-xs text-gray-500 font-mono">
          {dataToRender.length} Modules Documented
        </span>
      </div>
      
      {sortedSemesters.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-gray-200 text-gray-500 text-sm shadow-sm">
          No academic records found. Upload a transcript slip to begin.
        </div>
      ) : (
        sortedSemesters.map((sem) => {
          const isExpanded = expandedSems.includes(sem);
          const semCourses = groupedResults[sem];
          
          return (
            <div key={sem} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Accordion Header */}
              <button 
                onClick={() => toggleSem(sem)} 
                className="w-full px-6 py-4 flex justify-between items-center bg-gray-50/70 hover:bg-gray-100/70 transition-colors cursor-pointer text-left"
              >
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Semester {sem}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{semCourses.length} Registered Courses</p>
                </div>
                {isExpanded ? <ChevronUp className="text-gray-400 w-5 h-5" /> : <ChevronDown className="text-gray-400 w-5 h-5" />}
              </button>

              {/* Accordion Body */}
              {isExpanded && (
                <div className="border-t border-gray-200 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50/50 text-gray-600 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 font-semibold uppercase">Course Code</th>
                        <th className="px-6 py-3 font-semibold uppercase">Course Title</th>
                        <th className="px-6 py-3 font-semibold uppercase text-center">Credits</th>
                        <th className="px-6 py-3 font-semibold uppercase text-center">Grade</th>
                        <th className="px-6 py-3 font-semibold uppercase text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {semCourses.map((course, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="px-6 py-3.5 font-mono text-gray-700 font-semibold">{course.code}</td>
                          <td className="px-6 py-3.5 font-medium text-gray-900">{course.name}</td>
                          <td className="px-6 py-3.5 text-center text-gray-600 font-mono">{course.credits}</td>
                          <td className="px-6 py-3.5 text-center font-bold text-gray-900 font-mono">{course.grade}</td>
                          <td className="px-6 py-3.5 text-right">
                            {course.status === "Pass" || course.status === "Passed" ? (
                              <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                PASSED
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertTriangle size={11}/> FAILED
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}