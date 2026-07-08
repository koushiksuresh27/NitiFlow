"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Status = "idle" | "uploading" | "done" | "error";

interface DevPlanImportProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function DevPlanImport({ isOpen, onClose, onImportComplete }: DevPlanImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus("idle");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setStatus("idle");
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus("uploading");
    try {
      const formData = new FormData();
      formData.append("document", file);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/ocr/import-dev-plan`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to process document");
      }

      const data = await res.json();
      setResult(data);
      setStatus("done");
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setStatus("idle");
    setResult(null);
    setErrorMessage("");
  };

  const finish = () => {
    onImportComplete();
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-[500px] max-w-[90vw] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-surface-container-highest flex justify-between items-start">
          <div>
            <h2 className="font-headline-sm text-brand-charcoal">Import Development Plan</h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Upload a PDF of the local area development plan. Gemini will extract all proposed projects automatically.
            </p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-brand-charcoal transition" disabled={status === "uploading"}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 bg-surface-bright flex-1 overflow-y-auto">
          {status === "idle" && (
            <div 
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                ${isDragOver ? "border-brand-saffron bg-brand-saffron/5" : "border-outline-variant hover:border-brand-navy"}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".pdf" 
                className="hidden" 
              />
              
              <div className="w-16 h-16 bg-brand-navy/10 text-brand-navy rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl">upload_file</span>
              </div>
              
              {file ? (
                <div>
                  <p className="font-title-lg text-brand-navy truncate max-w-full">{file.name}</p>
                  <p className="text-xs text-on-surface-variant mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <p className="font-label-md text-on-surface-variant">Drop PDF here or click to browse</p>
              )}
            </div>
          )}

          {status === "uploading" && (
            <div className="py-12 flex flex-col items-center justify-center gap-6">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 border-4 border-surface-container-highest border-t-brand-saffron rounded-full animate-spin"></div>
                <div className="absolute inset-0 border-4 border-transparent border-l-brand-navy rounded-full animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
              </div>
              <div className="text-center">
                <h3 className="font-title-lg text-brand-navy mb-1 animate-pulse">🧠 Gemini extracting projects...</h3>
                <p className="text-sm text-on-surface-variant">Reading document and structuring layout data.</p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="p-6 bg-red-50 border border-brand-saffron rounded-xl text-center">
              <span className="material-symbols-outlined text-4xl text-brand-saffron mb-2">error</span>
              <h3 className="font-bold text-red-700 mb-2">Import Failed</h3>
              <p className="text-sm text-red-600 mb-4">{errorMessage}</p>
              <button 
                onClick={reset}
                className="bg-white border border-brand-saffron text-brand-saffron px-4 py-2 rounded font-label-md hover:bg-brand-saffron/10 transition"
              >
                Try Again
              </button>
            </div>
          )}

          {status === "done" && result && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-brand-green rounded-xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-brand-green mt-0.5">check_circle</span>
                <div>
                  <h3 className="font-bold text-brand-green">Imported {result.imported} projects into priority feed</h3>
                  <p className="text-xs text-green-700 mt-1">These projects will now be scored alongside citizen complaints.</p>
                </div>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                {result.projects?.map((p: any, i: number) => (
                  <div key={i} className="bg-white p-3 border border-surface-container-highest rounded flex justify-between items-center">
                    <div>
                      <p className="font-bold text-sm text-brand-charcoal truncate max-w-[250px]">{p.project_name}</p>
                      <p className="text-xs text-on-surface-variant uppercase">{p.category}</p>
                    </div>
                    <span className="text-xs font-bold bg-brand-navy/10 text-brand-navy px-2 py-1 rounded">Dev Plan</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-surface-container-highest bg-white flex justify-end gap-3">
          <button 
            onClick={status === "done" ? finish : onClose} 
            className="px-6 py-2 rounded-lg font-label-md text-on-surface-variant hover:bg-surface-container transition"
            disabled={status === "uploading"}
          >
            Cancel
          </button>
          
          {status === "idle" && (
            <button 
              onClick={handleUpload}
              disabled={!file}
              className="bg-brand-navy text-white px-6 py-2 rounded-lg font-label-md hover:bg-brand-navy/90 transition disabled:opacity-50"
            >
              Extract Projects
            </button>
          )}

          {status === "done" && (
            <button 
              onClick={finish}
              className="bg-brand-green text-white px-6 py-2 rounded-lg font-label-md hover:bg-brand-green/90 transition"
            >
              Finish
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
