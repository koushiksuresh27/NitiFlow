// ============================================================================
// EXTRACTED FRONTEND FEATURES
// ============================================================================
// 1. VOICE COMPLAINT PIPELINE (VoiceRecorder.tsx)
// 2. DNA PIPELINE (ChronicIssuesPage.tsx)
// 3. DOCUMENT INTELLIGENCE OCR PIPELINE (VendorImportModal.tsx)
// 4. ARIA CHAT AI ASSISTANT (EstateManagerAgent.tsx)
// 5. AUTO-ASSIGNMENT (Purely Postgres trigger, handled via UI implicitly)
// ============================================================================


// ================================================================================
// FILE: VoiceRecorder.tsx
// ================================================================================


// src/components/VoiceRecorder.tsx
import { useState, useRef, useCallback } from 'react';
import { Microphone, FastUpCircle, WarningTriangle } from 'iconoir-react';
import { transcribeAudio } from '../lib/sarvam';
import type { SarvamLanguage } from '../lib/sarvam';
import { suggestComplaintDetails } from '../lib/gemini';
import type { ComplaintSuggestion } from '../lib/gemini';

// â”€â”€â”€ Props â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface VoiceRecorderProps {
  onTranscript: (text: string) => void;
  onSuggestion: (suggestion: ComplaintSuggestion) => void;
  selectedLanguage: SarvamLanguage;
}

// â”€â”€â”€ Language options â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const LANGUAGE_OPTIONS: { code: SarvamLanguage; label: string }[] = [
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'à¤¹à¤¿à¤¨à¥à¤¦à¥€' },
  { code: 'mr-IN', label: 'à¤®à¤°à¤¾à¤ à¥€' },
  { code: 'gu-IN', label: 'àª—à«àªœàª°àª¾àª¤à«€' },
  { code: 'ta-IN', label: 'à®¤à®®à®¿à®´à¯' },
  { code: 'te-IN', label: 'à°¤à±†à°²à±à°—à±' },
  { code: 'kn-IN', label: 'à²•à²¨à³à²¨à²¡' },
  { code: 'ml-IN', label: 'à´®à´²à´¯à´¾à´³à´‚' },
  { code: 'bn-IN', label: 'à¦¬à¦¾à¦‚à¦²à¦¾' },
  { code: 'pa-IN', label: 'à¨ªà©°à¨œà¨¾à¨¬à©€' },
];

// â”€â”€â”€ Inline spinner (no iconoir dependency needed) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Spinner() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

// â”€â”€â”€ Status type â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type Status = 'idle' | 'recording' | 'transcribing' | 'suggesting' | 'done' | 'error';

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function VoiceRecorder({
  onTranscript,
  onSuggestion,
  selectedLanguage,
}: VoiceRecorderProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // â”€â”€ Start recording â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const startRecording = useCallback(async () => {
    setErrorMsg('');
    setStatus('idle');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMsg('Microphone access denied. Please allow microphone permission.');
      setStatus('error');
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    );

    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());

      const audioBlob = new Blob(chunksRef.current, {
        type: recorder.mimeType || 'audio/webm',
      });

      if (audioBlob.size < 1000) {
        setErrorMsg('Recording was too short or empty. Please try again.');
        setStatus('error');
        return;
      }

      // â”€â”€ Step 1: Transcribe via Sarvam â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      setStatus('transcribing');
      let transcript = '';
      try {
        const result = await transcribeAudio(audioBlob, selectedLanguage);
        transcript = result;
        if (!transcript.trim()) {
          setErrorMsg('No speech detected. Please speak clearly and try again.');
          setStatus('error');
          return;
        }
        onTranscript(transcript);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transcription failed';
        setErrorMsg(msg);
        setStatus('error');
        return;
      }

      // â”€â”€ Step 2: AI suggestion via Gemini â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      setStatus('suggesting');
      try {
        const suggestion = await suggestComplaintDetails(transcript);
        onSuggestion(suggestion);
      } catch (err) {
        // Non-fatal â€” transcript already succeeded
        console.warn('AI suggestion failed (non-fatal):', err);
      }

      setStatus('done');
      setTimeout(() => setStatus('idle'), 2000);
    };

    recorder.start(250);
    setStatus('recording');
  }, [selectedLanguage, onTranscript, onSuggestion]);

  // â”€â”€ Stop recording â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const isRecording = status === 'recording';
  const isProcessing = status === 'transcribing' || status === 'suggesting';

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="flex flex-col items-center gap-3">

      {/* Main button */}
      <button
        type="button"
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium
          transition-all duration-200
          ${isRecording
            ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
            : isProcessing
              ? 'bg-[#E0DDD9] text-[#9C9894] cursor-not-allowed'
              : status === 'done'
                ? 'bg-green-600 text-white'
                : 'bg-[#1C1917] text-white hover:bg-[#2C2925]'
          }
        `}
      >
        {isRecording ? (
          <>
            <FastUpCircle width={18} height={18} strokeWidth={1.5} />
            Stop Recording
          </>
        ) : isProcessing ? (
          <>
            <Spinner />
            {status === 'transcribing' ? 'Transcribingâ€¦' : 'Getting suggestionâ€¦'}
          </>
        ) : status === 'done' ? (
          'âœ“ Done'
        ) : (
          <>
            <Microphone width={18} height={18} strokeWidth={1.5} />
            Speak your complaint
          </>
        )}
      </button>

      {/* Recording hint */}
      {isRecording && (
        <p className="text-xs text-[#6B6560]">
          ðŸ”´ Recordingâ€¦ tap stop when done
        </p>
      )}

      {/* Error message */}
      {status === 'error' && errorMsg && (
        <div className="flex items-start gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-[10px] px-3 py-2 max-w-xs">
          <WarningTriangle
            width={16}
            height={16}
            strokeWidth={1.5}
            className="mt-0.5 shrink-0"
          />
          <span>{errorMsg}</span>
        </div>
      )}

    </div>
  );
}


// ================================================================================
// FILE: ChronicIssuesPage.tsx
// ================================================================================


import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WarningTriangle, Check, Eye, EditPencil } from 'iconoir-react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';



interface ChronicIssue {
  id: string;
  society_id: string;
  fingerprint: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  occurrence_count: number;
  threshold_count: number;
  first_seen_at: string;
  last_seen_at: string;
  status: 'active' | 'monitoring' | 'resolved';
  root_cause_ticket_id: string | null;
  created_at: string;
}

interface RootCauseTicket {
  id: string;
  society_id: string;
  title: string;
  description: string;
  fingerprint: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface IncidentCluster {
  id: string;
  society_id: string;
  fingerprint: string;
  complaint_count: number;
  is_chronic: boolean;
  created_at: string;
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function shortUuid(uuid: string | null): string {
  if (!uuid) return '';
  return uuid.slice(-6).toUpperCase();
}

const SEVERITY_BADGE: Record<string, React.CSSProperties> = {
  critical: { background: '#FEF2F2', color: '#dc2626' },
  high: { background: '#FFF7ED', color: '#ea580c' },
  medium: { background: '#FEF3C7', color: '#D97706' },
  low: { background: '#F5F3F0', color: '#6B6560' },
};

const STATUS_BADGE: Record<string, React.CSSProperties> = {
  active: { background: '#FEF2F2', color: '#dc2626' },
  monitoring: { background: '#FEF3C7', color: '#D97706' },
  resolved: { background: '#F0FDF4', color: '#15803D' },
  open: { background: '#FEF2F2', color: '#dc2626' },
  in_progress: { background: '#FEF3C7', color: '#D97706' },
  closed: { background: '#F5F3F0', color: '#6B6560' },
};


function Spinner() {
  return (
    <svg
      width="24" height="24" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

const SkeletonCard = () => (
  <div style={{
    background: '#F5F3F0',
    borderRadius: '16px',
    height: '120px',
    animation: 'pulse 1.5s ease infinite',
  }} />
);


export default function ChronicIssuesPage() {
  const [activeTab, setActiveTab] = useState<'chronic' | 'rootcause' | 'patterns'>('chronic');

  const [societyId, setSocietyId] = useState<string | null>(null);

  useEffect(() => {
    const fetchSociety = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('users')
        .select('society_id')
        .eq('id', user.id)
        .single()
      setSocietyId(profile?.society_id || null)
    }
    fetchSociety()
  }, []);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeChronicCount: 0,
    openTicketsCount: 0,
    clustersCount: 0,
    fingerprintedCount: 0,
  });

  const [chronicIssues, setChronicIssues] = useState<ChronicIssue[]>([]);
  const [rootCauseTickets, setRootCauseTickets] = useState<RootCauseTicket[]>([]);
  const [incidentClusters, setIncidentClusters] = useState<IncidentCluster[]>([]);

  // Expand/collapse state for Pattern History
  const [expandedPatterns, setExpandedPatterns] = useState<Set<string>>(new Set());

  // Ticket notes edit state
  const [ticketNotes, setTicketNotes] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    if (!societyId) return;
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Parallel fetch for stats and tab data
      const [
        { count: cIssuesCount },
        { count: rcTicketsCount },
        { count: iClustersCount },
        { count: fpCount },
        { data: cIssuesData },
        { data: rcTicketsData },
        { data: iClustersData }
      ] = await Promise.all([
        // Stats
        supabase.from('chronic_issues').select('*', { count: 'exact', head: true })
          .eq('society_id', societyId).eq('status', 'active'),
        supabase.from('root_cause_tickets').select('*', { count: 'exact', head: true })
          .eq('society_id', societyId).eq('status', 'open'),
        supabase.from('incident_clusters').select('*', { count: 'exact', head: true })
          .eq('society_id', societyId).gte('created_at', thirtyDaysAgo),
        supabase.from('complaint_fingerprints').select('*', { count: 'exact', head: true })
          .eq('society_id', societyId),
        // Tab Data
        supabase.from('chronic_issues').select('*')
          .eq('society_id', societyId).order('created_at', { ascending: false }),
        supabase.from('root_cause_tickets').select('*')
          .eq('society_id', societyId).order('created_at', { ascending: false }),
        supabase.from('incident_clusters').select('*')
          .eq('society_id', societyId).order('created_at', { ascending: false }).limit(50),
      ]);

      setStats({
        activeChronicCount: cIssuesCount ?? 0,
        openTicketsCount: rcTicketsCount ?? 0,
        clustersCount: iClustersCount ?? 0,
        fingerprintedCount: fpCount ?? 0,
      });

      setChronicIssues((cIssuesData as unknown as ChronicIssue[]) ?? []);
      setRootCauseTickets((rcTicketsData as unknown as RootCauseTicket[]) ?? []);
      setIncidentClusters((iClustersData as unknown as IncidentCluster[]) ?? []);

      const initialNotes: Record<string, string> = {};
      ((rcTicketsData ?? []) as unknown as RootCauseTicket[]).forEach(t => {
        initialNotes[t.id] = t.resolution_notes ?? '';
      });
      setTicketNotes(initialNotes);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [societyId]);

  useEffect(() => {
    if (societyId) {
      fetchData();
    }
  }, [fetchData, societyId]);

  const handleResolveIssue = async (id: string) => {
    try {
      await supabase.from('chronic_issues').update({ status: 'resolved' }).eq('id', id);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveTicketNotes = async (id: string) => {
    try {
      await supabase.from('root_cause_tickets')
        .update({ resolution_notes: ticketNotes[id] })
        .eq('id', id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTicketStatus = async (id: string, status: 'resolved' | 'in_progress') => {
    try {
      const updateData: { status: string; resolved_at?: string } = { status };
      if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
      }
      await supabase.from('root_cause_tickets').update(updateData).eq('id', id);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const togglePattern = (fp: string) => {
    setExpandedPatterns(prev => {
      const next = new Set(prev);
      next.has(fp) ? next.delete(fp) : next.add(fp);
      return next;
    });
  };

  const groupedPatterns = useMemo(() => {
    const groups: Record<string, IncidentCluster[]> = {};
    incidentClusters.forEach(cluster => {
      if (!groups[cluster.fingerprint]) groups[cluster.fingerprint] = [];
      groups[cluster.fingerprint].push(cluster);
    });
    return groups;
  }, [incidentClusters]);


  const pageContainer: React.CSSProperties = {
    maxWidth: 1280, margin: '0 auto', paddingBottom: 64,
  };

  const cardBase: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1px solid #E0DDD9',
    borderRadius: 16,
    padding: 20,
  };

  function tabStyle(active: boolean): React.CSSProperties {
    return {
      padding: '10px 0',
      fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15,
      color: active ? '#1C1917' : '#9C9894',
      cursor: 'pointer', background: 'transparent',
      border: 'none',
      borderBottom: active ? '2px solid #1C1917' : '2px solid transparent',
      transition: 'color 0.2s, border-color 0.2s',
    };
  }

  const monospacePill: React.CSSProperties = {
    background: '#F5F3F0',
    fontFamily: 'monospace',
    fontSize: 12,
    padding: '2px 8px',
    borderRadius: 6,
    color: '#1C1917',
    display: 'inline-block',
  };

  return (
    <AdminLayout>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        body {
          background-color: #EDEBE6;
        }
      `}</style>

      <div style={pageContainer}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 28, color: '#1C1917', margin: '0 0 8px' }}>
            Complaint DNA
          </h1>
          <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#6B6560', margin: 0 }}>
            Pattern detection &amp; chronic issue intelligence
          </p>
        </div>

        {/* 4 Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 32 }}>
          <div style={cardBase}>
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#6B6560', margin: '0 0 8px', fontWeight: 500 }}>Active Chronic Issues</p>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 32, margin: 0, color: stats.activeChronicCount > 0 ? '#dc2626' : '#9C9894' }}>
              {stats.activeChronicCount}
            </h3>
          </div>
          <div style={cardBase}>
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#6B6560', margin: '0 0 8px', fontWeight: 500 }}>Open Root Cause Tickets</p>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 32, margin: 0, color: stats.openTicketsCount > 0 ? '#D97706' : '#9C9894' }}>
              {stats.openTicketsCount}
            </h3>
          </div>
          <div style={cardBase}>
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#6B6560', margin: '0 0 8px', fontWeight: 500 }}>Incident Clusters (30d)</p>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 32, margin: 0, color: '#1C1917' }}>
              {stats.clustersCount}
            </h3>
          </div>
          <div style={cardBase}>
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#6B6560', margin: '0 0 8px', fontWeight: 500 }}>Complaints Fingerprinted</p>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 32, margin: 0, color: '#1C1917' }}>
              {stats.fingerprintedCount}
            </h3>
          </div>
        </div>

        {/* Tabs Header */}
        <div style={{ display: 'flex', gap: 28, marginBottom: 24, borderBottom: '1px solid #E0DDD9' }}>
          <button onClick={() => setActiveTab('chronic')} style={tabStyle(activeTab === 'chronic')}>
            Chronic Issues
          </button>
          <button onClick={() => setActiveTab('rootcause')} style={tabStyle(activeTab === 'rootcause')}>
            Root Cause Tickets
          </button>
          <button onClick={() => setActiveTab('patterns')} style={tabStyle(activeTab === 'patterns')}>
            Pattern History
          </button>
        </div>

        {/* Tab 1: Chronic Issues */}
        {activeTab === 'chronic' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : chronicIssues.length === 0 ? (
              <div style={{ ...cardBase, padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#6B6560', margin: 0 }}>
                  ðŸ§¬ No chronic issues detected yet.<br />The DNA pipeline will flag patterns as complaints come in.
                </p>
              </div>
            ) : (
              chronicIssues.map(issue => (
                <div key={issue.id} style={cardBase}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        {issue.severity && (
                          <span style={{
                            ...SEVERITY_BADGE[issue.severity],
                            borderRadius: 6, padding: '3px 10px',
                            fontFamily: 'Inter', fontWeight: 600, fontSize: 11, textTransform: 'uppercase',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}>
                            {(issue.severity === 'critical' || issue.severity === 'high') && <WarningTriangle width={12} height={12} />}
                            {issue.severity}
                          </span>
                        )}
                        <span style={monospacePill}>{issue.fingerprint}</span>
                      </div>
                      <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, color: '#1C1917', margin: '0 0 4px' }}>
                        {issue.category || issue.fingerprint}
                      </h3>
                      <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#9C9894', margin: 0 }}>
                        First seen: {fmtDate(issue.first_seen_at)} &middot; Last seen: {fmtDate(issue.last_seen_at)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      <span style={{
                        ...(STATUS_BADGE[issue.status] ?? {}),
                        borderRadius: 6, padding: '3px 10px',
                        fontFamily: 'Inter', fontWeight: 500, fontSize: 12, textTransform: 'capitalize'
                      }}>
                        {issue.status}
                      </span>
                      {issue.status === 'active' && (
                        <button
                          onClick={() => handleResolveIssue(issue.id)}
                          style={{
                            background: '#1C1917', color: '#FFF', border: 'none', borderRadius: 8,
                            padding: '6px 12px', fontFamily: 'Inter', fontSize: 13, fontWeight: 500,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                          }}
                        >
                          <Check width={16} height={16} /> Mark Resolved
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 32, borderTop: '1px solid #E0DDD9', paddingTop: 16 }}>
                    <div>
                      <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894', margin: '0 0 4px' }}>Occurrences</p>
                      <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#1C1917', fontWeight: 500, margin: 0 }}>
                        {issue.occurrence_count} times in 30 days
                      </p>
                    </div>
                    <div>
                      <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894', margin: '0 0 4px' }}>Threshold</p>
                      <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#1C1917', fontWeight: 500, margin: 0 }}>
                        {issue.threshold_count} times
                      </p>
                    </div>
                    <div>
                      <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894', margin: '0 0 4px' }}>Root Cause Ticket</p>
                      <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#1C1917', fontWeight: 500, margin: 0 }}>
                        {issue.root_cause_ticket_id ? `#RC-${shortUuid(issue.root_cause_ticket_id)}` : 'None'}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894', margin: '0 0 4px' }}>Affected Complaints</p>
                      <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#1C1917', fontWeight: 500, margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {issue.occurrence_count} <Eye width={14} height={14} style={{ color: '#D97706', cursor: 'pointer' }} />
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Root Cause Tickets */}
        {activeTab === 'rootcause' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : rootCauseTickets.length === 0 ? (
              <div style={{ ...cardBase, padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#6B6560', margin: 0 }}>
                  âœ… No open root cause tickets.
                </p>
              </div>
            ) : (
              rootCauseTickets.map(ticket => (
                <div key={ticket.id} style={cardBase}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 16, color: '#1C1917' }}>
                          #RC-{shortUuid(ticket.id)}
                        </span>
                        <span style={{
                          ...(STATUS_BADGE[ticket.status] ?? {}),
                          borderRadius: 6, padding: '3px 10px',
                          fontFamily: 'Inter', fontWeight: 500, fontSize: 12, textTransform: 'uppercase'
                        }}>
                          {ticket.status}
                        </span>
                        <span style={monospacePill}>{ticket.fingerprint}</span>
                      </div>
                      <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#1C1917', margin: '0 0 8px', fontWeight: 500 }}>
                        {ticket.description || ticket.title || 'Root Issue Details'}
                      </p>
                      <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#9C9894', margin: 0 }}>
                        Created: {fmtDate(ticket.created_at)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {ticket.status === 'open' && (
                        <button
                          onClick={() => handleUpdateTicketStatus(ticket.id, 'in_progress')}
                          style={{
                            background: '#F5F3F0', color: '#1C1917', border: '1px solid #E0DDD9', borderRadius: 8,
                            padding: '6px 12px', fontFamily: 'Inter', fontSize: 13, fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          Mark In Progress
                        </button>
                      )}
                      {(ticket.status === 'open' || ticket.status === 'in_progress') && (
                        <button
                          onClick={() => handleUpdateTicketStatus(ticket.id, 'resolved')}
                          style={{
                            background: '#1C1917', color: '#FFF', border: 'none', borderRadius: 8,
                            padding: '6px 12px', fontFamily: 'Inter', fontSize: 13, fontWeight: 500,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                          }}
                        >
                          <Check width={16} height={16} /> Mark Resolved
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #E0DDD9', paddingTop: 16 }}>
                    <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#1C1917', fontWeight: 500, margin: '0 0 8px' }}>
                      Resolution notes:
                    </p>
                    <textarea
                      value={ticketNotes[ticket.id] ?? ''}
                      onChange={e => setTicketNotes(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                      style={{
                        width: '100%', minHeight: 80, padding: 12,
                        background: '#FAFAF9', border: '1px solid #E0DDD9', borderRadius: 8,
                        fontFamily: 'Inter', fontSize: 14, color: '#1C1917', resize: 'vertical',
                        marginBottom: 12, boxSizing: 'border-box'
                      }}
                    />
                    <button
                      onClick={() => handleSaveTicketNotes(ticket.id)}
                      style={{
                        background: '#F5F3F0', color: '#1C1917', border: '1px solid #E0DDD9', borderRadius: 8,
                        padding: '6px 12px', fontFamily: 'Inter', fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <EditPencil width={14} height={14} /> Save Notes
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Pattern History */}
        {activeTab === 'patterns' && (
          <div style={cardBase}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                <Spinner />
              </div>
            ) : Object.keys(groupedPatterns).length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#6B6560', margin: 0 }}>
                  No pattern history yet.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {Object.entries(groupedPatterns).map(([fingerprint, clusters]) => (
                  <div key={fingerprint} style={{ borderBottom: '1px solid #E0DDD9', padding: '16px 0' }}>
                    <div
                      onClick={() => togglePattern(fingerprint)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                    >
                      <span style={{ fontSize: 14, color: '#9C9894', display: 'inline-block', transform: expandedPatterns.has(fingerprint) ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                        â–¶
                      </span>
                      <span style={monospacePill}>{fingerprint}</span>
                      <span style={{ fontFamily: 'Inter', fontSize: 13, color: '#9C9894' }}>
                        ({clusters.length} cluster{clusters.length !== 1 ? 's' : ''})
                      </span>
                    </div>

                    {expandedPatterns.has(fingerprint) && (
                      <div style={{ paddingLeft: 28, marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {clusters.map(cluster => (
                          <div key={cluster.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round">
                              <circle cx="12" cy="12" r="10" />
                            </svg>
                            <div>
                              <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#1C1917', margin: '0 0 4px', fontWeight: 500 }}>
                                {cluster.complaint_count} complaints clustered &middot; {fmtDate(cluster.created_at)}
                              </p>
                              <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#6B6560', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                                Chronic:
                                <span style={{
                                  background: cluster.is_chronic ? '#FEF2F2' : '#F5F3F0',
                                  color: cluster.is_chronic ? '#dc2626' : '#6B6560',
                                  padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase'
                                }}>
                                  {cluster.is_chronic ? 'Yes' : 'No'}
                                </span>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}


// ================================================================================
// FILE: VendorImportModal.tsx
// ================================================================================


import { useState } from 'react'
import { CloudUpload, Page, Trash, Xmark, Check } from 'iconoir-react'

const WORKFLOW_URL = import.meta.env.VITE_WORKFLOW_URL || 'http://localhost:3001'

interface VendorRecord {
  company_name: string
  service_type: string
  contact_name: string | null
  contact_phone: string | null
  contract_cost: number | null
  contract_end_date: string | null
  notes: string | null
}

interface Props {
  societyId: string
  onClose: () => void
  onImportComplete: () => void
}

type Step = 'upload' | 'processing' | 'review' | 'importing'

const SERVICE_TYPES = [
  'Plumbing', 'Electrical', 'Lift', 'Security', 'Housekeeping', 
  'Pest Control', 'Generator', 'Landscaping', 'Other'
]

export default function VendorImportModal({ societyId, onClose, onImportComplete }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [vendors, setVendors] = useState<VendorRecord[]>([])
  const [error, setError] = useState('')

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }

  const handleAnalyze = async () => {
    if (!selectedFile) return
    
    setStep('processing')
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch(`${WORKFLOW_URL}/import/vendors/analyze`, { 
        method: 'POST', 
        body: formData 
      })

      const data = await res.json()

      if (!data.success || !data.vendors) {
        throw new Error(data.error || 'Analysis failed')
      }

      if (data.vendors.length === 0) {
        setError('No vendor data found in this document. Try a clearer image or a document with a vendor list/table.')
        setStep('upload')
        return
      }

      setVendors(data.vendors)
      setStep('review')

    } catch (err: any) {
      setError(err.message || 'Failed to analyze document')
      setStep('upload')
    }
  }

  const updateVendor = (index: number, field: string, value: any) => {
    setVendors(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v))
  }

  const removeVendor = (index: number) => {
    setVendors(prev => prev.filter((_, i) => i !== index))
  }

  const handleConfirmImport = async () => {
    setStep('importing')

    try {
      const res = await fetch(`${WORKFLOW_URL}/import/vendors/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendors, society_id: societyId })
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error('Import failed')
      }

      onImportComplete()
      onClose()

    } catch (err: any) {
      setError(err.message || 'Failed to import vendors')
      setStep('review')
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(28,25,23,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '24px'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        width: '100%',
        maxWidth: step === 'review' ? '640px' : '440px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #E0DDD9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <p style={{
              fontFamily: 'Space Grotesk',
              fontWeight: '700',
              fontSize: '18px',
              color: '#1C1917',
              margin: 0
            }}>
              {step === 'review' ? `Found ${vendors.length} vendor${vendors.length !== 1 ? 's' : ''}` : 'Import Vendors from Document'}
            </p>
            <p style={{
              fontFamily: 'Inter',
              fontSize: '12px',
              color: '#9C9894',
              margin: '2px 0 0'
            }}>
              {step === 'review' ? 'Review and edit before importing' : 'Upload a vendor list, AMC contract, or invoice'}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={step === 'processing' || step === 'importing'}
            style={{
              background: '#F5F3F0',
              border: 'none',
              borderRadius: '8px',
              width: '32px', height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#6B6560'
            }}
          >
            <Xmark width={16} height={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          flex: 1
        }}>

          {/* STEP: UPLOAD */}
          {step === 'upload' && (
            <div>
              <label style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                border: '2px dashed #E0DDD9',
                borderRadius: '16px',
                padding: '40px 20px',
                cursor: 'pointer',
                background: selectedFile ? '#F5F3F0' : 'transparent',
                transition: 'all 0.15s'
              }}>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                {selectedFile ? (
                  <>
                    <Page width={32} height={32} strokeWidth={1.5} color="#1C1917" />
                    <p style={{
                      fontFamily: 'Space Grotesk',
                      fontWeight: '600',
                      fontSize: '14px',
                      color: '#1C1917',
                      margin: 0,
                      textAlign: 'center'
                    }}>
                      {selectedFile.name}
                    </p>
                    <p style={{
                      fontFamily: 'Inter',
                      fontSize: '12px',
                      color: '#9C9894',
                      margin: 0
                    }}>
                      Tap to choose a different file
                    </p>
                  </>
                ) : (
                  <>
                    <CloudUpload width={32} height={32} strokeWidth={1.5} color="#9C9894" />
                    <p style={{
                      fontFamily: 'Space Grotesk',
                      fontWeight: '600',
                      fontSize: '14px',
                      color: '#1C1917',
                      margin: 0
                    }}>
                      Tap to upload
                    </p>
                    <p style={{
                      fontFamily: 'Inter',
                      fontSize: '12px',
                      color: '#9C9894',
                      margin: 0,
                      textAlign: 'center'
                    }}>
                      PDF, PNG or JPG â€” vendor list, contract, or invoice
                    </p>
                  </>
                )}
              </label>

              {error && (
                <p style={{
                  fontFamily: 'Inter',
                  fontSize: '12px',
                  color: '#DC2626',
                  marginTop: '12px',
                  lineHeight: '1.5'
                }}>
                  {error}
                </p>
              )}

              <button
                onClick={handleAnalyze}
                disabled={!selectedFile}
                style={{
                  width: '100%',
                  marginTop: '20px',
                  padding: '12px',
                  background: selectedFile ? '#1C1917' : '#E0DDD9',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontFamily: 'Space Grotesk',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: selectedFile ? 'pointer' : 'not-allowed'
                }}
              >
                Analyze Document
              </button>
            </div>
          )}

          {/* STEP: PROCESSING */}
          {step === 'processing' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '40px 20px',
              gap: '16px'
            }}>
              <div style={{
                width: '40px', height: '40px',
                border: '3px solid #E0DDD9',
                borderTopColor: '#D97706',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
              <p style={{
                fontFamily: 'Space Grotesk',
                fontWeight: '600',
                fontSize: '14px',
                color: '#1C1917',
                margin: 0
              }}>
                Analyzing your document...
              </p>
              <p style={{
                fontFamily: 'Inter',
                fontSize: '12px',
                color: '#9C9894',
                margin: 0
              }}>
                This usually takes 10-30 seconds
              </p>
            </div>
          )}

          {/* STEP: REVIEW */}
          {step === 'review' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {vendors.map((vendor, i) => (
                <div key={i} style={{
                  background: '#F5F3F0',
                  border: '1px solid #E0DDD9',
                  borderRadius: '14px',
                  padding: '16px',
                  position: 'relative'
                }}>
                  <button
                    onClick={() => removeVendor(i)}
                    style={{
                      position: 'absolute',
                      top: '12px', right: '12px',
                      background: 'none',
                      border: 'none',
                      color: '#9C9894',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash width={15} height={15} strokeWidth={1.5} />
                  </button>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px'
                  }}>
                    <div>
                      <label style={{
                        fontSize: '11px',
                        fontFamily: 'Space Grotesk',
                        fontWeight: '500',
                        color: '#6B6560',
                        display: 'block',
                        marginBottom: '4px'
                      }}>
                        Company Name
                      </label>
                      <input
                        value={vendor.company_name || ''}
                        onChange={(e) => updateVendor(i, 'company_name', e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>
                        Service Type
                      </label>
                      <select
                        value={vendor.service_type || 'Other'}
                        onChange={(e) => updateVendor(i, 'service_type', e.target.value)}
                        style={inputStyle}
                      >
                        {SERVICE_TYPES.map(t => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>
                        Contact Name
                      </label>
                      <input
                        value={vendor.contact_name || ''}
                        onChange={(e) => updateVendor(i, 'contact_name', e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>
                        Contact Phone
                      </label>
                      <input
                        value={vendor.contact_phone || ''}
                        onChange={(e) => updateVendor(i, 'contact_phone', e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>
                        Contract Cost (â‚¹)
                      </label>
                      <input
                        type="number"
                        value={vendor.contract_cost || ''}
                        onChange={(e) => updateVendor(i, 'contract_cost', parseFloat(e.target.value) || null)}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>
                        Contract End Date
                      </label>
                      <input
                        type="date"
                        value={vendor.contract_end_date || ''}
                        onChange={(e) => updateVendor(i, 'contract_end_date', e.target.value || null)}
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={labelStyle}>
                        Notes
                      </label>
                      <input
                        value={vendor.notes || ''}
                        onChange={(e) => updateVendor(i, 'notes', e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {vendors.length === 0 && (
                <p style={{
                  textAlign: 'center',
                  color: '#9C9894',
                  fontFamily: 'Inter',
                  fontSize: '13px',
                  padding: '20px'
                }}>
                  All vendors removed. Cancel and try again.
                </p>
              )}

              {error && (
                <p style={{
                  fontFamily: 'Inter',
                  fontSize: '12px',
                  color: '#DC2626'
                }}>
                  {error}
                </p>
              )}
            </div>
          )}

          {/* STEP: IMPORTING */}
          {step === 'importing' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '40px 20px',
              gap: '16px'
            }}>
              <div style={{
                width: '40px', height: '40px',
                border: '3px solid #E0DDD9',
                borderTopColor: '#D97706',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
              <p style={{
                fontFamily: 'Space Grotesk',
                fontWeight: '600',
                fontSize: '14px',
                color: '#1C1917'
              }}>
                Importing vendors...
              </p>
            </div>
          )}
        </div>

        {/* Footer â€” only on review step */}
        {step === 'review' && vendors.length > 0 && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #E0DDD9',
            display: 'flex',
            gap: '10px'
          }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                background: 'transparent',
                border: '1px solid #E0DDD9',
                borderRadius: '10px',
                color: '#6B6560',
                fontFamily: 'Space Grotesk',
                fontWeight: '500',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmImport}
              style={{
                flex: 2,
                padding: '12px',
                background: '#D97706',
                border: 'none',
                borderRadius: '10px',
                color: '#FFFFFF',
                fontFamily: 'Space Grotesk',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Check width={16} height={16} strokeWidth={2} />
              Import {vendors.length} Vendor{vendors.length !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg) }
          to { transform: rotate(360deg) }
        }
      `}</style>
    </div>
  )
}

const labelStyle = {
  fontSize: '11px',
  fontFamily: 'Space Grotesk',
  fontWeight: '500',
  color: '#6B6560',
  display: 'block',
  marginBottom: '4px'
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #E0DDD9',
  borderRadius: '8px',
  fontFamily: 'Inter',
  fontSize: '13px',
  color: '#1C1917',
  background: '#FFFFFF',
  boxSizing: 'border-box' as const
}


// ================================================================================
// FILE: EstateManagerAgent.tsx
// ================================================================================


import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { transcribeAudio, LANGUAGES } from '../../lib/sarvam'
import { textToSpeech, playBase64Audio } from '../../lib/sarvamTTS'
import { Microphone, SoundHigh, SoundOff, SendDiagonal } from 'iconoir-react'

const WORKFLOW_URL = import.meta.env.VITE_WORKFLOW_URL || 'http://localhost:3001'

interface ActionTaken {
  tool: string
  result?: { content?: string }
}

interface Message {
  role: 'user' | 'agent'
  content: string
  timestamp: Date
  tool_calls?: number
  actions_taken?: ActionTaken[]
}

// â”€â”€â”€ Markdown-like message formatter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function formatMessage(content: string) {
  return content.split('\n').map((line, i) => {
    if (line.startsWith('* ') || line.startsWith('â€¢ ')) {
      return (
        <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '4px', paddingLeft: '8px' }}>
          <span style={{ color: '#D97706', flexShrink: 0, marginTop: '2px' }}>â€¢</span>
          <span>{line.slice(2)}</span>
        </div>
      )
    }
    if (line.startsWith('**') && line.endsWith('**')) {
      return (
        <p key={i} style={{ fontWeight: 600, marginBottom: '4px', margin: '0 0 4px' }}>
          {line.slice(2, -2)}
        </p>
      )
    }
    if (line.trim() === '') {
      return <br key={i} />
    }
    return (
      <p key={i} style={{ marginBottom: '4px', lineHeight: '1.6', margin: '0 0 4px' }}>
        {line}
      </p>
    )
  })
}

// â”€â”€â”€ Typing dots â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TypingDots() {
  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
    }}>
      <div style={{
        width: '28px', height: '28px',
        borderRadius: '50%',
        background: '#1C1917',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: '12px',
      }}>
        ðŸ¤–
      </div>
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E0DDD9',
        borderRadius: '12px 12px 12px 4px',
        padding: '10px 14px',
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: '6px', height: '6px',
            borderRadius: '50%',
            background: '#9C9894',
            animation: `ema-bounce 1.2s infinite ${i * 0.2}s`,
          }} />
        ))}
      </div>
    </div>
  )
}

// â”€â”€â”€ Quick actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const QUICK_ACTIONS = [
  "What's most urgent right now?",
  "Plan today's work schedule",
  "Any monsoon prep needed?",
  "What should I tell the committee?",
  "Cost savings this month",
]

const LANGUAGE_NAMES: Record<string, string> = {
  'en-IN': 'English',
  'hi-IN': 'Hindi',
  'kn-IN': 'Kannada',
  'ta-IN': 'Tamil',
  'te-IN': 'Telugu',
  'ml-IN': 'Malayalam',
  'mr-IN': 'Marathi',
  'gu-IN': 'Gujarati',
  'bn-IN': 'Bengali',
  'pa-IN': 'Punjabi',
  'od-IN': 'Odia',
}

// â”€â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function EstateManagerAgent() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [conversationHistory, setConversationHistory] = useState<object[]>([])
  const [isBriefingLoading, setIsBriefingLoading] = useState(false)

  const [mode, setMode] = useState<'assistant' | 'agent'>('assistant')
  const [adminId, setAdminId] = useState<string | null>(null)
  const [societyId, setSocietyId] = useState<string | null>(null)

  useEffect(() => {
    const fetchSociety = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setAdminId(user.id)
      const { data: profile } = await supabase
        .from('users')
        .select('society_id')
        .eq('id', user.id)
        .single()
      setSocietyId(profile?.society_id || null)
    }
    fetchSociety()
  }, [])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const [isRecording, setIsRecording] = useState(false)
  const [isProcessingVoice, setIsProcessingVoice] = useState(false)
  const [voiceLanguage, setVoiceLanguage] = useState('hi-IN')
  const [responseLanguage, setResponseLanguage] = useState('en-IN')
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
        await processVoiceInput(blob)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Mic error:', err)
    }
  }

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsProcessingVoice(true)
    }
  }

  const processVoiceInput = async (blob: Blob) => {
    try {
      // Step 1: Sarvam STT
      const result = await transcribeAudio(blob, voiceLanguage)
      const transcript = result
      if (!transcript || typeof transcript !== 'string' || transcript.trim() === '') {
        setIsProcessingVoice(false)
        return
      }

      // Add user message immediately
      setMessages(prev => [...prev, {
        role: 'user',
        content: transcript,
        timestamp: new Date()
      }])

      setIsLoading(true)
      setIsProcessingVoice(false)

      // Step 2: Send to Aria
      const res = await fetch(`${WORKFLOW_URL}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: transcript,
          society_id: societyId,
          admin_id: adminId,
          conversation_history: conversationHistory,
          plan: mode === 'agent' ? 'growth' : 'free',
          response_language: LANGUAGE_NAMES[responseLanguage] || 'English'
        })
      })

      const data = await res.json()

      if (data.response) {
        setMessages(prev => [...prev, {
          role: 'agent',
          content: data.response,
          timestamp: new Date(),
          tool_calls: data.tool_calls_made,
          actions_taken: data.actions_taken || [],
        }])
        setConversationHistory(data.conversation_history || [])

        // Step 3: Sarvam TTS â€” speak response
        if (ttsEnabled) {
          await speakResponse(data.response)
        }
      }
    } catch (err) {
      console.error('Voice processing error:', err)
    } finally {
      setIsLoading(false)
      setIsProcessingVoice(false)
    }
  }

  const speakResponse = async (text: string) => {
    try {
      // Strip emojis and markdown for cleaner speech
      const cleanText = text
        .replace(/[ðŸš¨âš ï¸ðŸ“‹âœ…ðŸ”’ðŸ¤–]/g, '')
        .replace(/\*\*/g, '')
        .replace(/â†’ Next action:/g, 'Next action:')
        .trim()

      const finalText = cleanText.slice(0, 480)
      const audioBase64 = await textToSpeech(finalText, responseLanguage, 'anushka')
      const audio = playBase64Audio(audioBase64)
      setCurrentAudio(audio)

      audio.onended = () => setCurrentAudio(null)
    } catch (err) {
      console.error('TTS error:', err)
    }
  }

  const stopSpeaking = () => {
    if (currentAudio) {
      currentAudio.pause()
      setCurrentAudio(null)
    }
  }

  const handleMicClick = () => {
    if (isRecording) {
      stopVoiceRecording()
    } else {
      startVoiceRecording()
    }
  }


  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load morning briefing on first open
  useEffect(() => {
    if (isOpen && messages.length === 0 && societyId) {
      loadMorningBriefing()
    }
  }, [isOpen, societyId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMorningBriefing = async () => {
    setIsBriefingLoading(true)
    try {
      const res = await fetch(`${WORKFLOW_URL}/agent/briefing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          society_id: societyId,
          admin_id: adminId,
          response_language: LANGUAGE_NAMES[responseLanguage] || 'English'
        }),
      })
      const data = await res.json()
      if (data.briefing) {
        setMessages([{
          role: 'agent',
          content: data.briefing,
          timestamp: new Date(),
        }])
        if (ttsEnabled && data.briefing) {
          await speakResponse(data.briefing)
        }
      }
    } catch {
      setMessages([{
        role: 'agent',
        content: `Hi! I'm Aria, your Estate Operations Intelligence. I've checked your society data and I'm ready to help. What would you like to focus on today?`,
        timestamp: new Date(),
      }])
    } finally {
      setIsBriefingLoading(false)
    }
  }

  const sendMessage = async (overrideInput?: string) => {
    const userMessage = (overrideInput ?? input).trim()
    if (!userMessage || isLoading) return

    setInput('')

    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    }])

    setIsLoading(true)

    try {
      const res = await fetch(`${WORKFLOW_URL}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          society_id: societyId,
          admin_id: adminId,
          conversation_history: conversationHistory,
          plan: mode === 'agent' ? 'growth' : 'free',
          response_language: LANGUAGE_NAMES[responseLanguage] || 'English'
        }),
      })

      const data = await res.json()

      if (data.response) {
        setMessages(prev => [...prev, {
          role: 'agent',
          content: data.response,
          timestamp: new Date(),
          tool_calls: data.tool_calls_made,
          actions_taken: data.actions_taken || [],
        }])
        setConversationHistory(data.conversation_history || [])
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'agent',
        content: 'Sorry, I could not connect to the workflow server. Make sure it is running on port 3001.',
        timestamp: new Date(),
      }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
    setConversationHistory([])
    loadMorningBriefing()
  }

  return (
    <>
      {/* â”€â”€ Floating toggle button â”€â”€ */}
      <button
        onClick={() => setIsOpen(o => !o)}
        title="Estate Manager Agent"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: '#1C1917',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(28,25,23,0.3)',
          zIndex: 9999,
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
      >
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EDEBE6" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EDEBE6" strokeWidth="1.5">
            <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10a9.96 9.96 0 0 1-4.95-1.31L2 22l1.31-5.05A9.96 9.96 0 0 1 2 12 10 10 0 0 1 12 2z" />
            <path d="M8 10h.01M12 10h.01M16 10h.01" />
          </svg>
        )}

        {/* Amber notification dot */}
        {!isOpen && (
          <div style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: '#D97706',
            border: '2px solid #FFFFFF',
          }} />
        )}
      </button>

      {/* â”€â”€ Chat panel â”€â”€ */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          right: '24px',
          width: '380px',
          height: 'calc(100vh - 120px)',
          maxHeight: '600px',
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E0DDD9',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          zIndex: 9999,
          overflow: 'hidden',
          animation: 'ema-slideUp 0.2s ease-out',
        }}>

          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: '#1C1917',
            borderRadius: '16px 16px 0 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            {/* Row 1: Title and Controls */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <img
                src="/chatbot.png"
                alt="Aria"
                style={{
                  width: '32px',
                  height: '32px',
                  objectFit: 'cover',
                  borderRadius: '50%',
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontFamily: 'Space Grotesk',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#FFFFFF',
                  margin: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  Estate Manager Agent
                </p>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {/* TTS toggle */}
                <button
                  onClick={() => {
                    setTtsEnabled(!ttsEnabled);
                    if (ttsEnabled) stopSpeaking();
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'rgba(215,218,220,0.7)',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title={ttsEnabled ? 'Voice responses ON' : 'Voice responses OFF'}
                >
                  {ttsEnabled ? (
                    <SoundHigh width={16} height={16} strokeWidth={1.5} />
                  ) : (
                    <SoundOff width={16} height={16} strokeWidth={1.5} />
                  )}
                </button>
                <button
                  onClick={clearChat}
                  title="New conversation"
                  style={{
                    background: 'none', border: 'none',
                    color: 'rgba(215,218,220,0.6)',
                    cursor: 'pointer', fontSize: '11px',
                    fontFamily: 'Inter', padding: '4px 8px', borderRadius: '6px',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#EDEBE6' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(215,218,220,0.6)' }}
                >
                  New chat
                </button>
              </div>
            </div>

            {/* Row 2: Mode toggle */}
            <div style={{
              display: 'flex',
              gap: '4px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '3px',
              alignSelf: 'flex-start',
            }}>
              <button
                onClick={() => setMode('assistant')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontFamily: 'Space Grotesk',
                  fontWeight: '500',
                  background: mode === 'assistant' ? '#FFFFFF' : 'transparent',
                  color: mode === 'assistant' ? '#1C1917' : 'rgba(215,218,220,0.7)',
                  transition: 'all 0.15s',
                }}
              >
                Assistant
              </button>
              <button
                onClick={() => setMode('agent')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontFamily: 'Space Grotesk',
                  fontWeight: '500',
                  background: mode === 'agent' ? '#D97706' : 'transparent',
                  color: mode === 'agent' ? '#FFFFFF' : 'rgba(215,218,220,0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s',
                }}
              >
                Agent
              </button>
            </div>
          </div>

          {/* Agent mode indicator */}
          {mode === 'agent' && (
            <div style={{
              background: '#FEF3C7',
              borderBottom: '1px solid #FDE68A',
              padding: '6px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <div style={{
                width: '6px', height: '6px',
                borderRadius: '50%',
                background: '#D97706',
                animation: 'pulse 1.5s infinite',
              }} />
              <span style={{
                fontSize: '11px',
                fontFamily: 'Inter',
                color: '#92400E',
                fontWeight: '500',
              }}>
                Agent Mode Active â€” Aria can assign tasks to technicians
              </span>
            </div>
          )}

          {/* Messages area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            background: '#FAFAF9',
          }}>
            {isBriefingLoading && <TypingDots />}

            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                gap: '8px',
                alignItems: 'flex-start',
              }}>
                {/* Avatar */}
                <div style={{
                  width: '28px', height: '28px',
                  borderRadius: '50%',
                  background: msg.role === 'user' ? '#D97706' : '#1C1917',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: msg.role === 'agent' ? '11px' : undefined,
                  fontWeight: msg.role === 'user' ? 600 : undefined,
                  color: '#FFFFFF',
                  fontFamily: 'Space Grotesk',
                }}>
                  {msg.role === 'user' ? 'A' : (
                    <img
                      src="/chatbot.png"
                      alt="Aria"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: '50%',
                      }}
                    />
                  )}
                </div>

                {/* Bubble */}
                <div style={{
                  maxWidth: '80%',
                  background: msg.role === 'user' ? '#1C1917' : '#FFFFFF',
                  border: msg.role === 'user' ? 'none' : '1px solid #E0DDD9',
                  borderRadius: msg.role === 'user'
                    ? '12px 12px 4px 12px'
                    : '12px 12px 12px 4px',
                  padding: '10px 14px',
                  fontFamily: 'Inter',
                  fontSize: '13px',
                  color: msg.role === 'user' ? '#FFFFFF' : '#1C1917',
                  lineHeight: '1.6',
                }}>
                  {msg.role === 'agent' ? formatMessage(msg.content) : msg.content}

                  {/* Tool calls badge */}
                  {msg.tool_calls != null && msg.tool_calls > 0 && (
                    <p style={{
                      fontSize: '10px', color: '#9C9894',
                      margin: '6px 0 0', fontFamily: 'Inter',
                    }}>
                      âš¡ {msg.tool_calls} data {msg.tool_calls === 1 ? 'query' : 'queries'} made
                    </p>
                  )}

                  {/* Actions taken */}
                  {msg.actions_taken && msg.actions_taken.length > 0 && (
                    <div style={{
                      marginTop: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}>
                      {msg.actions_taken.map((action, j) => {
                        let label = action.tool
                        try {
                          if (action.result?.content) {
                            const parsed = JSON.parse(action.result.content)
                            if (parsed?.message) label = parsed.message
                          }
                        } catch { /* keep label as tool name */ }
                        return (
                          <div key={j} style={{
                            background: '#F0FDF4',
                            border: '1px solid #86EFAC',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            fontSize: '11px',
                            fontFamily: 'Inter',
                            color: '#15803D',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}>
                            âœ… {label}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && <TypingDots />}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions (visible when chat is fresh) */}
          {messages.length <= 1 && !isLoading && !isBriefingLoading && (
            <div style={{
              padding: '8px 16px',
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              borderTop: '1px solid #F0EDE9',
              background: '#FAFAF9',
            }}>
              {QUICK_ACTIONS.map((action, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(action)}
                  style={{
                    background: '#F5F3F0',
                    border: '1px solid #E0DDD9',
                    borderRadius: '8px',
                    padding: '5px 10px',
                    fontSize: '11px',
                    fontFamily: 'Inter',
                    color: '#6B6560',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.background = '#E0DDD9'
                    el.style.color = '#1C1917'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.background = '#F5F3F0'
                    el.style.color = '#6B6560'
                  }}
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid #E0DDD9',
            background: '#FFFFFF',
            borderRadius: '0 0 16px 16px'
          }}>
            {/* Language selector for voice */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '8px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  fontSize: '11px',
                  color: '#9C9894',
                  fontFamily: 'Inter'
                }}>
                  Voice language:
                </span>
                <select
                  value={voiceLanguage}
                  onChange={(e) => setVoiceLanguage(e.target.value)}
                  disabled={isRecording}
                  style={{
                    fontSize: '11px',
                    color: '#1C1917',
                    background: '#F5F3F0',
                    border: '1px solid #E0DDD9',
                    borderRadius: '6px',
                    padding: '3px 6px',
                    fontFamily: 'Inter',
                    cursor: 'pointer'
                  }}
                >
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginLeft: '4px'
              }}>
                <span style={{
                  fontSize: '11px',
                  color: '#9C9894',
                  fontFamily: 'Inter'
                }}>
                  Reply in:
                </span>
                <select
                  value={responseLanguage}
                  onChange={(e) => setResponseLanguage(e.target.value)}
                  style={{
                    fontSize: '11px',
                    color: '#1C1917',
                    background: '#F5F3F0',
                    border: '1px solid #E0DDD9',
                    borderRadius: '6px',
                    padding: '3px 6px',
                    fontFamily: 'Inter',
                    cursor: 'pointer'
                  }}
                >
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              {currentAudio && (
                <button
                  onClick={stopSpeaking}
                  style={{
                    fontSize: '11px',
                    color: '#DC2626',
                    background: '#FEE2E2',
                    border: '1px solid #FCA5A5',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    fontFamily: 'Inter',
                    marginLeft: 'auto'
                  }}
                >
                  â¸ Stop speaking
                </button>
              )}
            </div>

            {/* Input row */}
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-end'
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? "Listening..." : "Type or tap mic to speak..."}
                disabled={isRecording || isProcessingVoice}
                rows={1}
                style={{
                  flex: 1,
                  border: '1px solid #E0DDD9',
                  borderRadius: '10px',
                  padding: '9px 12px',
                  fontFamily: 'Inter',
                  fontSize: '13px',
                  color: '#1C1917',
                  background: isRecording ? '#FEE2E2' : '#F5F3F0',
                  resize: 'none',
                  outline: 'none',
                  lineHeight: '1.5',
                  maxHeight: '80px',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#D97706' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E0DDD9' }}
              />

              {/* Mic button */}
              <button
                onClick={handleMicClick}
                disabled={isProcessingVoice || isLoading}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: isRecording ? '#DC2626' : '#F5F3F0',
                  border: isRecording ? 'none' : '1px solid #E0DDD9',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                  animation: isRecording ? 'pulse 1.5s infinite' : 'none'
                }}
              >
                <Microphone
                  width={16} height={16}
                  strokeWidth={1.5}
                  color={isRecording ? '#FFFFFF' : '#6B6560'}
                />
              </button>

              {/* Send button */}
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading || isRecording}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: input.trim() && !isLoading ? '#1C1917' : '#E0DDD9',
                  border: 'none',
                  cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <SendDiagonal width={16} height={16}
                  strokeWidth={2}
                  color={input.trim() && !isLoading ? '#FFFFFF' : '#9C9894'} />
              </button>
            </div>

            {isProcessingVoice && (
              <p style={{
                fontSize: '11px',
                color: '#D97706',
                fontFamily: 'Inter',
                margin: '6px 0 0',
                textAlign: 'center'
              }}>
                Transcribing your voice...
              </p>
            )}
          </div>

        </div>
      )}

      <style>{`
        @keyframes ema-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        @keyframes ema-slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ema-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(220,38,38,0); }
        }
      `}</style>
    </>
  )
}
