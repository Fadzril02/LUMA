import React, { useState } from "react";
import { Plus, Edit2, Save, Trash2, Search, Calendar, Archive, FileText, CheckCircle, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Badge } from "../../components/ui";

// 🔌 IMPORT THE DETAIL VIEW HERE
import { IntakeDetailView } from "./IntakeDetailView";

// Mock data: Loaded into state so it's fully interactive
const INITIAL_INTAKES = [
  { id: "INT-01", year: "2020/2021", name: "SE Curriculum Rev A", status: "Archived", totalCredits: 130 },
  { id: "INT-02", year: "2022/2023", name: "SE Curriculum Rev B", status: "Active", totalCredits: 132 },
  { id: "INT-03", year: "2024/2025", name: "SE Curriculum Rev C", status: "Draft", totalCredits: 128 },
];

export function IntakeConfigView() {
  // ✨ THE NEW STATE: Tracks which intake is currently selected
  const [selectedIntake, setSelectedIntake] = useState<any | null>(null);

  const [intakes, setIntakes] = useState(INITIAL_INTAKES);
  const [searchQuery, setSearchQuery] = useState("");

  // Form States for Quick Add
  const [newYear, setNewYear] = useState("");
  const [newName, setNewName] = useState("");
  const [newCredits, setNewCredits] = useState("");

  // 🛠️ Action: Add New Intake
  const handleAddIntake = () => {
    if (!newYear || !newName || !newCredits) return;
    
    const newIntake = {
      id: `INT-${Date.now().toString().slice(-4)}`,
      year: newYear,
      name: newName,
      status: "Draft",
      totalCredits: parseInt(newCredits) || 130
    };
    
    setIntakes([newIntake, ...intakes]);
    setNewYear("");
    setNewName("");
    setNewCredits("");
  };

  // 🛠️ Action: Delete Intake
  const handleDeleteIntake = (id: string) => {
    setIntakes(intakes.filter(intake => intake.id !== id));
  };

  // 🛠️ Action: Cycle Status
  const cycleStatus = (id: string) => {
    setIntakes(intakes.map(intake => {
      if (intake.id === id) {
        const nextStatus = 
          intake.status === 'Draft' ? 'Active' : 
          intake.status === 'Active' ? 'Archived' : 'Draft';
        return { ...intake, status: nextStatus };
      }
      return intake;
    }));
  };

  // 🔍 Dynamic Search Filter
  const filteredIntakes = intakes.filter(intake => 
    intake.year.toLowerCase().includes(searchQuery.toLowerCase()) || 
    intake.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 🛑 THE ROUTING INTERCEPTOR 
  // If an intake is selected, STOP rendering the list and render the Detail View instead!
  if (selectedIntake) {
    return (
      <IntakeDetailView 
        intake={selectedIntake} 
        onBack={() => setSelectedIntake(null)} // Passes a function to clear the state and go back
      />
    );
  }

  // 👇 Otherwise, render the normal list view
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* LEFT AREA: Search & List */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Configured Intakes</h3>
            <p className="text-sm text-gray-500">Manage curriculum requirements by enrollment batch.</p>
          </div>
          
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input 
              placeholder="Search year or name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 border-gray-200"
            />
          </div>
        </div>
        
        {filteredIntakes.length === 0 ? (
           <Card className="p-8 text-center border-dashed border-gray-300">
             <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-3" />
             <p className="text-gray-500 font-medium">No intakes found.</p>
           </Card>
        ) : (
          filteredIntakes.map((intake) => (
            <Card key={intake.id} className="group hover:border-[#990033]/30 transition-colors shadow-sm overflow-hidden">
              <CardContent className="p-0 flex justify-between items-stretch">
                
                {/* Left Color Bar */}
                <div className={`w-2 ${
                  intake.status === 'Active' ? 'bg-emerald-500' : 
                  intake.status === 'Draft' ? 'bg-amber-400' : 'bg-gray-300'
                }`} />

                <div className="p-5 flex-1 flex justify-between items-center">
                  <div>
                    <div className="flex items-center space-x-3 mb-1">
                      <h4 className="text-lg font-bold text-gray-900">{intake.year}</h4>
                      
                      <button onClick={() => cycleStatus(intake.id)} className="focus:outline-none hover:scale-105 transition-transform">
                        <Badge 
                          variant="outline" 
                          className={`cursor-pointer flex items-center gap-1 ${
                            intake.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                            intake.status === 'Draft' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-gray-50 text-gray-600 border-gray-200'
                          }`}
                        >
                          {intake.status === 'Active' && <CheckCircle className="w-3 h-3" />}
                          {intake.status === 'Draft' && <FileText className="w-3 h-3" />}
                          {intake.status === 'Archived' && <Archive className="w-3 h-3" />}
                          {intake.status}
                        </Badge>
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 font-medium">{intake.name} • <span className="font-bold text-gray-900">{intake.totalCredits}</span> Credits Required</p>
                  </div>
                  
                  {/* ✨ THE TRIGGER BUTTONS */}
                  <div className="flex items-center space-x-1">
                    {/* Delete stays hidden until hover */}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDeleteIntake(intake.id)}
                      className="text-gray-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>

                    {/* View Button sets the selected intake state */}
                    <Button 
                      onClick={() => setSelectedIntake(intake)}
                      className="bg-white border border-gray-200 text-[#990033] hover:bg-red-50 hover:border-[#990033]/30 shadow-sm ml-2 transition-all"
                    >
                      View Curriculum <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>

                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* RIGHT AREA: Quick Add Form */}
      <Card className="h-fit sticky top-24 shadow-sm border border-gray-200">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
          <CardTitle className="flex items-center text-lg"><Plus className="w-5 h-5 mr-2 text-[#990033]" /> Quick Add Batch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-gray-500 uppercase">Intake Session</Label>
            <Input 
              placeholder="e.g. 2025/2026" 
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              className="border-gray-300 focus:border-[#990033] focus:ring-[#990033]" 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold text-gray-500 uppercase">Curriculum Name</Label>
            <Input 
              placeholder="e.g. SE Curriculum Rev D" 
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="border-gray-300 focus:border-[#990033]" 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold text-gray-500 uppercase">Total Required Credits</Label>
            <Input 
              type="number"
              placeholder="e.g. 130" 
              value={newCredits}
              onChange={(e) => setNewCredits(e.target.value)}
              className="border-gray-300 focus:border-[#990033]" 
            />
          </div>
          
          <Button 
            onClick={handleAddIntake}
            disabled={!newYear || !newName || !newCredits}
            className="w-full mt-4 bg-[#990033] hover:bg-[#80002A] text-white disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2"/> Initialize Intake
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}