import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CloudUpload, FileText, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input } from "../../components/ui";
import { AppLayout } from "../../components/AppLayout";

const MOCK_EXTRACTED_DATA = [
  { code: "SECJ1013", name: "Programming Technique I", grade: "A", credits: 3, status: "Pass" },
  { code: "UHAK1012", name: "Philosophy and Current Issues", grade: "B+", credits: 2, status: "Pass" },
  { code: "SECR1013", name: "Digital Logic", grade: "A-", credits: 3, status: "Pass" },
  { code: "SECJ1023", name: "Programming Technique II", grade: "B", credits: 3, status: "Pass" },
  { code: "SECP1513", name: "Technology & Information System", grade: "A", credits: 3, status: "Pass" },
];

export function UploadResults() {
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "extracting" | "extracted">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [studentId, setStudentId] = useState("");

  const handleUpload = (e: React.DragEvent | React.ChangeEvent) => {
    e.preventDefault();
    setUploadState("uploading");
    setUploadProgress(0);

    // Simulate upload
    const uploadInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(uploadInterval);
          setUploadState("extracting");

          // Simulate extraction
          setTimeout(() => {
            setUploadState("extracted");
          }, 2000);
          return 100;
        }
        return prev + 20;
      });
    }, 300);
  };

  const handleReset = () => {
    setUploadState("idle");
    setUploadProgress(0);
    setStudentId("");
  };

  const handleConfirmSave = () => {
    alert("Data saved to Smart Flow successfully!");
    handleReset();
  };

  return (
    <AppLayout userRole="advisor" userName="Dr. Ahmad">
      <div className="p-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto space-y-6"
        >
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Upload & Extract Results</h1>
            <p className="text-sm text-gray-500">Process unofficial result slips (PDF) for automatic grade extraction</p>
          </div>

          <AnimatePresence mode="wait">
            {uploadState === "idle" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Student Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Student Matric Number</label>
                      <Input
                        placeholder="e.g., A20EC0001"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Upload Result Slip</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-[#990033] hover:bg-[#990033]/5 transition-all cursor-pointer group"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleUpload}
                      onClick={() => document.getElementById("file-upload")?.click()}
                    >
                      <CloudUpload className="w-16 h-16 text-gray-400 mx-auto mb-4 group-hover:text-[#990033] transition-colors" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Drag & Drop Unofficial Result Slip (PDF)
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">
                        or click to browse from your computer
                      </p>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 max-w-md mx-auto">
                        <div className="flex items-start space-x-2">
                          <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-blue-800 text-left">
                            Our AI will automatically extract course codes, grades, and credits from the PDF.
                          </p>
                        </div>
                      </div>
                      <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept=".pdf"
                        onChange={handleUpload}
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {(uploadState === "uploading" || uploadState === "extracting") && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <Loader2 className="w-16 h-16 text-[#990033] mx-auto mb-4 animate-spin" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {uploadState === "uploading" ? "Uploading Document..." : "Extracting Data..."}
                      </h3>
                      <p className="text-sm text-gray-500 mb-6">
                        {uploadState === "uploading"
                          ? "Please wait while we upload your PDF"
                          : "AI is analyzing the document and extracting grades"}
                      </p>

                      {uploadState === "uploading" && (
                        <div className="max-w-md mx-auto">
                          <div className="flex justify-between text-sm font-medium mb-2">
                            <span className="text-gray-700">Progress</span>
                            <span className="text-[#990033]">{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-[#FFCC00] to-[#990033] h-full rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {uploadState === "extracted" && (
              <motion.div
                key="extracted"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center space-x-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-green-900">Extraction Complete!</h4>
                    <p className="text-sm text-green-700">Successfully extracted {MOCK_EXTRACTED_DATA.length} courses from the PDF</p>
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Extracted Data</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">Review the extracted information before saving</p>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="px-4 py-3 text-sm font-semibold text-gray-600">Course Code</th>
                            <th className="px-4 py-3 text-sm font-semibold text-gray-600">Course Name</th>
                            <th className="px-4 py-3 text-sm font-semibold text-gray-600">Grade</th>
                            <th className="px-4 py-3 text-sm font-semibold text-gray-600">Credits</th>
                            <th className="px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MOCK_EXTRACTED_DATA.map((item, idx) => (
                            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 font-medium text-gray-900">{item.code}</td>
                              <td className="px-4 py-3 text-gray-600">{item.name}</td>
                              <td className="px-4 py-3">
                                <span className="font-bold text-[#990033]">{item.grade}</span>
                              </td>
                              <td className="px-4 py-3 text-gray-600">{item.credits}</td>
                              <td className="px-4 py-3">
                                <Badge variant="success">{item.status}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end space-x-3 mt-6">
                  <Button variant="outline" onClick={handleReset}>Cancel</Button>
                  <Button variant="primary" onClick={handleConfirmSave}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Confirm & Save to Smart Flow
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AppLayout>
  );
}
