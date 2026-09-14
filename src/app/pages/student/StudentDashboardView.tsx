import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { Award, BookOpen, CheckCircle2 } from "lucide-react";

export function StudentDashboardView({ stats, creditProgress }: { stats?: any, creditProgress?: any[] }) {
  
  // Real DB stats — no fake fallback data
  const displayStats = stats || {
    cgpa: "0.00",
    earned: 0,
    required: 130
  };

  const displayProgress = creditProgress && creditProgress.length > 0 ? creditProgress : [];

  return (
    <div className="animate-fade-in space-y-6">
      
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Current CGPA</p>
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <span className="text-4xl font-extrabold text-gray-900 mt-3 block tracking-tight">{displayStats.cgpa}</span>
          <p className="text-xs text-gray-500 mt-1 font-medium">Cumulative Grade Point Average</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Credits Earned</p>
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-4xl font-extrabold text-gray-900 tracking-tight">{displayStats.earned}</span>
            <span className="text-sm text-gray-500 font-semibold">/ {displayStats.required} Credits</span>
          </div>
          <p className="text-xs text-gray-500 mt-1 font-medium">Total graduation credit requirement</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Academic Standing</p>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Good Standing (Kedudukan Baik)
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-3 font-medium">Clear for active course enrolment</p>
        </div>
      </div>
      
      {/* Curriculum Progression Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 tracking-tight">Curriculum Progression Over Time</h2>
            <p className="text-xs text-gray-500 mt-0.5">Semester-by-semester credit accumulation versus syllabus benchmark</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-900 inline-block" />
              <span className="text-gray-600">Credits Accumulated</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-200 inline-block" />
              <span className="text-gray-600">Target Benchmark</span>
            </div>
          </div>
        </div>
        {displayProgress.length === 0 ? (
          <div className="h-[200px] w-full mt-6 flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-lg text-center p-6 bg-gray-50/50">
            <BookOpen className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-xs font-semibold text-gray-700">No Academic Records Yet</p>
            <p className="text-xs text-gray-500 mt-1">Upload your official transcript slip to populate semester credit progression.</p>
          </div>
        ) : (
          <div className="h-[320px] w-full mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={displayProgress} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6B7280', fontWeight: 600, fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6B7280', fontWeight: 600, fontSize: 12 }}
                />
                <RechartsTooltip 
                  cursor={{ fill: '#F8FAFC' }} 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }} 
                />
                <Bar 
                  dataKey="earned" 
                  name="Credits Accumulated" 
                  fill="#1E3A8A" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={50}
                />
                <Bar 
                  dataKey="total" 
                  name="Target Benchmark" 
                  fill="#BFDBFE" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={50}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}