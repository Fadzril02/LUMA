import React, { useState } from "react";
import { Plus, Edit2, Trash2, Power, Search, Filter, X, Save } from "lucide-react";
import { Card, CardContent, Button, Badge, Input } from "../../components/ui";

// Mock data: In the future, this will be fetched from the `course_catalog` table
const INITIAL_COURSES = [
  { code: "SECJ1013", name: "Programming Technique I", credits: 3, prereqs: "None", type: "Core", isOffered: true },
  { code: "SECJ1023", name: "Programming Technique II", credits: 3, prereqs: "SECJ1013", type: "Core", isOffered: true },
  { code: "SECP1513", name: "Technology & Information System", credits: 3, prereqs: "None", type: "Core", isOffered: false },
  { code: "SECJ2013", name: "Data Structures and Algorithms", credits: 3, prereqs: "SECJ1023", type: "Core", isOffered: true },
];

export function CourseManagerView() {
  const [courses, setCourses] = useState(INITIAL_COURSES);
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All"); // All, Offered, Not Offered
  
  // UI States
  const [isAddingCourse, setIsAddingCourse] = useState(false);

  // Toggle function for Admin to turn courses on/off for the semester
  const toggleCourseStatus = (code: string) => {
    setCourses(prev => prev.map(c => 
      c.code === code ? { ...c, isOffered: !c.isOffered } : c
    ));
  };

  // Delete Course
  const deleteCourse = (code: string) => {
    setCourses(prev => prev.filter(c => c.code !== code));
  };

  // Dynamic Filtering Logic
  const filteredCourses = courses.filter(course => {
    const matchesSearch = 
      course.code.toLowerCase().includes(searchQuery.toLowerCase()) || 
      course.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      statusFilter === "All" ? true :
      statusFilter === "Offered" ? course.isOffered === true :
      course.isOffered === false;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Master Course Catalog</h2>
          <p className="text-sm text-gray-500">Define course dependencies, credits, and active semester availability.</p>
        </div>
        <Button 
          onClick={() => setIsAddingCourse(!isAddingCourse)}
          className="bg-[#990033] hover:bg-[#80002A] text-white"
        >
          {isAddingCourse ? <X className="w-4 h-4 mr-2"/> : <Plus className="w-4 h-4 mr-2"/>}
          {isAddingCourse ? "Cancel" : "Add New Course"}
        </Button>
      </div>

      {/* THE "ADD COURSE" INLINE FORM */}
      {isAddingCourse && (
        <Card className="border border-[#990033]/20 shadow-md bg-red-50/30">
          <CardContent className="p-6">
            <h3 className="text-sm font-bold text-[#990033] uppercase tracking-wider mb-4">Register New Course</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-600">Course Code</label>
                <Input placeholder="e.g. SECJ3203" className="border-gray-300 bg-white" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-gray-600">Course Name</label>
                <Input placeholder="e.g. Artificial Intelligence" className="border-gray-300 bg-white" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-600">Credits</label>
                <Input type="number" placeholder="3" className="border-gray-300 bg-white" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button className="bg-[#990033] hover:bg-[#80002A] text-white">
                <Save className="w-4 h-4 mr-2" /> Save to Catalog
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SEARCH AND FILTER BAR */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input 
            placeholder="Search by course code or name..." 
            className="pl-10 border-gray-200" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 shrink-0">
          {["All", "Offered", "Not Offered"].map((status) => (
            <button 
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                statusFilter === status 
                  ? "bg-white text-gray-900 shadow-sm" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* THE DATA TABLE */}
      <Card className="overflow-hidden border border-gray-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/70">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Course Detail</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Prerequisites</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Sem Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-gray-500">
                    <Filter className="w-8 h-8 mx-auto text-gray-300 mb-3" />
                    <p>No courses match your search criteria.</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => {setSearchQuery(""); setStatusFilter("All");}}>Clear Filters</Button>
                  </td>
                </tr>
              ) : (
                filteredCourses.map((course) => (
                  <tr key={course.code} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-[#990033]">{course.code}</div>
                      <div className="text-gray-900 font-medium mt-0.5">{course.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{course.credits} Credits • {course.type}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {course.prereqs === 'None' ? (
                        <span className="text-gray-400 italic text-sm">None</span>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 font-mono text-xs">{course.prereqs}</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleCourseStatus(course.code)}
                        className={`flex items-center px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                          course.isOffered 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" 
                            : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                        }`}
                      >
                        <Power className="w-3 h-3 mr-1.5" />
                        {course.isOffered ? "Offered" : "Not Offered"}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 text-gray-500 hover:text-indigo-600 transition-colors rounded hover:bg-indigo-50">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteCourse(course.code)}
                          className="p-2 text-gray-500 hover:text-rose-600 transition-colors rounded hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}