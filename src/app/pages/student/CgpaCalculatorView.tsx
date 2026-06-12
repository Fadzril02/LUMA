import React, { useState } from "react";
import { Target, Plus, Trash2, Calculator } from "lucide-react";
import { Button, Input } from "../../components/ui";

export function CgpaCalculatorView() { 
  // Base Dummy Data
  const currentCgpa = 3.12;
  const currentCredits = 83;

  // State for hypothetical classes
  const [hypotheticalClasses, setHypotheticalClasses] = useState([
    { name: "Artificial Intelligence", credits: 3, expectedGrade: "A" }
  ]);

  // Point mapping for math
  const gradePoints: Record<string, number> = { "A+": 4.0, "A": 4.0, "A-": 3.67, "B+": 3.33, "B": 3.0, "B-": 2.67, "C+": 2.33, "C": 2.0 };

  const addClass = () => {
    setHypotheticalClasses([...hypotheticalClasses, { name: "", credits: 3, expectedGrade: "A" }]);
  };

  const removeClass = (index: number) => {
    setHypotheticalClasses(hypotheticalClasses.filter((_, i) => i !== index));
  };

  // Live Math Calculation
  let newPoints = currentCgpa * currentCredits;
  let newCredits = currentCredits;

  hypotheticalClasses.forEach(cls => {
    const points = gradePoints[cls.expectedGrade] || 0;
    newPoints += (points * cls.credits);
    newCredits += cls.credits;
  });

  const projectedCgpa = newCredits > 0 ? (newPoints / newCredits).toFixed(2) : "0.00";
  const difference = (parseFloat(projectedCgpa) - currentCgpa).toFixed(2);
  const isPositive = parseFloat(difference) >= 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Side: The Calculator */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
            <Calculator className="text-indigo-500" size={24} />
            Target Semester Predictor
          </h2>
          
          <div className="space-y-4">
            {hypotheticalClasses.map((cls, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <Input placeholder="Course Name" defaultValue={cls.name} className="flex-1" />
                <Input type="number" defaultValue={cls.credits} className="w-20" min={1} max={4} />
                <select className="border border-slate-200 rounded-md p-2 w-20 text-sm outline-none">
                  {Object.keys(gradePoints).map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <button onClick={() => removeClass(idx)} className="text-slate-400 hover:text-rose-500 transition-colors p-2">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            
            <Button variant="outline" onClick={addClass} className="w-full mt-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50">
              <Plus size={16} className="mr-2" /> Add Target Course
            </Button>
          </div>
        </div>

        {/* Right Side: The Result */}
        <div className="bg-slate-900 rounded-xl p-8 text-white flex flex-col justify-center items-center text-center relative overflow-hidden">
          <Target className="absolute -right-4 -bottom-4 w-48 h-48 text-slate-800 opacity-50" />
          
          <div className="relative z-10">
            <p className="text-slate-400 uppercase tracking-widest text-sm font-bold mb-2">Projected CGPA</p>
            <h1 className="text-6xl font-black text-white">{projectedCgpa}</h1>
            
            <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              {isPositive ? '+' : ''}{difference} points from current
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}