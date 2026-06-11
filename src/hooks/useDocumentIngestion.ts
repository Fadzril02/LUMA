import { useState } from 'react';
import { db } from '../lib/supabase';

export const useDocumentIngestion = () => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadAndIngestTranscript = async (matricNo: string, file: File) => {
    setUploading(true);
    setError(null);

    try {
      // 1. Generate an enterprise-standard clean path signature
      const fileExtension = file.name.split('.').pop();
      const sanitizedFileName = `${matricNo}_${Date.now()}.${fileExtension}`;
      const filePath = `slips/${sanitizedFileName}`;

      // 2. Stream raw binary file payload to the Supabase cloud bucket
      const { data: storageData, error: storageError } = await db.storage
        .from('academic-slips')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (storageError) throw new Error(`Storage Engine Fault: ${storageError.message}`);

      // 3. Write a 'Pending' entry into the relational ledger database tracking system
      const { data: docRecord, error: dbError } = await db
        .from('uploaded_documents')
        .insert([
          {
            matric_no: matricNo,
            file_path: storageData.path,
            processing_status: 'Pending'
          }
        ])
        .select()
        .single();

      if (dbError) throw new Error(`Database Synchronization Ledger Fault: ${dbError.message}`);

      // 4. Return the document record ID so your frontend or backend parser can start reading it
      return docRecord;

    } catch (err: any) {
      console.error("Document ingestion pipeline broke down:", err);
      setError(err.message || 'An internal file transaction breakdown occurred.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploadAndIngestTranscript, uploading, error };
};