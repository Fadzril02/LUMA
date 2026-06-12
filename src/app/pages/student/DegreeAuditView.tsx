import React from "react";
import { CheckCircle, AlertCircle, ShieldAlert } from "lucide-react";

export function DegreeAuditView() {
  // High-Fidelity Dummy Data for Showcase
  // This represents the UTM Software Engineering (SE-2024) Syllabus Requirements
  const auditData = [
    { category: "Core SE Modules", earned: 60, required: 90, color: "bg-[#990033]", bg: "bg-red-50" },
    { category: "Elective Modules", earned: 9, required: 21, color: "bg-indigo-600", bg: "bg-indigo-50" },
    { category: "University General Subjects", earned: 14, required: 19, color: "bg-[#FFCC00]", bg: "bg-yellow-50" }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. The Main Progress Bars */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4">
          <CheckCircle className="text-emerald-500" size={28} />
          <div>
            <h2 className="text-xl font-bold text-slate-800">Graduation Requirements Audit</h2>
            <p className="text-sm text-slate-500">Tracking against the Software Engineering Syllabus</p>
          </div>
        </div>
        
        <div className="space-y-8">
          {auditData.map((item, idx) => {
            const percentage = Math.min((item.earned / item.required) * 100, 100).toFixed(0);
            
            return (
              <div key={idx} className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="font-bold text-slate-700">{item.category}</span>
                  <div className="text-right">
                    <span className="text-lg font-black text-slate-900">{item.earned}</span>
                    <span className="text-sm text-slate-500 font-medium"> / {item.required} Credits</span>
                    <span className="ml-3 text-sm font-bold text-slate-400">({percentage}%)</span>
                  </div>
                </div>
                
                {/* Progress Bar UI */}
                <div className={`w-full ${item.bg} rounded-full h-4 overflow-hidden shadow-inner`}>
                  <div 
                    className={`${item.color} h-4 rounded-full transition-all duration-1000 ease-out relative overflow-hidden`} 
                    style={{ width: `${percentage}%` }}
                  >
                    {/* Add a subtle shine effect to the bars */}
                    <div className="absolute top-0 left-0 right-0 bottom-0 bg-white/20" style={{ clipPath: 'polygon(0 0, 100% 0, 80% 100%, 0% 100%)' }}></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Smart Advisor Action Panel (High Fidelity Warning) */}
      <div className="bg-rose-50 border border-rose-200 p-6 rounded-xl flex items-start gap-4 shadow-sm">
        <div className="bg-white p-2 rounded-full shadow-sm">
          <ShieldAlert className="text-rose-600 flex-shrink-0" size={28} />
        </div>
        <div>
          <h3 className="text-rose-800 font-bold text-lg">Smart Advisor Alert: Prerequisite Block</h3>
          <p className="text-rose-700 mt-2 leading-relaxed">
            System detected a failing grade ("E") in <strong>SECJ1013 (Programming Technique 1)</strong>. 
            You are currently blocked from registering for Advanced Data Structures next semester. 
            <br/><br/>
            <strong>Action Required:</strong> Please schedule a meeting with Madam Liyana immediately to adjust your curriculum plan.
          </p>
          <button className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors">
            Contact Academic Advisor
          </button>
        </div>
      </div>
      
    </div>
  );
}