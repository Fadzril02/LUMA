import React, { useState } from "react";
import { Network, Plus, Trash2, Link as LinkIcon, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "../../components/ui";

// Mock Data: Master Course List
const ALL_COURSES = [
  { id: "SECJ1013", name: "Programming Technique I" },
  { id: "SECJ1023", name: "Programming Technique II" },
  { id: "SECJ2013", name: "Data Structures and Algorithms" },
  { id: "SECP1513", name: "Technology & Information System" },
  { id: "SECR2043", name: "Operating Systems" }
];

// Mock Data: Existing Dependency Links
const INITIAL_LINKS = [
  { target: "SECJ1023", requires: "SECJ1013" },
  { target: "SECJ2013", requires: "SECJ1023" },
];

export function PrerequisiteEngineView() {
  const [links, setLinks] = useState(INITIAL_LINKS);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [selectedRequirement, setSelectedRequirement] = useState("");

  const handleCreateLink = () => {
    if (!selectedTarget || !selectedRequirement) return;
    if (selectedTarget === selectedRequirement) {
      alert("A course cannot be a prerequisite for itself!");
      return;
    }
    
    // Prevent duplicates
    const exists = links.some(l => l.target === selectedTarget && l.requires === selectedRequirement);
    if (!exists) {
      setLinks([...links, { target: selectedTarget, requires: selectedRequirement }]);
    }
    
    // Reset dropdowns
    setSelectedTarget("");
    setSelectedRequirement("");
  };

  const removeLink = (target: string, requires: string) => {
    setLinks(links.filter(l => !(l.target === target && l.requires === requires)));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Prerequisite Dependency Map</h3>
          <p className="text-sm text-gray-500">Define course sequencing to enforce academic registration rules.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: The "Create Link" Tool */}
        <Card className="h-fit shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
            <CardTitle className="flex items-center text-base"><LinkIcon className="w-4 h-4 mr-2 text-[#990033]" /> Link Courses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Target Course (The Goal)</label>
              <select 
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#990033]"
              >
                <option value="">Select Target Course...</option>
                {ALL_COURSES.map(c => <option key={c.id} value={c.id}>{c.id} - {c.name}</option>)}
              </select>
            </div>

            <div className="flex justify-center py-2">
              <div className="bg-gray-100 px-3 py-1 rounded-full text-xs font-semibold text-gray-500 flex items-center">
                <Network className="w-3 h-3 mr-1" /> REQUIRES
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Prerequisite (The Requirement)</label>
              <select 
                value={selectedRequirement}
                onChange={(e) => setSelectedRequirement(e.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#990033]"
              >
                <option value="">Select Prerequisite...</option>
                {ALL_COURSES.map(c => <option key={c.id} value={c.id}>{c.id} - {c.name}</option>)}
              </select>
            </div>

            <Button 
              onClick={handleCreateLink}
              disabled={!selectedTarget || !selectedRequirement}
              className="w-full mt-2 bg-[#990033] hover:bg-[#80002A] text-white disabled:opacity-50"
            >
              <Plus className="w-4 h-4 mr-2"/> Enforce Rule
            </Button>
            
            <div className="flex items-start gap-2 text-xs text-gray-500 bg-blue-50 p-3 rounded-md mt-4">
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
              <p>Advisors will be automatically warned if a student attempts to take a Target Course without completing the Requirement.</p>
            </div>
          </CardContent>
        </Card>

        {/* RIGHT COLUMN: The Active Rules Table */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="shadow-sm border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Target Course</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Rule</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Required Prerequisite</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {links.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500 text-sm">No dependencies configured yet.</td>
                    </tr>
                  ) : (
                    links.map((link, idx) => {
                      const targetCourse = ALL_COURSES.find(c => c.id === link.target);
                      const reqCourse = ALL_COURSES.find(c => c.id === link.requires);
                      
                      return (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900">{link.target}</div>
                            <div className="text-xs text-gray-500 truncate w-40">{targetCourse?.name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] tracking-widest">
                              MUST PASS
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-[#990033]">{link.requires}</div>
                            <div className="text-xs text-gray-500 truncate w-40">{reqCourse?.name}</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => removeLink(link.target, link.requires)}
                              className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded hover:bg-red-50 inline-flex"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}