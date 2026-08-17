"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Type, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Trash2, 
  Eye, 
  Filter, 
  Sparkles,
  RefreshCw,
  Globe,
  Layers
} from "lucide-react";
import { ScriptCategory, FontEntry } from "@/lib/fonts/FontRegistryService";

const LANGUAGE_TABS: { id: "ALL" | ScriptCategory; label: string; flag: string }[] = [
  { id: "ALL", label: "All Traditions", flag: "🌐" },
  { id: "VIETNAMESE_THU_PHAP", label: "Vietnamese Thư Pháp", flag: "🇻🇳" },
  { id: "JAPANESE_SHODO", label: "Japanese Shodō", flag: "🇯🇵" },
  { id: "CHINESE_CALLIGRAPHY", label: "Chinese Shūfǎ", flag: "🇨🇳" },
  { id: "KOREAN_BRUSH", label: "Korean Seoye", flag: "🇰🇷" },
];

export default function AdminFontsPage() {
  const [fonts, setFonts] = useState<FontEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ALL" | ScriptCategory>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "DOWNLOADED" | "NOT_DOWNLOADED">("ALL");
  
  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchFonts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/fonts");
      const data = await res.json();
      if (data.success) {
        setFonts(data.fonts);
      } else {
        setError(data.error || "Failed to load fonts");
      }
    } catch (e: any) {
      setError(e?.message || "Network error fetching fonts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFonts();
  }, []);

  // Filtered fonts
  const filteredFonts = useMemo(() => {
    return fonts.filter((f) => {
      // Tab filter
      if (activeTab !== "ALL" && f.category !== activeTab) return false;
      // Status filter
      if (statusFilter === "DOWNLOADED" && !f.isDownloaded) return false;
      if (statusFilter === "NOT_DOWNLOADED" && f.isDownloaded) return false;
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = f.name.toLowerCase().includes(q);
        const matchDesc = f.description.toLowerCase().includes(q);
        const matchSource = f.sourceLabel.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchSource) return false;
      }
      return true;
    });
  }, [fonts, activeTab, statusFilter, searchQuery]);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredFonts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredFonts.map((f) => f.id));
    }
  };

  // Bulk download action
  const handleBulkDownload = async () => {
    if (selectedIds.length === 0) return;
    try {
      setBulkDownloading(true);
      setActionMessage(null);
      const res = await fetch("/api/admin/fonts/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fontIds: selectedIds }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ type: "success", text: data.message });
        setSelectedIds([]);
        await fetchFonts();
      } else {
        setActionMessage({ type: "error", text: data.error || "Download failed" });
      }
    } catch (e: any) {
      setActionMessage({ type: "error", text: e?.message || "Error performing bulk download" });
    } finally {
      setBulkDownloading(false);
    }
  };

  // Single download action
  const handleSingleDownload = async (fontId: string) => {
    try {
      setActionMessage(null);
      const res = await fetch("/api/admin/fonts/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fontIds: [fontId] }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ type: "success", text: data.message });
        await fetchFonts();
      } else {
        setActionMessage({ type: "error", text: data.error || "Download failed" });
      }
    } catch (e: any) {
      setActionMessage({ type: "error", text: e?.message || "Error downloading font" });
    }
  };

  // Toggle active on frontend
  const handleToggleActive = async (fontId: string, currentActive: boolean) => {
    try {
      const nextActive = !currentActive;
      const res = await fetch("/api/admin/fonts/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fontId, isActive: nextActive }),
      });
      const data = await res.json();
      if (data.success) {
        setFonts((prev) => 
          prev.map((f) => (f.id === fontId ? { ...f, isActiveOnFrontend: nextActive } : f))
        );
      }
    } catch (e) {
      console.error("Failed to toggle font active state:", e);
    }
  };

  // Delete font from disk
  const handleDeleteFont = async (fontId: string, fontName: string) => {
    if (!confirm(`Are you sure you want to remove "${fontName}" from disk?`)) return;
    try {
      const res = await fetch("/api/admin/fonts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fontId }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ type: "success", text: data.message });
        await fetchFonts();
      } else {
        setActionMessage({ type: "error", text: data.error || "Failed to remove font" });
      }
    } catch (e: any) {
      setActionMessage({ type: "error", text: e?.message || "Error removing font" });
    }
  };

  const totalCount = fonts.length;
  const downloadedCount = fonts.filter((f) => f.isDownloaded).length;
  const activeCount = fonts.filter((f) => f.isActiveOnFrontend).length;

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5E0D8] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-[#B3261E]/10 text-[#B3261E] rounded-md">
              <Type className="w-5 h-5" />
            </span>
            <h1 className="font-display-md text-2xl font-bold text-[#111111]">
              Calligraphy Font Manager & Ingestion
            </h1>
          </div>
          <p className="font-body-md text-sm text-[#66635D]">
            Manage, audit source links, and download calligraphy typefaces across Vietnamese, Japanese, Chinese, and Korean traditions.
          </p>
        </div>

        {/* Stats Pill Badges */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 bg-white border border-[#E5E0D8] rounded-lg shadow-sm text-center">
            <div className="text-xs font-label-caps text-[#66635D] uppercase">Catalog</div>
            <div className="text-lg font-bold text-[#111111]">{totalCount}</div>
          </div>
          <div className="px-3.5 py-2 bg-[#E6F4EA] border border-[#A8DAB5] rounded-lg shadow-sm text-center">
            <div className="text-xs font-label-caps text-[#137333] uppercase">Downloaded</div>
            <div className="text-lg font-bold text-[#137333]">{downloadedCount}</div>
          </div>
          <div className="px-3.5 py-2 bg-[#FCE8E6] border border-[#F5C2C7] rounded-lg shadow-sm text-center">
            <div className="text-xs font-label-caps text-[#B3261E] uppercase">Active on App</div>
            <div className="text-lg font-bold text-[#B3261E]">{activeCount}</div>
          </div>
          <button 
            onClick={fetchFonts}
            className="p-2.5 bg-white border border-[#E5E0D8] hover:bg-[#F4EFE6] rounded-lg text-[#111111] transition-colors"
            title="Refresh font status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionMessage && (
        <div className={`p-4 rounded-lg flex items-center justify-between gap-3 text-sm font-medium ${
          actionMessage.type === "success" 
            ? "bg-[#E6F4EA] text-[#137333] border border-[#A8DAB5]" 
            : "bg-[#FCE8E6] text-[#B3261E] border border-[#F5C2C7]"
        }`}>
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-xs underline opacity-80 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* Language Tradition Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#E5E0D8] pb-1">
        {LANGUAGE_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tab.id === "ALL" ? fonts.length : fonts.filter((f) => f.category === tab.id).length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 font-label-caps text-sm tracking-wide transition-all border-b-2 -mb-[2px] ${
                isActive
                  ? "border-[#B3261E] text-[#B3261E] font-bold bg-[#F4EFE6]/60 rounded-t-lg"
                  : "border-transparent text-[#66635D] hover:text-[#111111] hover:bg-white/50 rounded-t-lg"
              }`}
            >
              <span>{tab.flag}</span>
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                isActive ? "bg-[#B3261E] text-white" : "bg-[#E5E0D8] text-[#66635D]"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 border border-[#E5E0D8] rounded-xl shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search font name, license, source..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-72 px-4 py-2 border border-[#E5E0D8] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#B3261E]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-[#E5E0D8] rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#B3261E]"
          >
            <option value="ALL">All Status</option>
            <option value="DOWNLOADED">Downloaded on Disk</option>
            <option value="NOT_DOWNLOADED">Available to Download</option>
          </select>
        </div>

        {/* Master Select All Checkbox */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <label className="flex items-center gap-2 text-sm text-[#66635D] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filteredFonts.length > 0 && selectedIds.length === filteredFonts.length}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-[#E5E0D8] text-[#B3261E] focus:ring-[#B3261E]"
            />
            <span className="font-label-caps text-xs uppercase">Select All ({filteredFonts.length})</span>
          </label>
        </div>
      </div>

      {/* Sticky Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-20 bg-[#111111] text-white p-4 rounded-xl shadow-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-[#B3261E] rounded-md font-bold text-xs">
              {selectedIds.length} Selected
            </span>
            <span className="text-sm text-white/80">Bulk actions for selected calligraphy fonts:</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleBulkDownload}
              disabled={bulkDownloading}
              className="flex items-center gap-2 bg-[#B3261E] hover:bg-[#921E18] text-white px-5 py-2 rounded-lg font-label-caps text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {bulkDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{bulkDownloading ? "Downloading..." : `Download Selected (${selectedIds.length})`}</span>
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-white/60 hover:text-white underline"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Font Cards Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-[#B3261E] animate-spin" />
          <p className="font-body-md text-sm text-[#66635D]">Loading calligraphy font registry...</p>
        </div>
      ) : filteredFonts.length === 0 ? (
        <div className="py-16 text-center bg-white border border-[#E5E0D8] rounded-xl p-8">
          <Type className="w-12 h-12 text-[#A09D96] mx-auto mb-3 opacity-40" />
          <h3 className="font-headline-sm text-lg font-bold text-[#111111] mb-1">No fonts found</h3>
          <p className="text-sm text-[#66635D]">No calligraphy fonts matched your selected language tab or filter criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredFonts.map((font) => {
            const isSelected = selectedIds.includes(font.id);
            
            // Build custom SVG specimen preview
            const previewSvg = font.base64Data ? (
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="100%" height="100%">
                <defs>
                  <style>
                    @font-face {
                      font-family: '${font.name}';
                      src: url('data:font/ttf;charset=utf-8;base64,${font.base64Data}') format('truetype');
                    }
                    .preview-text {
                      font-family: '${font.name}', cursive, serif;
                      font-size: 84px;
                      fill: #0B0B0B;
                    }
                  </style>
                </defs>
                <rect width="100%" height="100%" fill="#FBF9F5"/>
                <text x="300" y="130" text-anchor="middle" dominant-baseline="central" class="preview-text">${font.previewText}</text>
              </svg>`
            ) : null;

            return (
              <div
                key={font.id}
                className={`bg-white border rounded-xl p-6 flex flex-col justify-between gap-5 transition-all shadow-sm ${
                  isSelected 
                    ? "border-[#B3261E] ring-2 ring-[#B3261E]/20" 
                    : font.isActiveOnFrontend 
                    ? "border-[#A8DAB5] hover:border-[#137333]" 
                    : "border-[#E5E0D8] hover:border-[#B3261E]/50"
                }`}
              >
                {/* Card Top: Checkbox, Name, Badges */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(font.id)}
                      className="mt-1 w-4 h-4 rounded border-[#E5E0D8] text-[#B3261E] focus:ring-[#B3261E]"
                    />
                    <div>
                      <h3 className="font-display-md text-lg font-bold text-[#111111] flex items-center gap-2">
                        {font.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-[#F4EFE6] text-[#4A4844] rounded text-[11px] font-label-caps uppercase">
                          {font.categoryLabel}
                        </span>
                        <span className="text-xs text-[#88857F]">•</span>
                        <span className="text-xs text-[#66635D]">{font.license}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="flex flex-col items-end gap-1.5">
                    {font.isDownloaded ? (
                      <span className="px-2.5 py-1 bg-[#E6F4EA] text-[#137333] border border-[#A8DAB5] rounded-full text-xs font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Downloaded
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-[#FEF7E0] text-[#B06000] border border-[#FEEFC3] rounded-full text-xs font-semibold flex items-center gap-1">
                        <Download className="w-3.5 h-3.5" /> Available
                      </span>
                    )}

                    {font.isActiveOnFrontend && (
                      <span className="px-2 py-0.5 bg-[#FCE8E6] text-[#B3261E] rounded text-[10px] font-bold uppercase tracking-wider">
                        Live on App
                      </span>
                    )}
                  </div>
                </div>

                {/* Live Specimen Preview Canvas */}
                <div className="w-full h-36 bg-[#FBF9F5] border border-[#E5E0D8] rounded-lg overflow-hidden flex items-center justify-center relative group">
                  {font.isDownloaded && previewSvg ? (
                    <img 
                      src={`data:image/svg+xml;utf8,${encodeURIComponent(previewSvg)}`}
                      alt={font.name}
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <p className="font-display-md text-xl text-[#A09D96] italic mb-1">{font.previewText}</p>
                      <span className="text-[11px] font-label-caps text-[#88857F] uppercase">Preview available upon download</span>
                    </div>
                  )}
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 text-white rounded text-[10px] font-mono backdrop-blur-sm">
                    Sample: &quot;{font.previewText}&quot;
                  </span>
                </div>

                {/* Description & Source Tracker Link */}
                <div className="text-xs text-[#66635D] leading-relaxed border-t border-[#F4EFE6] pt-3 flex flex-col gap-2">
                  <p>{font.description}</p>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[#88857F]">Source Repository:</span>
                    <a
                      href={font.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#B3261E] hover:underline flex items-center gap-1 font-medium truncate max-w-[240px]"
                    >
                      <span className="truncate">{font.sourceLabel}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="flex items-center justify-between gap-2 border-t border-[#E5E0D8] pt-4">
                  {font.isDownloaded ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(font.id, font.isActiveOnFrontend)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-label-caps uppercase tracking-wider transition-colors ${
                          font.isActiveOnFrontend
                            ? "bg-[#137333] text-white hover:bg-[#0E5826]"
                            : "bg-[#E5E0D8] text-[#4A4844] hover:bg-[#D5D0C8]"
                        }`}
                      >
                        {font.isActiveOnFrontend ? "Active on App ✓" : "Enable on App"}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSingleDownload(font.id)}
                      className="flex items-center gap-1.5 bg-[#B3261E] hover:bg-[#921E18] text-white px-4 py-2 rounded-lg text-xs font-label-caps uppercase tracking-wider transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Download (.ttf)
                    </button>
                  )}

                  {font.isDownloaded && (
                    <button
                      onClick={() => handleDeleteFont(font.id, font.name)}
                      className="text-xs text-[#88857F] hover:text-[#B3261E] p-1.5 hover:bg-[#FCE8E6] rounded transition-colors"
                      title="Uninstall / Delete font file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
