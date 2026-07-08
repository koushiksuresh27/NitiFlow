"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { GoogleMap, useJsApiLoader, Circle, InfoWindow } from "@react-google-maps/api";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import Link from "next/link";

function interpolateColor(color1: string, color2: string, factor: number) {
  const result = color1.slice(1).match(/.{2}/g)!.map((hex, i) => {
    const c2 = parseInt(color2.slice(1).match(/.{2}/g)![i], 16);
    const c1 = parseInt(hex, 16);
    return Math.round(c1 + factor * (c2 - c1));
  });
  return `#${result.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function getPriorityColor(score: number) {
  const s = Math.min(Math.max(score, 0), 1);
  if (s < 0.5) return interpolateColor("#138808", "#FF9933", s * 2);
  return interpolateColor("#FF9933", "#CC0000", (s - 0.5) * 2);
}

const mapStyles = [
  { featureType: "all", elementType: "all", stylers: [{ saturation: -100 }, { lightness: 20 }] },
  { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "all", stylers: [{ visibility: "off" }] }
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function MPDashboard() {
  const [wards, setWards] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [selectedWardFilter, setSelectedWardFilter] = useState<string>("all");
  const [selectedMapWard, setSelectedMapWard] = useState<any | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<any | null>(null);
  
  const [isAriaOpen, setIsAriaOpen] = useState(false);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  const [mapCenter, setMapCenter] = useState({ lat: 13.03, lng: 77.54 });
  const [mapZoom, setMapZoom] = useState(12);
  const mapRef = React.useRef<any>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/wards`)
      .then((res) => res.json())
      .then((data) => setWards(data))
      .catch((err) => console.error("Wards Error:", err));
  }, []);

  useEffect(() => {
    const fetchPriorities = async () => {
      try {
        const url = selectedWardFilter === "all" 
          ? `${API_URL}/api/priorities` 
          : `${API_URL}/api/priorities/ward/${selectedWardFilter}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setPriorities(data);
        }
      } catch (err) {
        console.error("Priorities Error:", err);
      }
    };

    fetchPriorities();
    const interval = setInterval(fetchPriorities, 15000);
    return () => clearInterval(interval);
  }, [selectedWardFilter]);

  const stats = useMemo(() => {
    let complaints = 0;
    let chronic = 0;
    const coveredWards = new Set();
    
    priorities.forEach((p) => {
      if (p.ward_id) coveredWards.add(p.ward_id);
      if (p.type === "citizen_cluster") {
        complaints += p.complaint_count || 0;
        // Check if there is a chronic bonus indicating chronic status
        if (p.score_breakdown?.chronicBonus > 0) chronic += 1;
      }
    });
    
    return {
      complaints,
      chronic,
      wardsCovered: coveredWards.size
    };
  }, [priorities]);

  const handleCircleClick = (ward: any) => {
    setSelectedMapWard(ward);
    if (ward.lat && ward.lng) {
      setMapCenter({ lat: ward.lat, lng: ward.lng });
      setMapZoom(14);
    }
  };

  const getWardTopPriority = (wardId: string) => {
    return priorities.find((p) => p.ward_id === wardId);
  };

  const formatCost = (num: number) => {
    if (!num) return "₹0";
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Crore`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(2)} Lakh`;
    return `₹${num.toLocaleString()}`;
  };

  const getCategoryEmoji = (cat: string) => {
    const map: Record<string, string> = { roads: "🛣️", water_supply: "💧", schools: "🏫", health: "🏥", sanitation: "🗑️", electricity: "⚡", street_lights: "💡", other: "📌" };
    return map[cat] || "📌";
  };

  return (
    <div className="flex h-screen bg-brand-off-white overflow-hidden text-on-surface">
      {/* Sidebar */}
      <aside className="w-[260px] bg-white border-r border-surface-container-highest flex flex-col z-20 shadow-sm flex-shrink-0">
        <div className="p-6 border-b border-surface-container-highest">
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-brand-navy text-3xl">assured_workload</span>
            <span className="font-title-lg text-title-lg font-bold text-brand-navy">NitiFlow</span>
          </div>
          
          <div className="space-y-1">
            <label className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2 block">Filters</label>
            <select 
              className="w-full bg-surface-bright border border-outline-variant rounded-lg p-2 text-body-md focus:ring-brand-navy outline-none"
              value={selectedWardFilter}
              onChange={(e) => setSelectedWardFilter(e.target.value)}
            >
              <option value="all">All Wards</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link href="#" className="flex items-center gap-3 bg-brand-navy/10 text-brand-navy p-3 rounded-lg font-label-md">
            <span className="material-symbols-outlined">home</span>
            Overview
          </Link>
          <Link href="#" className="flex items-center gap-3 text-on-surface-variant hover:bg-surface-container p-3 rounded-lg font-label-md transition">
            <span className="material-symbols-outlined">format_list_bulleted</span>
            Priority Feed
          </Link>
          <Link href="#" className="flex items-center gap-3 text-on-surface-variant hover:bg-surface-container p-3 rounded-lg font-label-md transition">
            <span className="material-symbols-outlined">map</span>
            Ward Map
          </Link>
          <Link href="#" className="flex items-center gap-3 text-on-surface-variant hover:bg-surface-container p-3 rounded-lg font-label-md transition">
            <span className="material-symbols-outlined">upload_file</span>
            Import Dev Plan
          </Link>
        </nav>

        <div className="p-4 border-t border-surface-container-highest">
          <button 
            onClick={() => setIsAriaOpen(!isAriaOpen)}
            className="w-full bg-brand-saffron text-white py-3 rounded-lg font-label-md flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">smart_toy</span>
            Ask Aria
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white h-[72px] border-b border-surface-container-highest flex items-center justify-between px-6 shrink-0">
          <div>
            <h2 className="font-title-lg text-title-lg text-brand-charcoal">Good morning, MP Sharma</h2>
            <p className="text-body-md text-on-surface-variant">Here is your constituency overview.</p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden lg:flex gap-4">
              <div className="bg-surface-container px-4 py-2 rounded-lg flex items-center gap-3">
                <span className="material-symbols-outlined text-brand-navy">groups</span>
                <div>
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold leading-none">Complaints</p>
                  <p className="font-bold text-brand-charcoal leading-none mt-1">{stats.complaints}</p>
                </div>
              </div>
              <div className="bg-surface-container px-4 py-2 rounded-lg flex items-center gap-3">
                <span className="material-symbols-outlined text-brand-green">warning</span>
                <div>
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold leading-none">Chronic Issues</p>
                  <p className="font-bold text-brand-charcoal leading-none mt-1">{stats.chronic}</p>
                </div>
              </div>
              <div className="bg-surface-container px-4 py-2 rounded-lg flex items-center gap-3">
                <span className="material-symbols-outlined text-brand-saffron">location_city</span>
                <div>
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold leading-none">Wards Covered</p>
                  <p className="font-bold text-brand-charcoal leading-none mt-1">{stats.wardsCovered} / {wards.length}</p>
                </div>
              </div>
            </div>
            
            <button className="bg-brand-navy text-white px-5 py-2 rounded-lg font-label-md hover:bg-on-secondary-fixed transition flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">cloud_upload</span>
              <span className="hidden sm:inline">Import Plan</span>
            </button>
          </div>
        </header>

        {/* Dashboard Panels */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          
          {/* Left Panel - Google Maps (55%) */}
          <div className="w-full lg:w-[55%] h-1/2 lg:h-full border-b lg:border-b-0 lg:border-r border-surface-container-highest relative">
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={{ width: "100%", height: "100%" }}
                center={mapCenter}
                zoom={mapZoom}
                options={{ styles: mapStyles, disableDefaultUI: true, zoomControl: true }}
                onLoad={map => { mapRef.current = map; }}
              >
                {wards.map((ward) => {
                  if (!ward.lat || !ward.lng) return null;
                  const topPriority = getWardTopPriority(ward.id);
                  const score = topPriority ? topPriority.total_score : 0;
                  const color = getPriorityColor(score);
                  
                  return (
                    <Circle
                      key={ward.id}
                      center={{ lat: ward.lat, lng: ward.lng }}
                      radius={700}
                      options={{
                        fillColor: color,
                        fillOpacity: 0.5,
                        strokeColor: "#000080",
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        clickable: true
                      }}
                      onClick={() => handleCircleClick(ward)}
                    />
                  );
                })}
                
                {selectedMapWard && selectedMapWard.lat && (
                  <InfoWindow
                    position={{ lat: selectedMapWard.lat, lng: selectedMapWard.lng }}
                    onCloseClick={() => setSelectedMapWard(null)}
                  >
                    <div className="p-2 min-w-[150px]">
                      <h4 className="font-bold text-brand-navy mb-1">{selectedMapWard.name}</h4>
                      {(() => {
                        const tp = getWardTopPriority(selectedMapWard.id);
                        if (!tp) return <p className="text-xs text-gray-500">No active priorities.</p>;
                        return (
                          <>
                            <p className="text-xs text-gray-700 font-medium">{getCategoryEmoji(tp.category)} {tp.category}</p>
                            <div className="w-full bg-gray-200 h-1.5 mt-2 rounded-full overflow-hidden">
                              <div className="h-full bg-brand-saffron" style={{ width: `${Math.min(tp.total_score * 100, 100)}%` }}></div>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1">Score: {tp.total_score.toFixed(2)}</p>
                          </>
                        );
                      })()}
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-surface-container text-on-surface-variant">
                Loading Map...
              </div>
            )}
          </div>

          {/* Right Panel - Priority Feed (45%) */}
          <div className="w-full lg:w-[45%] h-1/2 lg:h-full bg-surface-bright overflow-y-auto custom-scrollbar">
            <div className="p-6 sticky top-0 bg-surface-bright/95 backdrop-blur-sm border-b border-surface-container-highest z-10 flex justify-between items-center">
              <div>
                <h3 className="font-headline-sm text-brand-charcoal">Priority Rankings</h3>
                {selectedWardFilter !== "all" && (
                  <span className="inline-block mt-1 bg-brand-navy/10 text-brand-navy px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                    {wards.find(w => w.id === selectedWardFilter)?.name || "Filtered"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-on-surface-variant">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Live
              </div>
            </div>
            
            <div className="p-6 pt-4">
              <LayoutGroup>
                <AnimatePresence>
                  {priorities.map((item, idx) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      key={item.id}
                      onClick={() => setSelectedPriority(item)}
                      className="bg-white p-4 rounded-xl shadow-sm border border-surface-container-highest mb-4 cursor-pointer hover:shadow-md hover:border-brand-navy/30 transition-all group"
                    >
                      <div className="flex gap-4">
                        {/* Rank */}
                        <div className="w-8 h-8 rounded-full bg-brand-navy text-white flex items-center justify-center font-bold text-sm shrink-0">
                          {idx + 1}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="font-title-lg text-brand-saffron truncate">
                              {getCategoryEmoji(item.category)} {(item.category || "").replace('_', ' ').toUpperCase()}
                            </h4>
                            <span className="text-xs font-medium text-on-surface-variant bg-surface-container px-2 py-1 rounded">
                              {item.wards?.name}
                            </span>
                          </div>
                          
                          {/* Score Bar */}
                          <div className="flex items-center gap-2 mb-3">
                            <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden border border-brand-navy/10">
                              <div 
                                className="h-full bg-brand-saffron transition-all duration-1000" 
                                style={{ width: `${Math.min(item.total_score * 100, 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-bold text-brand-navy">{item.total_score.toFixed(2)}</span>
                          </div>

                          {/* Badges & Meta */}
                          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider font-bold">
                            {item.type === "citizen_cluster" ? (
                              <>
                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[12px]">groups</span> 
                                  {item.complaint_count} Citizens
                                </span>
                                {item.score_breakdown?.chronicBonus > 0 && (
                                  <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[12px]">loop</span> 
                                    Chronic
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="bg-brand-navy/10 text-brand-navy px-2 py-0.5 rounded flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">description</span> 
                                Dev Plan Project
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  
                  {priorities.length === 0 && (
                    <div className="text-center py-12 text-on-surface-variant">
                      <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inbox</span>
                      <p>No priorities found for this ward.</p>
                    </div>
                  )}
                </AnimatePresence>
              </LayoutGroup>
            </div>
          </div>

          {/* ScorePanel Drawer (Absolute positioned within the relative container) */}
          <AnimatePresence>
            {selectedPriority && (
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="absolute top-0 right-0 w-full sm:w-[400px] h-full bg-white shadow-2xl border-l border-surface-container-highest z-30 flex flex-col"
              >
                <div className="p-5 border-b border-surface-container-highest flex justify-between items-center bg-brand-navy text-white">
                  <div>
                    <h3 className="font-title-lg font-bold">Why this ranks here</h3>
                    <p className="text-xs opacity-80">{selectedPriority.wards?.name} · {selectedPriority.category}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedPriority(null)}
                    className="p-1 hover:bg-white/20 rounded transition"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  {/* Score Breakdown */}
                  <div className="space-y-4">
                    <h4 className="font-label-md text-on-surface-variant uppercase tracking-wider mb-2">Score Components</h4>
                    
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span>Mention Volume</span>
                        <span>{(selectedPriority.score_breakdown?.mentionScore * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full"><div className="h-full bg-green-500 rounded-full" style={{ width: `${selectedPriority.score_breakdown?.mentionScore * 100}%` }}></div></div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span>Demographic Need Gap</span>
                        <span>{(selectedPriority.score_breakdown?.gapScore * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full"><div className="h-full bg-brand-saffron rounded-full" style={{ width: `${selectedPriority.score_breakdown?.gapScore * 100}%` }}></div></div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span>Severity / Urgency</span>
                        <span>{(selectedPriority.score_breakdown?.urgencyScore * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${selectedPriority.score_breakdown?.urgencyScore * 100}%` }}></div></div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span>Chronic Bonus</span>
                        <span>{selectedPriority.score_breakdown?.chronicBonus > 0 ? 'Yes (+15%)' : 'No'}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full"><div className="h-full bg-red-500 rounded-full" style={{ width: selectedPriority.score_breakdown?.chronicBonus > 0 ? '100%' : '0%' }}></div></div>
                    </div>
                  </div>
                  
                  <hr className="border-surface-container-highest" />
                  
                  {/* Ward Context */}
                  <div>
                    <h4 className="font-label-md text-on-surface-variant uppercase tracking-wider mb-3">Ward Context</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-surface-bright p-3 rounded border border-surface-container-highest">
                        <p className="text-xs text-on-surface-variant mb-1">Population</p>
                        <p className="font-bold text-brand-charcoal">{selectedPriority.wards?.population?.toLocaleString()}</p>
                      </div>
                      <div className="bg-surface-bright p-3 rounded border border-surface-container-highest">
                        <p className="text-xs text-on-surface-variant mb-1">Students</p>
                        <p className="font-bold text-brand-charcoal">{selectedPriority.wards?.students?.toLocaleString()}</p>
                      </div>
                      <div className="bg-surface-bright p-3 rounded border border-surface-container-highest">
                        <p className="text-xs text-on-surface-variant mb-1">Classrooms</p>
                        <p className="font-bold text-brand-charcoal">{selectedPriority.wards?.classrooms?.toLocaleString()}</p>
                      </div>
                      <div className="bg-surface-bright p-3 rounded border border-surface-container-highest">
                        <p className="text-xs text-on-surface-variant mb-1">Hospital Dist.</p>
                        <p className="font-bold text-brand-charcoal">{selectedPriority.wards?.hospital_distance_km} km</p>
                      </div>
                    </div>
                  </div>

                  <hr className="border-surface-container-highest" />

                  {/* Detail Context */}
                  <div>
                    {selectedPriority.type === "citizen_cluster" ? (
                      <>
                        <h4 className="font-label-md text-on-surface-variant uppercase tracking-wider mb-3">Recent Voices (Cluster)</h4>
                        <div className="space-y-3">
                          <div className="p-3 bg-brand-saffron/10 border border-brand-saffron/20 rounded-lg text-sm text-brand-charcoal italic">
                            &quot;{selectedPriority.fingerprint?.split('_').join(' ')} related complaints recorded...&quot;
                          </div>
                          <div className="p-3 bg-surface-container rounded-lg text-sm text-brand-charcoal italic">
                            &quot;Additional local grievance captured in this cluster.&quot;
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <h4 className="font-label-md text-on-surface-variant uppercase tracking-wider mb-3">Dev Plan Details</h4>
                        <div className="p-4 bg-brand-navy/5 border border-brand-navy/20 rounded-lg">
                          <p className="font-bold text-lg text-brand-navy mb-1">{formatCost(selectedPriority.estimated_cost)}</p>
                          <p className="text-sm font-medium text-brand-charcoal mb-2">{selectedPriority.project_name}</p>
                          <p className="text-xs text-on-surface-variant">{selectedPriority.description}</p>
                        </div>
                      </>
                    )}
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Mock Aria Overlay */}
      <AnimatePresence>
        {isAriaOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-[280px] w-80 bg-white rounded-xl shadow-2xl border border-surface-container-highest z-50 overflow-hidden flex flex-col"
          >
            <div className="bg-brand-navy p-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined">smart_toy</span>
                <span className="font-bold">Aria Intelligence</span>
              </div>
              <button onClick={() => setIsAriaOpen(false)} className="hover:text-gray-300">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4 h-64 bg-surface-bright flex flex-col justify-end">
              <div className="bg-white p-3 rounded-lg rounded-bl-none shadow-sm text-sm border border-surface-container mb-4">
                Hello MP Sharma. I have real-time access to the constituency data. Which ward's priorities would you like me to analyze?
              </div>
            </div>
            <div className="p-3 border-t border-surface-container-highest flex">
              <input type="text" placeholder="Ask Aria..." className="flex-1 bg-surface-container rounded-l-lg p-2 text-sm outline-none" />
              <button className="bg-brand-saffron text-white px-3 rounded-r-lg">
                <span className="material-symbols-outlined text-sm">send</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
