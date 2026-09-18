import React from "react";
import { CheckCircle2, AlertCircle, ShieldAlert } from "lucide-react";

export function DegreeAuditView() {
  const auditData = [
    { category: "Core Software Engineering Modules", earned: 60, required: 90, color: "bg-blue-900", bg: "bg-blue-50" },
    { category: "Departmental Elective Modules", earned: 9, required: 21, color: "bg-blue-700", bg: "bg-blue-50" },
    { category: "University General Requirements", earned: 14, required: 19, color: "bg-blue-500", bg: "bg-blue-50" }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Main Graduation Requirements Progress */}
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Graduation Requirements Audit</h2>
            <p className="text-xs text-gray-500">Tracking against the Degree Program Syllabus Blueprint</p>
          </div>
        </div>
        
        <div className="space-y-6">
          {auditData.map((item, idx) => {
            const percentage = Math.min((item.earned / item.required) * 100, 100).toFixed(0);
            
            return (
              <div key={idx} className="space-y-2.5">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-bold text-gray-700">{item.category}</span>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-gray-900">{item.earned}</span>
                    <span className="text-xs text-gray-500 font-medium"> / {item.required} Credits</span>
                    <span className="ml-2 text-xs font-semibold text-blue-900">({percentage}%)</span>
                  </div>
                </div>
                
                {/* Progress Bar UI */}
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`${item.color} h-3 rounded-full transition-all duration-700 ease-out`} 
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advisor Prerequisite Alert Panel */}
      <div className="bg-rose-50 border border-rose-200 p-6 rounded-xl flex items-start gap-4 shadow-sm">
        <div className="bg-white p-2.5 rounded-lg border border-rose-200 shadow-xs shrink-0">
          <ShieldAlert className="text-rose-700" size={22} />
        </div>
        <div>
          <h3 className="text-rose-900 font-bold text-sm">Prerequisite Verification Alert</h3>
          <p className="text-rose-800 text-xs mt-1.5 leading-relaxed">
            A non-passing grade ("E") was registered in <strong>CS101 (Introduction to Computer Science)</strong>. 
            Directed acyclic graph verification indicates a prerequisite hold on advanced algorithms and software architecture modules.
          </p>
          <p className="text-rose-700 text-xs mt-2 font-medium">
            Contact your academic advisor to re-evaluate your semester study plan.
          </p>
        </div>
      </div>
      
    </div>
  );
}