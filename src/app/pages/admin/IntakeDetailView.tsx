import React, { useState } from "react";
import { ChevronLeft, UploadCloud, Sparkles, Plus, BookOpen, Trash2, FileText, CheckCircle, Loader2, Save } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Input, Label } from "../../components/ui";

interface IntakeDetailViewProps {
  intake: any;
  onBack: () => void;
}

// 🪹 Empty state (Before AI Upload)
const MOCK_EMPTY_SEMESTERS: any[] = [];

// 🚀 Full state (After AI Upload)
const MOCK_AI_EXTRACTED_SEMESTERS = [
  {
    term: "Year 1 - Semester 1",
    courses: [
      { code: "SECJ1013", name: "Programming Technique I", credits: 3 },
      { code: "SECP1513", name: "Technology & Information System", credits: 3 },
      { code: "SECI1013", name: "Discrete Structure", credits: 3 },
      { code: "UHMT1012", name: "Graduate Success Attributes", credits: 2 },
    ]
  },
  {
    term: "Year 1 - Semester 2",
    courses: [
      { code: "SECJ1023", name: "Programming Technique II", credits: 3 },
      { code: "SECR2043", name: "Operating Systems", credits: 3 },
      { code: "SECR2033", name: "Computer Organization & Architecture", credits: 3 },
      { code: "UHIS1022", name: "Philosophy and Current Issues", credits: 2 },
    ]
  },
  {
    term: "Year 2 - Semester 1",
    courses: [
      { code: "SECJ2013", name: "Data Structures and Algorithms", credits: 3 },
      { code: "SECV2113", name: "Human Computer Interaction", credits: 3 },
      { code: "SECD2523", name: "Database", credits: 3 },
      { code: "SECJ2203", name: "Software Engineering", credits: 3 },
    ]
  }
];

export function IntakeDetailView({ intake, onBack }: IntakeDetailViewProps) {
  const [semesters, setSemesters] = useState(MOCK_EMPTY_SEMESTERS);
  
  // Drag and Drop AI Modal States
  const [showAIModal, setShowAIModal] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [processingState, setProcessingState] = useState<'idle' | 'processing' | 'success'>('idle');
  const [processingText, setProcessingText] = useState("");

  // ✨ NEW: Manual Key-in States
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [activeSemIndex, setActiveSemIndex] = useState<number | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualCredits, setManualCredits] = useState("");

  // ✨ NEW: Publish State
  const [isPublishing, setIsPublishing] = useState(false);

  const totalCurrentCredits = semesters.reduce((total, sem) => 
    total + sem.courses.reduce((sum: number, c: any) => sum + c.credits, 0), 0
  );

  // --- MANUAL ADD HANDLERS ---
  const openManualAdd = (index: number) => {
    setActiveSemIndex(index);
    setShowManualAdd(true);
  };

  const handleSaveManualCourse = () => {
    if (activeSemIndex === null || !manualCode || !manualName || !manualCredits) return;

    const newCourse = {
      code: manualCode.toUpperCase(),
      name: manualName,
      credits: parseInt(manualCredits) || 3
    };

    const updatedSemesters = [...semesters];
    updatedSemesters[activeSemIndex].courses.push(newCourse);
    setSemesters(updatedSemesters);

    // Reset Form
    setShowManualAdd(false);
    setManualCode("");
    setManualName("");
    setManualCredits("");
  };

  // --- PUBLISH HANDLER ---
  const handlePublish = () => {
    setIsPublishing(true);
    setTimeout(() => {
      setIsPublishing(false);
      // In a real app, this updates Supabase status to 'Active'. 
      // For the demo, we show an alert and go back to the list.
      alert(`Success! ${intake.name} is now published and active for enrollment.`);
      onBack();
    }, 1500);
  };

  // --- AI SIMULATION HANDLERS (Unchanged) ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      startFakeAIProcessing(e.dataTransfer.files[0].name);
    }
  };

  const startFakeAIProcessing = (filename: string) => {
    setProcessingState('processing');
    const sequence = [
      "Initializing Gemini 2.5 Flash Engine...",
      `Parsing layout structure for ${filename}...`,
      "Extracting course codes and pre-requisite mappings...",
      "Finalizing curriculum payload..."
    ];
    let step = 0;
    setProcessingText(sequence[0]);
    const interval = setInterval(() => {
      step++;
      if (step < sequence.length) setProcessingText(sequence[step]);
      else {
        clearInterval(interval);
        setProcessingState('success');
        setTimeout(() => {
          setShowAIModal(false);
          setProcessingState('idle');
          setSemesters(MOCK_AI_EXTRACTED_SEMESTERS);
        }, 1200);
      }
    }, 800);
  };

  return (
    <div className="space-y-6 relative">
      
      {/* 🔙 Navigation Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-gray-500 hover:text-[#990033]">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{intake.name} ({intake.year})</h2>
            <div className="flex items-center text-sm text-gray-500 mt-1">
              <Badge variant="outline" className="mr-2 border-emerald-200 bg-emerald-50 text-emerald-700">{intake.status}</Badge>
              <span>{intake.totalCredits} Total Credits Target</span>
            </div>
          </div>
        </div>
        
        {/* ✨ AI IMPORT BUTTON */}
        <Button 
          onClick={() => setShowAIModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-md transition-all hover:scale-105"
        >
          <Sparkles className="w-4 h-4 mr-2" /> AI Syllabus Import
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT AREA: The Curriculum Layout */}
        <div className="lg:col-span-2 space-y-6">
          {semesters.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-300 bg-gray-50/50">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <FileText className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-bold text-gray-700">Empty Curriculum</h3>
                <p className="text-gray-500 text-sm max-w-sm mt-2">
                  This intake currently has no courses mapped to it. Click the AI Import button above or manually add a semester block below.
                </p>
                <Button 
                  variant="outline" 
                  className="mt-6 border-gray-300"
                  onClick={() => setSemesters([{ term: "Year 1 - Semester 1", courses: [] }])}
                >
                  <Plus className="w-4 h-4 mr-2" /> Manually Add Block
                </Button>
              </CardContent>
            </Card>
          ) : (
            semesters.map((sem, idx) => (
              <Card key={idx} className="border border-gray-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 100}ms`}}>
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-3 flex flex-row justify-between items-center">
                  <CardTitle className="text-base font-bold text-gray-800">{sem.term}</CardTitle>
                  <Badge variant="outline" className="text-gray-500 bg-white shadow-sm">
                    {sem.courses.reduce((sum: number, course: any) => sum + course.credits, 0)} Credits
                  </Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-gray-100">
                    {sem.courses.map((course: any, cIdx: number) => (
                      <li key={cIdx} className="px-5 py-3 flex justify-between items-center hover:bg-gray-50 transition-colors group">
                        <div className="flex items-center space-x-3">
                          <div className="bg-[#990033]/10 p-2 rounded text-[#990033]">
                            <BookOpen className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm">{course.code}</div>
                            <div className="text-xs text-gray-500">{course.name}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-xs font-medium text-gray-500">{course.credits} cr</span>
                          <button className="text-gray-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  
                  {/* ✨ MANUAL ADD TRIGGER BUTTON */}
                  <div className="p-2 bg-gray-50/30 border-t border-gray-100">
                     <Button 
                       variant="ghost" 
                       size="sm" 
                       onClick={() => openManualAdd(idx)}
                       className="w-full text-gray-500 hover:text-[#990033] hover:bg-red-50 text-xs border border-dashed border-transparent hover:border-[#990033]/30"
                     >
                       <Plus className="w-3 h-3 mr-1" /> Add Course to {sem.term}
                     </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
          
          {semesters.length > 0 && (
            <Button 
              variant="outline" 
              onClick={() => setSemesters([...semesters, { term: `Year ${Math.ceil((semesters.length+1)/2)} - Semester ${(semesters.length%2)+1}`, courses: [] }])}
              className="w-full border-dashed border-gray-300 text-gray-500 hover:text-gray-900 bg-white"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Next Semester Block
            </Button>
          )}
        </div>

        {/* RIGHT AREA: Validation & Publish Status */}
        <div className="space-y-4">
          <Card className="border border-gray-200 sticky top-24">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
              <CardTitle className="text-sm">Curriculum Audit</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Mapped Credits:</span>
                <span className="font-bold text-gray-900">{totalCurrentCredits} / {intake.totalCredits}</span>
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-[#990033] h-full transition-all duration-1000 ease-out" 
                  style={{ width: `${Math.min((totalCurrentCredits/intake.totalCredits)*100, 100)}%` }} 
                />
              </div>
              
              {/* ✨ DYNAMIC PUBLISH LOGIC */}
              {totalCurrentCredits < intake.totalCredits ? (
                <div className="pt-2">
                  <p className="text-xs text-amber-600 font-medium bg-amber-50 p-3 rounded-md border border-amber-200 mb-4">
                    ⚠️ This curriculum is incomplete. You need to map {intake.totalCredits - totalCurrentCredits} more credits before publishing.
                  </p>
                  <Button disabled className="w-full bg-gray-200 text-gray-400">Publish Disabled</Button>
                </div>
              ) : (
                <div className="pt-2">
                  <p className="text-xs text-emerald-600 font-medium bg-emerald-50 p-3 rounded-md border border-emerald-200 flex items-center mb-4">
                    <CheckCircle className="w-4 h-4 mr-1"/> Curriculum credit requirements met.
                  </p>
                  <Button 
                    onClick={handlePublish}
                    disabled={isPublishing}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg transition-all hover:scale-105"
                  >
                    {isPublishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    {isPublishing ? "Publishing..." : "Publish Curriculum"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 🚀 AI DRAG AND DROP MODAL (Hidden logic unchanged for brevity) */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg shadow-2xl border-indigo-500/20 bg-white">
            <CardHeader className="border-b border-gray-100 flex flex-row justify-between items-center bg-gray-50/50 rounded-t-xl py-4">
              <CardTitle className="flex items-center text-indigo-700">
                <Sparkles className="w-5 h-5 mr-2" /> Gemini AI Syllabus Extractor
              </CardTitle>
              {processingState === 'idle' && (
                <button onClick={() => setShowAIModal(false)} className="text-gray-400 hover:text-gray-700">✕</button>
              )}
            </CardHeader>
            
            <CardContent className="p-6">
              {processingState === 'idle' && (
                <div 
                  onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all duration-200 ${
                    dragActive ? "border-indigo-500 bg-indigo-50" : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50"
                  }`}
                >
                  <div className="bg-indigo-100 p-4 rounded-full mb-4 pointer-events-none">
                    <UploadCloud className="w-8 h-8 text-indigo-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 pointer-events-none text-lg">Drag & Drop Syllabus PDF</h3>
                  <label className="mt-6 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors">
                    Browse Files
                    <input type="file" className="hidden" onChange={(e) => {
                      if (e.target.files && e.target.files[0]) startFakeAIProcessing(e.target.files[0].name);
                    }} />
                  </label>
                </div>
              )}

              {processingState === 'processing' && (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-6" />
                  <h3 className="font-bold text-gray-900 text-lg mb-2">Analyzing Document</h3>
                  <p className="text-sm font-mono text-indigo-600 bg-indigo-50 px-3 py-1 rounded-md">{processingText}</p>
                </div>
              )}

              {processingState === 'success' && (
                <div className="py-12 flex flex-col items-center justify-center text-center animate-in zoom-in duration-300">
                  <div className="bg-emerald-100 p-4 rounded-full mb-4"><CheckCircle className="w-10 h-10 text-emerald-600" /></div>
                  <h3 className="font-bold text-gray-900 text-xl">Extraction Successful!</h3>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ✨ MANUAL ADD COURSE MODAL */}
      {showManualAdd && activeSemIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl bg-white border-t-4 border-[#990033]">
            <CardHeader className="border-b border-gray-100 flex flex-row justify-between items-center py-4">
              <CardTitle className="text-gray-900 text-lg">Add Course to {semesters[activeSemIndex].term}</CardTitle>
              <button onClick={() => setShowManualAdd(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-600 uppercase">Course Code</Label>
                <Input 
                  placeholder="e.g. SECJ3203" 
                  value={manualCode} 
                  onChange={e => setManualCode(e.target.value)} 
                  className="border-gray-300 focus:border-[#990033] uppercase" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-600 uppercase">Course Name</Label>
                <Input 
                  placeholder="e.g. Artificial Intelligence" 
                  value={manualName} 
                  onChange={e => setManualName(e.target.value)} 
                  className="border-gray-300 focus:border-[#990033]" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-600 uppercase">Credits</Label>
                <Input 
                  type="number" 
                  placeholder="3" 
                  value={manualCredits} 
                  onChange={e => setManualCredits(e.target.value)} 
                  className="border-gray-300 focus:border-[#990033]" 
                />
              </div>
              
              <div className="pt-4 flex gap-3">
                <Button variant="outline" onClick={() => setShowManualAdd(false)} className="flex-1">Cancel</Button>
                <Button 
                  onClick={handleSaveManualCourse} 
                  disabled={!manualCode || !manualName || !manualCredits}
                  className="flex-1 bg-[#990033] hover:bg-[#80002A] text-white disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" /> Save Course
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}