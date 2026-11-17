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
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import {
  isFontLicensedForPrint,
  type ScriptCategory,
  type FontEntry,
} from "@/lib/fonts/fontCatalog";
import { escapeXml } from "@/lib/security/xml";

type StatusFilter = "ALL" | "DOWNLOADED" | "NOT_DOWNLOADED";

interface AdminFontsResponse {
  success: boolean;
  fonts?: FontEntry[];
  error?: string;
}

interface AdminMutationResponse {
  success: boolean;
  message?: string;
  error?: string;
}

const LANGUAGE_TABS: { id: "ALL" | ScriptCategory; label: string; flag: string }[] = [
  { id: "ALL", label: "All Traditions", flag: "🌐" },
  { id: "VIETNAMESE_THU_PHAP", label: "Vietnamese Thư Pháp", flag: "🇻🇳" },
  { id: "JAPANESE_SHODO", label: "Japanese Shodō", flag: "🇯🇵" },
  { id: "CHINESE_CALLIGRAPHY", label: "Chinese Shūfǎ", flag: "🇨🇳" },
  { id: "KOREAN_BRUSH", label: "Korean Seoye", flag: "🇰🇷" },
];

function isStatusFilter(val: string): val is StatusFilter {
  return val === "ALL" || val === "DOWNLOADED" || val === "NOT_DOWNLOADED";
}

export default function AdminFontsPage() {
  const [fonts, setFonts] = useState<FontEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ALL" | ScriptCategory>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadFontsFromApi = async (): Promise<{
    fonts: FontEntry[] | null;
    error: string | null;
  }> => {
    try {
      const res = await fetch("/api/admin/fonts");
      const data = (await res.json()) as AdminFontsResponse;
      if (data.success && Array.isArray(data.fonts)) {
        return { fonts: data.fonts, error: null };
      }
      return { fonts: null, error: data.error || "Failed to load fonts" };
    } catch (err: unknown) {
      return {
        fonts: null,
        error:
          err instanceof Error ? err.message : "Network error fetching fonts",
      };
    }
  };

  const fetchFonts = async () => {
    setLoading(true);
    setError(null);
    const result = await loadFontsFromApi();
    if (result.fonts) {
      setFonts(result.fonts);
    } else if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    void loadFontsFromApi().then((result) => {
      if (cancelled) return;
      if (result.fonts) {
        setFonts(result.fonts);
        setError(null);
      } else if (result.error) {
        setError(result.error);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredFonts = useMemo(() => {
    return fonts.filter((f) => {
      if (activeTab !== "ALL" && f.category !== activeTab) return false;
      if (statusFilter === "DOWNLOADED" && !f.isDownloaded) return false;
      if (statusFilter === "NOT_DOWNLOADED" && f.isDownloaded) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = f.name.toLowerCase().includes(q);
        const matchDesc = f.description.toLowerCase().includes(q);
        const matchSource = f.sourceLabel.toLowerCase().includes(q);
        const matchLicense = f.license.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchSource && !matchLicense) {
          return false;
        }
      }
      return true;
    });
  }, [fonts, activeTab, statusFilter, searchQuery]);

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
      const data = (await res.json()) as AdminMutationResponse;
      if (data.success) {
        setActionMessage({
          type: "success",
          text: data.message || "Fonts ingested",
        });
        setSelectedIds([]);
        await fetchFonts();
      } else {
        setActionMessage({
          type: "error",
          text: data.error || "Download failed",
        });
      }
    } catch (err: unknown) {
      setActionMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Error performing bulk ingestion",
      });
    } finally {
      setBulkDownloading(false);
    }
  };

  const handleSingleDownload = async (fontId: string) => {
    try {
      setActionMessage(null);
      const res = await fetch("/api/admin/fonts/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fontIds: [fontId] }),
      });
      const data = (await res.json()) as AdminMutationResponse;
      if (data.success) {
        setActionMessage({
          type: "success",
          text: data.message || "Font ingested",
        });
        await fetchFonts();
      } else {
        setActionMessage({
          type: "error",
          text: data.error || "Download failed",
        });
      }
    } catch (err: unknown) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error downloading font",
      });
    }
  };

  const handleToggleActive = async (fontId: string, currentActive: boolean) => {
    try {
      const nextActive = !currentActive;
      const res = await fetch("/api/admin/fonts/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fontId, isActive: nextActive }),
      });
      const data = (await res.json()) as AdminMutationResponse;
      if (data.success) {
        setFonts((prev) =>
          prev.map((f) =>
            f.id === fontId ? { ...f, isActiveOnFrontend: nextActive } : f
          )
        );
      } else {
        setActionMessage({
          type: "error",
          text: data.error || "Font activation rejected by licensing gate",
        });
      }
    } catch (err: unknown) {
      setActionMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to toggle font active state",
      });
    }
  };

  const handleDeactivateFont = async (fontId: string, fontName: string) => {
    if (!confirm(`Deactivate "${fontName}" in the font registry?`)) return;
    try {
      const res = await fetch("/api/admin/fonts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fontId }),
      });
      const data = (await res.json()) as AdminMutationResponse;
      if (data.success) {
        setActionMessage({
          type: "success",
          text: data.message || "Font deactivated",
        });
        await fetchFonts();
      } else {
        setActionMessage({
          type: "error",
          text: data.error || "Failed to deactivate font",
        });
      }
    } catch (err: unknown) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error deactivating font",
      });
    }
  };

  const totalCount = fonts.length;
  const downloadedCount = fonts.filter((f) => f.isDownloaded).length;
  const activeCount = fonts.filter((f) => f.isActiveOnFrontend).length;

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-variant pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-surface-container text-secondary rounded">
              <Type className="w-5 h-5" />
            </span>
            <h1 className="font-headline-sm text-headline-sm text-primary">
              Calligraphy Font Manager &amp; Licensing Gate
            </h1>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Manage, audit commercial print licenses (TB-CALLI-008), and activate verified calligraphy typefaces across Vietnamese, Japanese, Chinese, and Korean traditions.
          </p>
        </div>

        {/* Stats Pill Badges */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 bg-surface-container-lowest border border-surface-variant rounded-lg text-center">
            <div className="font-label-caps text-label-caps text-on-surface-variant uppercase">
              Catalog
            </div>
            <div className="font-headline-sm text-headline-sm text-primary">
              {totalCount}
            </div>
          </div>
          <div className="px-3.5 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-center">
            <div className="font-label-caps text-label-caps text-on-surface-variant uppercase">
              Available
            </div>
            <div className="font-headline-sm text-headline-sm text-primary">
              {downloadedCount}
            </div>
          </div>
          <div className="px-3.5 py-2 bg-surface-container-lowest border border-secondary rounded-lg text-center">
            <div className="font-label-caps text-label-caps text-secondary uppercase">
              Active on App
            </div>
            <div className="font-headline-sm text-headline-sm text-secondary">
              {activeCount}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void fetchFonts()}
            className="p-2.5 bg-surface-container-lowest border border-surface-variant hover:bg-surface-container-high rounded-lg text-primary transition-colors"
            title="Refresh font status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error / Action Notification Alert */}
      {error && (
        <div className="p-4 rounded-lg flex items-center justify-between gap-3 bg-error-container text-on-error-container border border-error">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-body-md text-body-md">{error}</span>
          </div>
        </div>
      )}

      {actionMessage && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between gap-3 ${
            actionMessage.type === "success"
              ? "bg-surface-container-low text-primary border border-outline-variant"
              : "bg-error-container text-on-error-container border border-error"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-body-md text-body-md">
              {actionMessage.text}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="font-label-caps text-label-caps uppercase underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Language Tradition Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-surface-variant pb-1">
        {LANGUAGE_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count =
            tab.id === "ALL"
              ? fonts.length
              : fonts.filter((f) => f.category === tab.id).length;
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 font-label-caps text-label-caps uppercase transition-all border-b-2 -mb-[2px] rounded-t-lg ${
                isActive
                  ? "border-secondary text-secondary bg-surface-container-low"
                  : "border-transparent text-on-surface-variant hover:text-primary hover:bg-surface-container-lowest"
              }`}
            >
              <span>{tab.flag}</span>
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full font-label-caps text-label-caps ${
                  isActive
                    ? "bg-secondary text-on-secondary"
                    : "bg-surface-container-highest text-on-surface-variant"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface-container-lowest p-4 border border-surface-variant rounded-lg">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search font name, license, source..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-72 px-4 py-2 bg-surface-container border border-outline-variant rounded text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              if (isStatusFilter(e.target.value)) {
                setStatusFilter(e.target.value);
              }
            }}
            className="px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary"
          >
            <option value="ALL">All Status</option>
            <option value="DOWNLOADED">Bundled / Ready</option>
            <option value="NOT_DOWNLOADED">Available to Ingest</option>
          </select>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <label className="flex items-center gap-2 text-on-surface-variant cursor-pointer select-none">
            <input
              type="checkbox"
              checked={
                filteredFonts.length > 0 &&
                selectedIds.length === filteredFonts.length
              }
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-outline-variant text-secondary"
            />
            <span className="font-label-caps text-label-caps uppercase">
              Select All ({filteredFonts.length})
            </span>
          </label>
        </div>
      </div>

      {/* Sticky Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-20 bg-primary text-on-primary p-4 rounded-lg border border-outline flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-secondary text-on-secondary rounded font-label-caps text-label-caps uppercase">
              {selectedIds.length} Selected
            </span>
            <span className="font-body-md text-body-md">
              Bulk actions for selected calligraphy fonts:
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleBulkDownload()}
              disabled={bulkDownloading}
              className="flex items-center gap-2 bg-secondary hover:bg-secondary-container text-on-secondary px-5 py-2 rounded font-label-caps text-label-caps uppercase transition-colors disabled:opacity-50"
            >
              {bulkDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>
                {bulkDownloading
                  ? "Ingesting..."
                  : `Ingest Selected (${selectedIds.length})`}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="font-label-caps text-label-caps uppercase underline"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Font Cards Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-secondary animate-spin" />
          <p className="font-body-md text-body-md text-on-surface-variant">
            Loading calligraphy font registry...
          </p>
        </div>
      ) : filteredFonts.length === 0 ? (
        <div className="py-16 text-center bg-surface-container-lowest border border-surface-variant rounded-lg p-8">
          <Type className="w-12 h-12 text-on-surface-variant mx-auto mb-3 opacity-40" />
          <h3 className="font-headline-sm text-headline-sm text-primary mb-1">
            No fonts found
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant">
            No calligraphy fonts matched your selected language tab or filter criteria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
          {filteredFonts.map((font) => {
            const isSelected = selectedIds.includes(font.id);
            const licensedForPrint = isFontLicensedForPrint(font);
            const safeFamily = escapeXml(font.familyName || font.name);
            const safePreview = escapeXml(font.previewText);

            const previewSvg = font.base64Data
              ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="100%" height="100%">
                  <defs>
                    <style>
                      @font-face {
                        font-family: '${safeFamily}';
                        src: url('data:font/ttf;charset=utf-8;base64,${font.base64Data}') format('truetype');
                      }
                      .preview-text {
                        font-family: '${safeFamily}', cursive, serif;
                        font-size: 84px;
                        fill: #0B0B0B;
                      }
                    </style>
                  </defs>
                  <rect width="100%" height="100%" fill="#fbf9f4"/>
                  <text x="300" y="130" text-anchor="middle" dominant-baseline="central" class="preview-text">${safePreview}</text>
                </svg>`
              : null;

            return (
              <div
                key={font.id}
                className={`bg-surface-container-lowest border rounded-lg p-6 flex flex-col justify-between gap-5 transition-colors ${
                  isSelected
                    ? "border-secondary bg-surface-container-low"
                    : font.isActiveOnFrontend
                      ? "border-primary"
                      : "border-surface-variant hover:border-outline"
                }`}
              >
                {/* Card Top: Checkbox, Name, Badges */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(font.id)}
                      className="mt-1 w-4 h-4 rounded border-outline-variant text-secondary"
                    />
                    <div>
                      <h3 className="font-headline-sm text-headline-sm text-primary">
                        {font.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant rounded font-label-caps text-label-caps uppercase">
                          {font.categoryLabel}
                        </span>
                        <span className="font-body-md text-body-md text-on-surface-variant">
                          {font.license}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status & Licensing Badges */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {licensedForPrint ? (
                      <span className="px-2.5 py-1 bg-surface-container-low text-primary border border-outline-variant rounded-full font-label-caps text-label-caps uppercase flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Print Verified
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-error-container text-on-error-container border border-error rounded-full font-label-caps text-label-caps uppercase flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" /> Print Blocked
                      </span>
                    )}

                    {font.isActiveOnFrontend && (
                      <span className="px-2 py-0.5 bg-secondary text-on-secondary rounded font-label-caps text-label-caps uppercase">
                        Live on App
                      </span>
                    )}
                  </div>
                </div>

                {/* Live Specimen Preview Canvas */}
                <div className="w-full h-36 bg-background border border-surface-variant rounded-lg overflow-hidden flex items-center justify-center relative">
                  {font.isDownloaded && previewSvg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:image/svg+xml;utf8,${encodeURIComponent(previewSvg)}`}
                      alt={font.name}
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <p className="font-headline-md text-headline-md text-on-surface-variant mb-1">
                        {font.previewText}
                      </p>
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                        {font.isWebFont
                          ? "Web Preview Typekit Only"
                          : "Preview available upon ingestion"}
                      </span>
                    </div>
                  )}
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-inverse-surface text-inverse-on-surface rounded font-label-caps text-label-caps">
                    Sample: &quot;{font.previewText}&quot;
                  </span>
                </div>

                {/* Description & Source Tracker Link */}
                <div className="border-t border-surface-variant pt-3 flex flex-col gap-2">
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    {font.description}
                  </p>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                      Source:
                    </span>
                    {font.sourceUrl.startsWith("http") ? (
                      <a
                        href={font.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-secondary hover:underline flex items-center gap-1 font-body-md text-body-md truncate max-w-[240px]"
                      >
                        <span className="truncate">{font.sourceLabel}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="font-body-md text-body-md text-on-surface-variant">
                        {font.sourceLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="flex items-center justify-between gap-2 border-t border-surface-variant pt-4">
                  {font.isDownloaded ? (
                    <button
                      type="button"
                      disabled={!licensedForPrint && !font.isActiveOnFrontend}
                      onClick={() =>
                        void handleToggleActive(font.id, font.isActiveOnFrontend)
                      }
                      className={`px-3.5 py-2 rounded font-label-caps text-label-caps uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        font.isActiveOnFrontend
                          ? "bg-primary text-on-primary hover:bg-tertiary-container"
                          : "bg-surface-container-highest text-primary hover:bg-surface-container-high"
                      }`}
                    >
                      {font.isActiveOnFrontend
                        ? "Active on App ✓"
                        : licensedForPrint
                          ? "Enable on App"
                          : "Blocked by License"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!licensedForPrint}
                      onClick={() => void handleSingleDownload(font.id)}
                      className="flex items-center gap-1.5 bg-secondary hover:bg-secondary-container text-on-secondary px-4 py-2 rounded font-label-caps text-label-caps uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Download className="w-3.5 h-3.5" /> Ingest (.ttf)
                    </button>
                  )}

                  {font.isActiveOnFrontend && (
                    <button
                      type="button"
                      onClick={() => void handleDeactivateFont(font.id, font.name)}
                      className="text-on-surface-variant hover:text-error p-1.5 hover:bg-error-container rounded transition-colors"
                      title="Deactivate font"
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
