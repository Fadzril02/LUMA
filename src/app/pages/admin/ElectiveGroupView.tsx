import React, { useState } from "react";
import { Layers, Plus, Trash2, FolderPlus, ShieldCheck, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from "../../components/ui";

// Mock Data: Master list of electives
const AVAILABLE_ELECTIVES = [
  { id: "SECJ3103", name: "Web Programming", credits: 3 },
  { id: "SECJ3203", name: "Artificial Intelligence", credits: 3 },
  { id: "SECJ3223", name: "Machine Learning", credits: 3 },
  { id: "SECJ3303", name: "Data Engineering", credits: 3 },
  { id: "SECJ3553", name: "Cloud Computing Architectures", credits: 3 },
];

// Mock Data: Pre-configured Elective Tracks
const INITIAL_GROUPS = [
  {
    id: "TRK-AI",
    name: "Artificial Intelligence Specialization",
    requiredCredits: 9,
    courses: ["SECJ3203", "SECJ3223"]
  },
  {
    id: "TRK-SE",
    name: "Software Engineering Core Electives",
    requiredCredits: 12,
    courses: ["SECJ3103", "SECJ3553"]
  }
];

export function ElectiveGroupView() {
  const [groups, setGroups] = useState(INITIAL_GROUPS);
  
  // States for assigning a course to a group
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");

  const handleAssignCourse = () => {
    if (!selectedGroup || !selectedCourse) return;

    setGroups(prevGroups => prevGroups.map(group => {
      if (group.id === selectedGroup && !group.courses.includes(selectedCourse)) {
        return { ...group, courses: [...group.courses, selectedCourse] };
      }
      return group;
    }));

    setSelectedCourse(""); // Reset course selection
  };

  const removeCourseFromGroup = (groupId: string, courseId: string) => {
    setGroups(prevGroups => prevGroups.map(group => {
      if (group.id === groupId) {
        return { ...group, courses: group.courses.filter(c => c !== courseId) };
      }
      return group;
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Elective Tracks & Specializations</h3>
          <p className="text-sm text-gray-500">Bundle courses together and set credit requirements for graduation tracks.</p>
        </div>
        <Button className="bg-[#990033] hover:bg-[#80002A] text-white">
          <FolderPlus className="w-4 h-4 mr-2"/> Create New Track
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: The Assigner Tool */}
        <Card className="h-fit shadow-sm border-gray-200 sticky top-24">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
            <CardTitle className="flex items-center text-base"><Layers className="w-4 h-4 mr-2 text-[#990033]" /> Assign Courses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">1. Select Elective Track</label>
              <select 
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#990033]"
              >
                <option value="">Choose a track...</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">2. Select Course to Add</label>
              <select 
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#990033]"
              >
                <option value="">Choose a course...</option>
                {AVAILABLE_ELECTIVES.map(c => <option key={c.id} value={c.id}>{c.id} - {c.name}</option>)}
              </select>
            </div>

            <Button 
              onClick={handleAssignCourse}
              disabled={!selectedGroup || !selectedCourse}
              className="w-full mt-2 border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              variant="outline"
            >
              <Plus className="w-4 h-4 mr-2"/> Add to Track
            </Button>
          </CardContent>
        </Card>

        {/* RIGHT COLUMN: The Existing Tracks */}
        <div className="lg:col-span-2 space-y-6">
          {groups.map((group) => (
            <Card key={group.id} className="shadow-sm border-gray-200 overflow-hidden">
              {/* Group Header */}
              <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-gray-900 text-lg flex items-center">
                    {group.name} 
                  </h4>
                  <p className="text-sm text-gray-500 mt-1 flex items-center">
                    <ShieldCheck className="w-4 h-4 mr-1 text-emerald-600" />
                    Students must complete <strong className="mx-1 text-gray-900">{group.requiredCredits} Credits</strong> from this pool.
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-600">
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>

              {/* Group Courses List */}
              <div className="p-0">
                {group.courses.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">No courses assigned to this track yet.</div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {group.courses.map(courseId => {
                      const courseInfo = AVAILABLE_ELECTIVES.find(c => c.id === courseId);
                      return (
                        <li key={courseId} className="px-6 py-3 flex justify-between items-center hover:bg-gray-50/50 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className="bg-indigo-50 p-2 rounded text-indigo-700">
                              <BookOpen className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-gray-900">{courseId}</div>
                              <div className="text-xs text-gray-500">{courseInfo?.name}</div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <Badge variant="outline" className="text-gray-500 bg-white">
                              {courseInfo?.credits} Credits
                            </Badge>
                            <button 
                              onClick={() => removeCourseFromGroup(group.id, courseId)}
                              className="text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Card>
          ))}
        </div>

      </div>
    </div>
  );
}