import React, { useState } from "react";
import { motion } from "motion/react";
import { Search, Filter, ChevronRight } from "lucide-react";
import { Card, Button, Badge, Input } from "../../components/ui";
import { AppLayout } from "../../components/AppLayout";

const MOCK_STUDENTS = [
  { id: "A20EC0001", name: "Ahmad Bin Abdullah", cgpa: 3.75, credits: 88, status: "Good Standing" },
  { id: "A20EC0023", name: "Sarah Binti Othman", cgpa: 2.15, credits: 45, status: "At-Risk" },
  { id: "A20EC0045", name: "Lim Wei Ming", cgpa: 3.90, credits: 110, status: "Good Standing" },
  { id: "A20EC0078", name: "Priya a/p Ramesh", cgpa: 1.95, credits: 36, status: "At-Risk" },
  { id: "A20EC0089", name: "Mohammad Hafiz Bin Ismail", cgpa: 3.45, credits: 92, status: "Good Standing" },
  { id: "A20EC0101", name: "Tan Mei Ling", cgpa: 3.88, credits: 106, status: "Good Standing" },
  { id: "A20EC0112", name: "Kumar a/l Rajesh", cgpa: 3.12, credits: 78, status: "Good Standing" },
  { id: "A20EC0134", name: "Nurul Ain Binti Hassan", cgpa: 2.89, credits: 84, status: "Good Standing" },
];

export function StudentsList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "good" | "at-risk">("all");

  const filteredStudents = MOCK_STUDENTS.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      filterStatus === "all" ||
      (filterStatus === "good" && s.status === "Good Standing") ||
      (filterStatus === "at-risk" && s.status === "At-Risk");

    return matchesSearch && matchesFilter;
  });

  return (
    <AppLayout userRole="advisor" userName="Dr. Ahmad">
      <div className="p-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto space-y-6"
        >
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">My Students</h1>
            <p className="text-sm text-gray-500">View and manage all assigned students</p>
          </div>

          {/* Search and Filter */}
          <Card>
            <div className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="Search student name or matric number..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={filterStatus === "all" ? "primary" : "outline"}
                    onClick={() => setFilterStatus("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={filterStatus === "good" ? "primary" : "outline"}
                    onClick={() => setFilterStatus("good")}
                  >
                    Good Standing
                  </Button>
                  <Button
                    variant={filterStatus === "at-risk" ? "primary" : "outline"}
                    onClick={() => setFilterStatus("at-risk")}
                  >
                    At-Risk
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Results Summary */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-900">{filteredStudents.length}</span> of{" "}
              <span className="font-semibold text-gray-900">{MOCK_STUDENTS.length}</span> students
            </p>
          </div>

          {/* Students Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Student ID</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Name</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">CGPA</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Credits</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr
                      key={student.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">{student.id}</td>
                      <td className="px-6 py-4 text-gray-600">{student.name}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`font-semibold ${
                            student.cgpa < 2.0 ? "text-destructive" : "text-gray-900"
                          }`}
                        >
                          {student.cgpa.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{student.credits}</td>
                      <td className="px-6 py-4">
                        <Badge variant={student.status === "Good Standing" ? "success" : "danger"}>
                          {student.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Button variant="ghost" size="sm">
                          View <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {filteredStudents.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No students found matching your criteria</p>
            </div>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
