"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

type Mode = "idle" | "recording" | "processing" | "done" | "error";
type InputTab = "voice" | "text";

interface Ward {
  id: string;
  name: string;
}

interface ComplaintResult {
  category: string;
  urgency: string;
  confidence: number;
  summary: string;
  ward_hint: string | null;
  sentiment_score: number;
  id?: string; // Assume backend might return this in future, or we mock it
}

export default function CitizenPage() {
  const [mode, setMode] = useState<Mode>("idle");
  const [inputTab, setInputTab] = useState<InputTab>("voice");
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedWard, setSelectedWard] = useState<string>("");
  const [textInput, setTextInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [transcript, setTranscript] = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const [result, setResult] = useState<ComplaintResult | null>(null);

  // Fetch wards on mount
  useEffect(() => {
    const fetchWards = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/wards`);
        if (res.ok) {
          const data = await res.json();
          setWards(data);
        }
      } catch (err) {
        console.error("Failed to fetch wards:", err);
      }
    };
    fetchWards();
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const startRecording = async () => {
    if (!selectedWard) {
      setErrorMessage("Please select your ward first.");
      setMode("error");
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        submitVoice(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setMode("recording");
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error("Mic access denied:", err);
      setErrorMessage("Microphone access denied. Please allow permissions.");
      setMode("error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setMode("processing");
    }
  };

  const submitVoice = async (audioBlob: Blob) => {
    setMode("processing");
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("ward_id", selectedWard);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/voice/submit`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to process voice. Server error.");
      
      const data = await res.json();
      setTranscript(data.transcript);
      setDetectedLanguage(data.detectedLanguage);
      setResult(data.complaint);
      setMode("done");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit recording.");
      setMode("error");
    }
  };

  const submitText = async () => {
    if (!selectedWard) {
      setErrorMessage("Please select your ward first.");
      setMode("error");
      return;
    }
    if (textInput.trim().length === 0) return;

    setMode("processing");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/complaints/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textInput, ward_id: selectedWard }),
      });

      if (!res.ok) throw new Error("Failed to process text complaint. Server error.");

      const data = await res.json();
      setTranscript(data.transcript);
      setDetectedLanguage(data.detectedLanguage);
      setResult(data.complaint);
      setMode("done");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit text complaint.");
      setMode("error");
    }
  };

  const resetForm = () => {
    setMode("idle");
    setTextInput("");
    setTranscript("");
    setResult(null);
    setErrorMessage("");
    setRecordingTime(0);
  };

  const getCategoryColor = (cat: string) => {
    const map: Record<string, string> = {
      roads: "bg-brand-saffron text-white",
      health: "bg-red-500 text-white",
      schools: "bg-blue-500 text-white",
      water_supply: "bg-cyan-500 text-white",
      sanitation: "bg-[#8B4513] text-white", // brown
      electricity: "bg-yellow-500 text-black",
      street_lights: "bg-yellow-400 text-black",
      other: "bg-gray-500 text-white"
    };
    return map[cat] || "bg-gray-500 text-white";
  };

  const getUrgencyColor = (urg: string) => {
    if (urg === "high") return "bg-red-100 text-red-800 border-red-200";
    if (urg === "medium") return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-green-100 text-green-800 border-green-200";
  };

  return (
    <div className="min-h-screen bg-brand-off-white text-on-surface pb-10">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10 px-4 py-4 flex items-center justify-between border-b border-surface-container-highest">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-brand-navy hover:bg-surface-container rounded-full p-2 transition">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="font-title-lg text-title-lg font-bold text-brand-charcoal">
            Submit Grievance <br className="sm:hidden" />
            <span className="text-sm font-normal text-on-surface-variant hidden sm:inline"> / </span>
            <span className="font-medium text-brand-navy sm:ml-1">शिकायत दर्ज करें</span>
          </h1>
        </div>
        <div className="flex gap-1 bg-surface-container-low p-1 rounded-full">
          <span className="px-3 py-1 bg-white shadow-sm rounded-full text-xs font-semibold text-brand-charcoal">EN</span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold text-on-surface-variant">हिंदी</span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold text-on-surface-variant">ಕನ್ನಡ</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto mt-6 px-4">
        {/* Ward Selector */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-surface-container-highest mb-6">
          <label className="block font-label-md text-label-md mb-2 text-brand-charcoal">
            Select your ward / अपना वार्ड चुनें <span className="text-red-500">*</span>
          </label>
          <select 
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            disabled={mode === "processing" || mode === "recording"}
            className="w-full bg-surface-bright border border-outline-variant rounded-lg p-3 text-body-md focus:ring-2 focus:ring-brand-saffron focus:outline-none transition disabled:opacity-50"
          >
            <option value="" disabled>-- Select Ward --</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        {/* Input Area */}
        {(mode === "idle" || mode === "recording") && (
          <div className="bg-white rounded-xl shadow-sm border border-surface-container-highest overflow-hidden fade-in visible">
            {/* Tabs */}
            <div className="flex border-b border-surface-container-highest">
              <button 
                onClick={() => setInputTab("voice")}
                className={`flex-1 py-4 font-title-lg text-lg transition-colors ${inputTab === "voice" ? "text-brand-navy border-b-2 border-brand-saffron bg-surface-container-lowest" : "text-on-surface-variant hover:bg-surface-container-lowest"}`}
              >
                🎤 Voice
              </button>
              <button 
                onClick={() => setInputTab("text")}
                className={`flex-1 py-4 font-title-lg text-lg transition-colors ${inputTab === "text" ? "text-brand-navy border-b-2 border-brand-saffron bg-surface-container-lowest" : "text-on-surface-variant hover:bg-surface-container-lowest"}`}
              >
                ✍️ Text
              </button>
            </div>

            <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
              {inputTab === "voice" && (
                <div className="flex flex-col items-center gap-6">
                  {/* Voice Button */}
                  <button 
                    onClick={mode === "idle" ? startRecording : stopRecording}
                    className={`relative flex items-center justify-center w-[90px] h-[90px] rounded-full text-white shadow-lg transition-all duration-300 hover:scale-105 active:scale-95
                      ${mode === "idle" ? "bg-brand-saffron" : "bg-red-500"}`}
                  >
                    {mode === "recording" && (
                      <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-75"></div>
                    )}
                    <span className="material-symbols-outlined text-4xl">
                      {mode === "idle" ? "mic" : "stop"}
                    </span>
                  </button>
                  
                  <div className="text-center">
                    <p className={`font-title-lg ${mode === "recording" ? "text-red-600 font-bold" : "text-brand-navy"}`}>
                      {mode === "idle" ? "Tap to speak" : "Recording... tap to stop"}
                    </p>
                    {mode === "recording" && (
                      <p className="text-3xl font-mono mt-2 text-brand-charcoal">{formatTime(recordingTime)}</p>
                    )}
                  </div>
                </div>
              )}

              {inputTab === "text" && (
                <div className="w-full flex flex-col gap-4">
                  <textarea 
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value.slice(0, 500))}
                    placeholder="Describe your issue in any language... किसी भी भाषा में लिखें..."
                    className="w-full h-32 bg-surface-bright border border-outline-variant rounded-lg p-4 text-body-md focus:ring-2 focus:ring-brand-saffron focus:outline-none resize-none"
                  ></textarea>
                  <div className="flex justify-between items-center">
                    <span className="text-label-md text-on-surface-variant">{textInput.length} / 500</span>
                    <button 
                      onClick={submitText}
                      disabled={textInput.length === 0}
                      className="bg-brand-saffron text-white px-6 py-2 rounded-lg font-title-lg shadow-sm hover:bg-brand-saffron/90 disabled:opacity-50 transition"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Processing State */}
        {mode === "processing" && (
          <div className="bg-white p-12 rounded-xl shadow-sm border border-brand-navy flex flex-col items-center justify-center gap-6 fade-in visible">
            <div className="w-16 h-16 border-4 border-surface-container-highest border-t-brand-navy rounded-full animate-spin"></div>
            <h3 className="font-title-lg text-brand-navy animate-pulse">Analyzing with Gemini AI...</h3>
            <p className="text-on-surface-variant text-center max-w-sm">
              We are categorizing your complaint and determining its urgency.
            </p>
          </div>
        )}

        {/* Error State */}
        {mode === "error" && (
          <div className="bg-red-50 p-8 rounded-xl shadow-sm border-2 border-brand-saffron flex flex-col items-center justify-center gap-4 fade-in visible">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-2">
              <span className="material-symbols-outlined text-4xl">error</span>
            </div>
            <h3 className="font-title-lg text-red-700">Submission Failed</h3>
            <p className="text-red-600 text-center">{errorMessage}</p>
            <button 
              onClick={resetForm}
              className="mt-4 bg-white border border-brand-saffron text-brand-saffron px-6 py-2 rounded-lg font-title-lg hover:bg-brand-saffron/10 transition"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Success / Result State */}
        {mode === "done" && result && (
          <div className="bg-white p-8 rounded-xl shadow-sm border-2 border-brand-green fade-in visible">
            <div className="flex flex-col items-center mb-8">
              <div className="w-20 h-20 bg-green-100 text-brand-green rounded-full flex items-center justify-center mb-4 animate-[bounce_1s_ease-in-out]">
                <span className="material-symbols-outlined text-5xl">check_circle</span>
              </div>
              <h2 className="font-headline-sm text-brand-charcoal font-bold text-center">Grievance Registered Successfully</h2>
              <p className="text-on-surface-variant text-sm mt-1">Reference ID: <span className="font-mono bg-surface-container px-2 py-0.5 rounded">{(result.id || Math.random().toString(36).substr(2, 8)).toUpperCase()}</span></p>
            </div>

            <div className="bg-surface-bright rounded-lg p-5 mb-6 border border-surface-container-highest">
              <h4 className="font-label-md text-on-surface-variant uppercase tracking-wider mb-2">AI Summary</h4>
              <p className="font-body-lg text-brand-charcoal">{result.summary}</p>
              {transcript && (
                <div className="mt-4 pt-4 border-t border-surface-container-highest">
                  <h4 className="font-label-md text-on-surface-variant uppercase tracking-wider mb-1">Original Transcript</h4>
                  <p className="text-sm text-on-surface-variant italic">&quot;{transcript}&quot;</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 mb-8">
              <div className={`px-4 py-2 rounded-full font-label-md shadow-sm ${getCategoryColor(result.category)} animate-[fadeIn_0.5s_ease-out_0.2s_both]`}>
                {result.category.replace('_', ' ').toUpperCase()}
              </div>
              <div className={`px-4 py-2 rounded-full font-label-md border shadow-sm ${getUrgencyColor(result.urgency)} animate-[fadeIn_0.5s_ease-out_0.4s_both]`}>
                {result.urgency.toUpperCase()} PRIORITY
              </div>
              {detectedLanguage && (
                <div className="px-4 py-2 rounded-full font-label-md bg-brand-navy/10 text-brand-navy shadow-sm animate-[fadeIn_0.5s_ease-out_0.6s_both]">
                  LANG: {detectedLanguage.toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex justify-center border-t border-surface-container-highest pt-6">
              <button 
                onClick={resetForm}
                className="bg-brand-navy text-white px-8 py-3 rounded-lg font-title-lg shadow-sm hover:bg-brand-navy/90 transition w-full sm:w-auto"
              >
                Submit Another Grievance
              </button>
            </div>
          </div>
        )}
      </main>
      
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
