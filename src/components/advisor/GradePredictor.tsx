import React, { useState, useEffect } from "react";
import { Target, Plus, Trash2, Calculator, Sparkles, TrendingUp, TrendingDown, BookOpen } from "lucide-react";
import { Button, Input } from "../../app/components/ui";
import { db } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

export interface GradePredictorProps {
  currentCgpa?: number | string;
  earnedCredits?: number;
  currentCredits?: number;
  total_credits_earned?: number;
  matricNo?: string;
  student?: {
    id?: string;
    matric_no?: string;
    name?: string;
    cgpa?: number | string;
    total_credits_earned?: number;
    credits?: number;
  };
}

interface HypotheticalCourse {
  name: string;
  credits: number;
  expectedGrade: string;
}

export function GradePredictor({
  currentCgpa: propCgpa,
  earnedCredits: propEarnedCredits,
  currentCredits: propCurrentCredits,
  total_credits_earned: propTotalCredits,
  matricNo: propMatric,
  student,
}: GradePredictorProps) {
  const { profile, user } = useAuth();

  // Store only the fetched database values in state
  const [fetchedCgpa, setFetchedCgpa] = useState<number | null>(null);
  const [fetchedCredits, setFetchedCredits] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [hypotheticalClasses, setHypotheticalClasses] = useState<HypotheticalCourse[]>([
    { name: "Target Elective Module 1", credits: 3, expectedGrade: "A" },
  ]);

  // Standard UTM / Malaysian University Grade-to-Point Scale
  const gradePoints: Record<string, number> = {
    "A+": 4.0,
    A: 4.0,
    "A-": 3.67,
    "B+": 3.33,
    B: 3.0,
    "B-": 2.67,
    "C+": 2.33,
    C: 2.0,
    "C-": 1.67,
    "D+": 1.33,
    D: 1.0,
    E: 0.0,
    F: 0.0,
  };

  const activeMatric =
    propMatric ||
    student?.matric_no ||
    student?.id ||
    profile?.matric_no ||
    "";

  // Check if props provide starting data directly
  const hasPropCgpa = propCgpa !== undefined && propCgpa !== null;
  const hasPropCredits =
    (propEarnedCredits !== undefined && propEarnedCredits !== null) ||
    (propCurrentCredits !== undefined && propCurrentCredits !== null) ||
    (propTotalCredits !== undefined && propTotalCredits !== null);

  // During render, cleanly derive final display values: props always override local fetches
  const liveCgpa = Number(
    propCgpa ??
    student?.cgpa ??
    fetchedCgpa ??
    0
  );

  const liveCredits = Number(
    propEarnedCredits ??
    propCurrentCredits ??
    propTotalCredits ??
    student?.total_credits_earned ??
    student?.credits ??
    fetchedCredits ??
    0
  );

  useEffect(() => {
    // If props provide both CGPA and credits, skip DB network query
    if (hasPropCgpa && hasPropCredits) {
      return;
    }

    if (!activeMatric && !user?.id) {
      return;
    }

    let isMounted = true;

    async function fetchPredictorBaseline() {
      setIsLoading(true);
      try {
        // Single query to advisee_roster_summary SQL view
        const { data: summaryData, error: summaryErr } = await db
          .from("advisee_roster_summary")
          .select("cgpa, total_earned_credits")
          .eq("matric_no", activeMatric)
          .maybeSingle();

        if (summaryData) {
          if (isMounted) {
            if (summaryData.cgpa !== null && summaryData.cgpa !== undefined) {
              setFetchedCgpa(Number(summaryData.cgpa));
            }
            if (summaryData.total_earned_credits !== null && summaryData.total_earned_credits !== undefined) {
              setFetchedCredits(Number(summaryData.total_earned_credits));
            }
          }
        } else if (summaryErr) {
          // Graceful fallback to students table if SQL view is still being migrated
          console.warn("[GradePredictor] advisee_roster_summary notice:", summaryErr.message);
          const { data: stData } = await db
            .from("students")
            .select("cgpa")
            .eq("matric_no", activeMatric)
            .maybeSingle();

          if (isMounted && stData?.cgpa !== null && stData?.cgpa !== undefined) {
            setFetchedCgpa(Number(stData.cgpa));
          }
        }
      } catch (err) {
        console.error("[GradePredictor] Error fetching baseline from advisee_roster_summary:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchPredictorBaseline();

    return () => {
      isMounted = false;
    };
  }, [hasPropCgpa, hasPropCredits, activeMatric, user?.id]);

  // Action Handlers
  const addClass = () => {
    setHypotheticalClasses([
      ...hypotheticalClasses,
      { name: `Target Module ${hypotheticalClasses.length + 1}`, credits: 3, expectedGrade: "A" },
    ]);
  };

  const removeClass = (index: number) => {
    setHypotheticalClasses(hypotheticalClasses.filter((_, i) => i !== index));
  };

  const updateCourse = (index: number, field: keyof HypotheticalCourse, value: any) => {
    const updated = [...hypotheticalClasses];
    updated[index] = { ...updated[index], [field]: value };
    setHypotheticalClasses(updated);
  };

  // Forecasting math calculated strictly against live derived baseline variables
  let newQualityPoints = liveCgpa * liveCredits;
  let newTotalCredits = liveCredits;
  let addedSemesterCredits = 0;

  hypotheticalClasses.forEach((cls) => {
    const points = gradePoints[cls.expectedGrade] ?? 0;
    const creds = Number(cls.credits) || 0;
    newQualityPoints += points * creds;
    newTotalCredits += creds;
    addedSemesterCredits += creds;
  });

  const projectedCgpa = newTotalCredits > 0 ? (newQualityPoints / newTotalCredits).toFixed(2) : "0.00";
  const diffVal = parseFloat(projectedCgpa) - liveCgpa;
  const difference = diffVal.toFixed(2);
  const isPositive = diffVal >= 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Target Semester Course Builder */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-5 border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900">
                <Calculator size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Target Semester Grade Predictor</h2>
                <p className="text-xs text-gray-500">Model hypothetical grade outcomes against live cumulative baseline</p>
              </div>
            </div>
            {isLoading && (
              <span className="text-[11px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded animate-pulse">
                Syncing DB...
              </span>
            )}
          </div>

          {/* Current Live Baseline Snapshot Banner */}
          <div className="mb-4 bg-slate-50 border border-slate-200/80 rounded-lg p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <BookOpen size={15} className="text-slate-500" />
              <span className="text-slate-600 font-medium">Live Academic Baseline:</span>
            </div>
            <div className="flex items-center gap-3 font-mono font-semibold">
              <span className="text-slate-900">CGPA: {liveCgpa.toFixed(2)}</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-900">Earned: {liveCredits} Cr</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-gray-500 uppercase px-1">
              <span className="col-span-6">Module Name</span>
              <span className="col-span-2 text-center">Credits</span>
              <span className="col-span-3 text-center">Target Grade</span>
              <span className="col-span-1 text-right"></span>
            </div>

            {hypotheticalClasses.map((cls, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-gray-50/60 p-1.5 rounded-lg border border-gray-100">
                <div className="col-span-6">
                  <Input
                    placeholder="e.g. Machine Learning"
                    value={cls.name}
                    onChange={(e) => updateCourse(idx, "name", e.target.value)}
                    className="bg-white border-gray-200 focus:ring-2 focus:ring-blue-900 focus:border-transparent text-gray-900 h-9 text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    value={cls.credits}
                    onChange={(e) => updateCourse(idx, "credits", Math.max(1, parseInt(e.target.value) || 0))}
                    className="bg-white border-gray-200 focus:ring-2 focus:ring-blue-900 focus:border-transparent text-gray-900 h-9 text-xs text-center font-mono"
                    min={1}
                    max={6}
                  />
                </div>
                <div className="col-span-3">
                  <select
                    value={cls.expectedGrade}
                    onChange={(e) => updateCourse(idx, "expectedGrade", e.target.value)}
                    className="w-full border border-gray-200 bg-white rounded-lg px-2 h-9 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-900 cursor-pointer"
                  >
                    {Object.keys(gradePoints).map((g) => (
                      <option key={g} value={g}>
                        {g} ({gradePoints[g].toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    onClick={() => removeClass(idx)}
                    className="text-gray-400 hover:text-rose-600 transition-colors p-1.5 rounded hover:bg-rose-50 cursor-pointer"
                    aria-label="Remove course"
                    title="Remove module"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={addClass}
              className="w-full mt-3 text-blue-900 border-blue-200 hover:bg-blue-50 bg-white font-medium rounded-lg text-xs h-9 cursor-pointer"
            >
              <Plus size={14} className="mr-1.5" /> Add Hypothetical Course
            </Button>
          </div>
        </div>

        {/* Right Column: Projected Impact Card */}
        <div className="bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 rounded-xl p-8 text-white flex flex-col justify-between relative overflow-hidden shadow-sm border border-blue-800">
          <Target className="absolute -right-8 -bottom-8 w-56 h-56 text-blue-800/25 pointer-events-none" />

          {/* Top Label */}
          <div className="flex items-center justify-between relative z-10">
            <span className="text-blue-200 uppercase tracking-widest text-[11px] font-bold flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-300" />
              Live Forecast Simulator
            </span>
            <span className="text-[11px] text-blue-300 font-mono">
              +{addedSemesterCredits} Anticipated Cr
            </span>
          </div>

          {/* Center: Hero Projected Score */}
          <div className="relative z-10 my-6 text-center">
            <p className="text-blue-300 uppercase tracking-widest text-xs font-semibold mb-1">
              Projected Cumulative CGPA
            </p>
            <h1 className="text-6xl sm:text-7xl font-black text-white tracking-tight font-mono">
              {projectedCgpa}
            </h1>

            <div
              className={`mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold ${
                isPositive
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                  : "bg-rose-500/20 text-rose-300 border border-rose-400/30"
              }`}
            >
              {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>
                {isPositive ? "+" : ""}
                {difference} from baseline ({liveCgpa.toFixed(2)})
              </span>
            </div>
          </div>

          {/* Bottom Breakdown Metrics */}
          <div className="relative z-10 grid grid-cols-3 gap-3 pt-5 border-t border-blue-800/80 text-center text-xs">
            <div className="bg-blue-900/40 p-2.5 rounded-lg border border-blue-700/40">
              <p className="text-blue-300 text-[10px] uppercase font-semibold">Active Baseline</p>
              <p className="text-white font-bold font-mono mt-0.5">{liveCgpa.toFixed(2)} CGPA</p>
            </div>
            <div className="bg-blue-900/40 p-2.5 rounded-lg border border-blue-700/40">
              <p className="text-blue-300 text-[10px] uppercase font-semibold">Credits Earned</p>
              <p className="text-white font-bold font-mono mt-0.5">{liveCredits} Cr</p>
            </div>
            <div className="bg-blue-900/40 p-2.5 rounded-lg border border-blue-700/40">
              <p className="text-blue-300 text-[10px] uppercase font-semibold">Target Total</p>
              <p className="text-white font-bold font-mono mt-0.5">{newTotalCredits} Cr</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Re-export for seamless interchangeable usage
export { GradePredictor as CgpaCalculatorView };
