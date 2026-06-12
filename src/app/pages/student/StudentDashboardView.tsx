import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";

export function StudentDashboardView({ stats, creditProgress }: { stats?: any, creditProgress?: any[] }) {
  
  // High-Fidelity Dummy Data (Used if the database is empty for a showcase)
  const displayStats = stats?.earned > 0 ? stats : {
    cgpa: "3.42",
    earned: 83,
    required: 130
  };

  const displayProgress = creditProgress && creditProgress.length > 0 ? creditProgress : [
    { name: "Sem 1", earned: 18, total: 18 },
    { name: "Sem 2", earned: 35, total: 36 },
    { name: "Sem 3", earned: 52, total: 54 },
    { name: "Sem 4", earned: 68, total: 72 },
    { name: "Current", earned: 83, total: 90 },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      
      {/* Top Number Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-t-4 border-t-[#990033] shadow-sm hover:shadow transition-shadow">
          <CardContent className="pt-6">
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Current CGPA</p>
            <span className="text-5xl font-black text-slate-900 mt-2 block">{displayStats.cgpa}</span>
          </CardContent>
        </Card>
        
        <Card className="border-t-4 border-t-[#FFCC00] shadow-sm hover:shadow transition-shadow">
          <CardContent className="pt-6">
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Credits Earned</p>
            <span className="text-5xl font-black text-slate-900 mt-2 block">
              {displayStats.earned} <span className="text-xl text-slate-400 font-bold">/ {displayStats.required}</span>
            </span>
          </CardContent>
        </Card>
        
        <Card className="border-t-4 border-t-slate-800 shadow-sm hover:shadow transition-shadow">
          <CardContent className="pt-6">
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Academic Status</p>
            <div className="mt-4">
               <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-emerald-100 text-emerald-700">
                 Active / Kedudukan Baik
               </span>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* The Recharts Graph */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-lg font-bold text-slate-800">Curriculum Progression Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={displayProgress} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontWeight: 600, fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontWeight: 600, fontSize: 12 }}
                />
                <RechartsTooltip 
                  cursor={{ fill: '#f1f5f9' }} 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                />
                <Bar 
                  dataKey="earned" 
                  name="Credits Accumulated" 
                  fill="#990033" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={60}
                />
                <Bar 
                  dataKey="total" 
                  name="Target Benchmark" 
                  fill="#FFCC00" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={60}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}