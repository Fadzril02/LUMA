import React, { useState } from "react";
import { Target, Plus, Trash2, Calculator } from "lucide-react";
import { Button, Input } from "../../components/ui";

export function CgpaCalculatorView() { 
  const currentCgpa = 3.12;
  const currentCredits = 83;

  const [hypotheticalClasses, setHypotheticalClasses] = useState([
    { name: "Artificial Intelligence", credits: 3, expectedGrade: "A" }
  ]);

  const gradePoints: Record<string, number> = { 
    "A+": 4.0, "A": 4.0, "A-": 3.67, 
    "B+": 3.33, "B": 3.0, "B-": 2.67, 
    "C+": 2.33, "C": 2.0 
  };

  const addClass = () => {
    setHypotheticalClasses([...hypotheticalClasses, { name: "", credits: 3, expectedGrade: "A" }]);
  };

  const removeClass = (index: number) => {
    setHypotheticalClasses(hypotheticalClasses.filter((_, i) => i !== index));
  };

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
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900">
              <Calculator size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Target Semester Predictor</h2>
              <p className="text-xs text-gray-500">Model hypothetical grade outcomes on cumulative CGPA</p>
            </div>
          </div>
          
          <div className="space-y-3.5">
            {hypotheticalClasses.map((cls, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <Input 
                  placeholder="Target Module Name" 
                  defaultValue={cls.name} 
                  className="flex-1 bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-900 focus:border-transparent text-gray-900 h-9 text-xs" 
                />
                <Input 
                  type="number" 
                  defaultValue={cls.credits} 
                  className="w-16 bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-900 focus:border-transparent text-gray-900 h-9 text-xs text-center" 
                  min={1} 
                  max={4} 
                />
                <select 
                  defaultValue={cls.expectedGrade}
                  onChange={(e) => {
                    const updated = [...hypotheticalClasses];
                    updated[idx].expectedGrade = e.target.value;
                    setHypotheticalClasses(updated);
                  }}
                  className="border border-gray-200 bg-gray-50 rounded-lg px-2 h-9 w-20 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-900"
                >
                  {Object.keys(gradePoints).map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <button 
                  onClick={() => removeClass(idx)} 
                  className="text-gray-400 hover:text-rose-600 transition-colors p-1.5 rounded hover:bg-rose-50 cursor-pointer"
                  aria-label="Remove course"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            
            <Button 
              type="button" 
              variant="outline" 
              onClick={addClass} 
              className="w-full mt-2 text-blue-900 border-blue-200 hover:bg-blue-50 bg-white font-medium rounded-lg text-xs h-9 cursor-pointer"
            >
              <Plus size={14} className="mr-1.5" /> Add Target Course
            </Button>
          </div>
        </div>

        {/* Right Side: The Projected Result */}
        <div className="bg-blue-900 rounded-xl p-8 text-white flex flex-col justify-center items-center text-center relative overflow-hidden shadow-sm">
          <Target className="absolute -right-6 -bottom-6 w-48 h-48 text-blue-800/40 pointer-events-none" />
          
          <div className="relative z-10">
            <p className="text-blue-200 uppercase tracking-widest text-xs font-bold mb-2">Projected CGPA</p>
            <h1 className="text-6xl font-black text-white tracking-tight">{projectedCgpa}</h1>
            
            <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
              isPositive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
            }`}>
              {isPositive ? '+' : ''}{difference} from baseline ({currentCgpa.toFixed(2)})
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}