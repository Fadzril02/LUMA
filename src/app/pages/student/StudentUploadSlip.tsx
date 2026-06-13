import React, { useState } from 'react';
import { db } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';

export const StudentUploadSlip = () => {
  const { profile } = useAuth(); // Gets the logged-in student's matric_no
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUploadToQueue = async () => {
    if (!file || !profile) return;
    setUploading(true);

    try {
      // 1. Generate a unique file path (e.g., A22EC0001/sem1_slip.pdf)
      const filePath = `${profile.matric_no}/${Date.now()}_${file.name}`;

      // 2. Upload the raw PDF to Supabase Storage (a bucket named 'transcripts')
      const { error: storageError } = await db.storage
        .from('transcripts')
        .upload(filePath, file);

      if (storageError) throw storageError;

      // 3. Create a "Pending" ticket in the database for the Advisor to see
      const { error: dbError } = await db.from('uploaded_documents').insert([
        {
          matric_no: profile.matric_no,
          file_name: file.name,
          file_path: filePath,
          processing_status: 'Pending_Verification'
        }
      ]);

      if (dbError) throw dbError;
      alert("Slip successfully submitted to your Advisor for review!");

    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Upload Examination Slip</h2>
      <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button 
        onClick={handleUploadToQueue} 
        disabled={uploading}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
      >
        {uploading ? "Uploading..." : "Submit to Advisor"}
      </button>
    </div>
  );
};