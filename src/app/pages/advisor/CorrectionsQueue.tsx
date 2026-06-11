import React, { useState } from "react";
import { motion } from "motion/react";
import { Check, XCircle, Clock, CheckCircle2 } from "lucide-react";
import { Card, CardContent, Button, Badge } from "../../components/ui";
import { AppLayout } from "../../components/AppLayout";

const MOCK_QUEUE = [
  {
    id: "REQ-001",
    student: "Ahmad Bin Abdullah",
    matricNo: "A20EC0001",
    course: "SECR1013",
    detail: "Grade discrepancy: Uploaded A, System shows B+",
    status: "Pending",
    submitted: "12 May 2026",
  },
  {
    id: "REQ-002",
    student: "Sarah Binti Othman",
    matricNo: "A20EC0023",
    course: "SECJ1023",
    detail: "Missing course from extraction",
    status: "Pending",
    submitted: "11 May 2026",
  },
  {
    id: "REQ-003",
    student: "Lim Wei Ming",
    matricNo: "A20EC0045",
    course: "SECP1513",
    detail: "Credit hours mismatch: Should be 3, showing as 2",
    status: "Pending",
    submitted: "10 May 2026",
  },
];

export function CorrectionsQueue() {
  const [requests, setRequests] = useState(MOCK_QUEUE);

  const handleApprove = (id: string) => {
    setRequests(requests.filter((req) => req.id !== id));
    // In a real app, this would make an API call
  };

  const handleReject = (id: string) => {
    setRequests(requests.filter((req) => req.id !== id));
    // In a real app, this would make an API call
  };

  return (
    <AppLayout userRole="advisor" userName="Dr. Ahmad">
      <div className="p-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto space-y-6"
        >
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Correction Requests</h1>
            <p className="text-sm text-gray-500">Review and approve student correction requests</p>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-[#FFCC00]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Pending Requests</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{requests.length}</p>
                  </div>
                  <Clock className="w-8 h-8 text-[#FFCC00]" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Approved Today</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">7</p>
                  </div>
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Rejected Today</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">2</p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Requests List */}
          <div className="space-y-4">
            {requests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">All Caught Up!</h3>
                  <p className="text-sm text-gray-500">No pending correction requests at this time.</p>
                </CardContent>
              </Card>
            ) : (
              requests.map((req) => (
                <Card key={req.id}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <Badge variant="warning">{req.status}</Badge>
                          <span className="text-sm font-medium text-gray-500">{req.id}</span>
                        </div>
                        <h3 className="font-semibold text-gray-900 text-lg mb-1">
                          {req.student} ({req.matricNo})
                        </h3>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                          <p className="text-sm">
                            <span className="font-semibold text-gray-900">{req.course}:</span>{" "}
                            <span className="text-gray-700">{req.detail}</span>
                          </p>
                        </div>
                        <p className="text-xs text-gray-400">Submitted on {req.submitted}</p>
                      </div>

                      <div className="flex space-x-2 w-full md:w-auto">
                        <Button
                          variant="outline"
                          className="flex-1 md:flex-none border-destructive text-destructive hover:bg-destructive hover:text-white"
                          onClick={() => handleReject(req.id)}
                        >
                          <XCircle className="w-4 h-4 mr-2" /> Reject
                        </Button>
                        <Button
                          variant="primary"
                          className="flex-1 md:flex-none bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprove(req.id)}
                        >
                          <Check className="w-4 h-4 mr-2" /> Approve
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 bg-[#FFCC00]/10 -mx-6 -mb-6 px-6 py-3">
                      <p className="text-xs text-gray-600">
                        ⚠️ Approving this request will modify the student's official academic record. A
                        verified action log will be created.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
