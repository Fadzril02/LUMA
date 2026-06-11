import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, AlertTriangle, Upload as UploadIcon } from "lucide-react";
import { Button, Input, Label } from "./ui";

interface CorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: { course: string; expectedGrade: string; remarks: string }) => void;
}

export function CorrectionModal({ isOpen, onClose, onSubmit }: CorrectionModalProps) {
  const [formData, setFormData] = useState({
    course: "",
    expectedGrade: "",
    remarks: "",
  });

  const handleSubmit = () => {
    onSubmit?.(formData);
    setFormData({ course: "", expectedGrade: "", remarks: "" });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Submit Correction Request</h3>
              <button onClick={onClose}>
                <X className="w-5 h-5 text-gray-500 hover:text-gray-700" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-[#FFCC00]/20 p-3 rounded-lg flex items-start space-x-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-[#997a00] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#806600]">
                  Use this form to report discrepancies between your uploaded unofficial transcript and the official system records.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="course">Course Code</Label>
                <Input
                  id="course"
                  placeholder="e.g., SECJ1013"
                  value={formData.course}
                  onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="grade">Expected Grade</Label>
                <Input
                  id="grade"
                  placeholder="e.g., A"
                  value={formData.expectedGrade}
                  onChange={(e) => setFormData({ ...formData, expectedGrade: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks</Label>
                <textarea
                  id="remarks"
                  className="w-full h-24 rounded-md border border-border bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#990033] focus:border-transparent resize-none"
                  placeholder="Describe the discrepancy..."
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="proof">Official Result Slip Proof (Optional)</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-[#990033] transition-colors cursor-pointer">
                  <UploadIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Click to upload supporting document</p>
                  <input type="file" className="hidden" id="proof" accept=".pdf,.jpg,.png" />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end space-x-3">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={handleSubmit}>Submit Request</Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
