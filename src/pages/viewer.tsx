import React, { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Download, Maximize, Minimize, ZoomIn, ZoomOut,
  Highlighter, CheckCircle2, FileText, X, Loader2, Layers, Eye, EyeOff, Pencil, Trash2, ChevronRight
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";
import { NavBar } from "@/components/Dashboard-viewer-navbar";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200];
const BASE_PAGE_WIDTH = 760;
// Below this size (in normalized % of page width/height) a drag is treated
// as an accidental click rather than a deliberate highlight.
const MIN_HIGHLIGHT_SIZE = 1.5;

// ---------------------------------------------------------------------------
// Props — a single PDF resource, rather than a fetched list of resources.
// The caller (route/page) is responsible for knowing which resource this is
// (e.g. from a route param) and passing its identity + file down.
// ---------------------------------------------------------------------------

export interface ViewerProps {
  /** Resource id — document identity, kept for parity with the route/caller. */
  resourceId: string;
  /** Direct URL (or path) to the PDF file to render. */
  fileUrl: string;
  /** Display title, shown in the breadcrumb and used as the download filename. */
  title: string;
  /** Optional course label for the breadcrumb. */
  course?: string;
  /** Optional known page count, used before the PDF finishes loading. */
  pages?: number;
  /** Optional max marks for this document, shown next to the running total. */
  maxMarks?: number;
}

// ---------------------------------------------------------------------------
// Grading highlights — replaces the old discussion/pin threads. A highlight
// is a dragged rectangle on a page with an attached mark + feedback comment.
//
// NOTE: this is local component state only for now (no backend call), same
// as the earlier static "Questions" feature — wire up a persistence endpoint
// here if you want highlights to survive a refresh / be visible to both
// teacher and student.
// ---------------------------------------------------------------------------

interface HighlightRect {
  x: number; // % of page width
  y: number; // % of page height
  width: number; // % of page width
  height: number; // % of page height
}

interface Highlight {
  id: string;
  page: number;
  rect: HighlightRect;
  marks: number | null;
  feedback: string;
  createdAt: string;
}

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }): HighlightRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const width = Math.abs(b.x - a.x);
  const height = Math.abs(b.y - a.y);
  return { x, y, width, height };
}

export default function Viewer({ resourceId, fileUrl, title, course, pages, maxMarks }: ViewerProps) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [expandedHighlight, setExpandedHighlight] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [zoomIndex, setZoomIndex] = useState(2);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloadToast, setDownloadToast] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pageFilter, setPageFilter] = useState<"all" | "current">("all");
  const [showHighlights, setShowHighlights] = useState(true);

  // Highlight placement / editing
  const [placingHighlight, setPlacingHighlight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{ page: number; start: { x: number; y: number } } | null>(null);
  const [draftRect, setDraftRect] = useState<{ page: number; rect: HighlightRect } | null>(null);
  const [highlightDialogOpen, setHighlightDialogOpen] = useState(false);
  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null);
  const [marksInput, setMarksInput] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const totalPages = numPages ?? pages ?? 1;
  const zoomLevel = ZOOM_LEVELS[zoomIndex];
  const pageWidth = (zoomLevel / 100) * BASE_PAGE_WIDTH;

  // Reset viewer state whenever the resource identity changes.
  useEffect(() => {
    setCurrentPage(1);
    setNumPages(null);
    setPdfLoading(true);
    setExpandedHighlight(null);
    setPlacingHighlight(false);
    setPageFilter("all");
    setHighlights([]);
    pageRefs.current.clear();
  }, [resourceId, fileUrl]);

  const handleDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setPdfLoading(false);
  };

  // Track which page is most visible while scrolling, so the "Page X of Y"
  // label and "current page" filter stay accurate without explicit nav
  // buttons.
  useEffect(() => {
    if (!numPages) return;
    const root = scrollAreaRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const page = Number((visible.target as HTMLElement).dataset.page);
          if (page) setCurrentPage(page);
        }
      },
      { root, threshold: [0.25, 0.5, 0.75] }
    );

    pageRefs.current.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [numPages, pageWidth]);

  const scrollToPage = useCallback((page: number) => {
    const el = pageRefs.current.get(page);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const jumpToPage = (page: number) => {
    scrollToPage(page);
    setExpandedHighlight(null);
    if (pageFilter === "all") setPageFilter("current");
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = title;
    a.click();
    setDownloadToast(true);
    setTimeout(() => setDownloadToast(false), 3000);
  };

  const handleFullscreen = () => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // -------------------------------------------------------------------
  // Drag-to-highlight — mousedown on a page starts the drag, mousemove
  // (attached to window while dragging) updates the rect, mouseup finalizes
  // it and opens the marks/feedback dialog.
  // -------------------------------------------------------------------

  const pointFromEvent = (page: number, clientX: number, clientY: number) => {
    const el = pageRefs.current.get(page);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  const handlePageMouseDown = (page: number) => (e: React.MouseEvent) => {
    if (!placingHighlight) return;
    const start = pointFromEvent(page, e.clientX, e.clientY);
    if (!start) return;
    dragStateRef.current = { page, start };
    setIsDragging(true);
    setDraftRect({ page, rect: { x: start.x, y: start.y, width: 0, height: 0 } });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const current = pointFromEvent(drag.page, e.clientX, e.clientY);
      if (!current) return;
      setDraftRect({ page: drag.page, rect: normalizeRect(drag.start, current) });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      const drag = dragStateRef.current;
      dragStateRef.current = null;
      setPlacingHighlight(false);

      setDraftRect(current => {
        if (!current || !drag) return null;
        if (current.rect.width < MIN_HIGHLIGHT_SIZE || current.rect.height < MIN_HIGHLIGHT_SIZE) {
          return null; // too small — treat as an accidental click, discard
        }
        setMarksInput("");
        setFeedbackInput("");
        setEditingHighlightId(null);
        setHighlightDialogOpen(true);
        return current;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const openEditHighlight = (h: Highlight) => {
    setEditingHighlightId(h.id);
    setDraftRect({ page: h.page, rect: h.rect });
    setMarksInput(h.marks !== null ? String(h.marks) : "");
    setFeedbackInput(h.feedback);
    setHighlightDialogOpen(true);
  };

  const saveHighlight = () => {
    if (!draftRect) return;
    const parsedMarks = marksInput.trim() === "" ? null : Number(marksInput);
    const marks = parsedMarks !== null && Number.isFinite(parsedMarks) ? parsedMarks : null;

    if (editingHighlightId) {
      setHighlights(prev =>
        prev.map(h => (h.id === editingHighlightId ? { ...h, marks, feedback: feedbackInput.trim() } : h))
      );
    } else {
      const created: Highlight = {
        id: `h-${Date.now()}`,
        page: draftRect.page,
        rect: draftRect.rect,
        marks,
        feedback: feedbackInput.trim(),
        createdAt: new Date().toISOString(),
      };
      setHighlights(prev => [created, ...prev]);
      setExpandedHighlight(created.id);
    }

    setHighlightDialogOpen(false);
    setDraftRect(null);
    setEditingHighlightId(null);
    setMarksInput("");
    setFeedbackInput("");
  };

  const deleteHighlight = (id: string) => {
    setHighlights(prev => prev.filter(h => h.id !== id));
    if (expandedHighlight === id) setExpandedHighlight(null);
  };

  const cancelHighlightDialog = () => {
    setHighlightDialogOpen(false);
    setDraftRect(null);
    setEditingHighlightId(null);
  };

  // -------------------------------------------------------------------
  // Derived views
  // -------------------------------------------------------------------

  const sidebarHighlights = pageFilter === "current" ? highlights.filter(h => h.page === currentPage) : highlights;

  const pageGroups: Record<number, Highlight[]> = {};
  sidebarHighlights.forEach(h => {
    if (!pageGroups[h.page]) pageGroups[h.page] = [];
    pageGroups[h.page].push(h);
  });
  const sortedPages = Object.keys(pageGroups).map(Number).sort((a, b) => a - b);

  const chronological = [...highlights].reverse();
  const getHighlightNumber = (id: string) => chronological.findIndex(h => h.id === id) + 1;

  const ungradedCount = highlights.filter(h => h.marks === null).length;
  const totalAwarded = highlights.reduce((sum, h) => sum + (h.marks ?? 0), 0);

  return (
    <div ref={containerRef} className="h-screen flex flex-col bg-background overflow-hidden">
      <NavBar
        hasNotifications={ungradedCount > 0}
        notifOpen={notifOpen}
        onNotifOpenChange={setNotifOpen}
        avatarInitials="ST"
        centerContent={
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground min-w-0">
            {course && (
              <>
                <span className="text-muted-foreground">/</span>
                <span>Course</span>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground font-medium">{course}</span>
                <ChevronRight className="h-4 w-4" />
              </>
            )}
            <span className="text-foreground font-medium truncate max-w-[220px]">{title}</span>
          </div>
        }
        notificationContent={
          <>
            <div className="p-3 border-b font-semibold text-sm">Highlights needing marks</div>
            <div className="flex flex-col divide-y max-h-72 overflow-y-auto">
              {highlights.filter(h => h.marks === null).length === 0 && (
                <p className="p-3 text-xs text-muted-foreground">Everything's graded.</p>
              )}
              {highlights.filter(h => h.marks === null).slice(0, 5).map(h => (
                <button
                  key={h.id}
                  className="p-3 text-left hover:bg-muted/50 transition-colors w-full"
                  onClick={() => { setExpandedHighlight(h.id); setNotifOpen(false); setPageFilter("all"); jumpToPage(h.page); }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Highlighter className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium text-xs">Page {h.page}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{formatRelativeTime(h.createdAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{h.feedback || "No feedback added yet"}</p>
                </button>
              ))}
            </div>
          </>
        }
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Center: scrollable PDF viewer */}
        <main className="flex-1 flex flex-col relative bg-muted/20 overflow-hidden">
          <div className="flex-none h-12 flex items-center justify-between px-4 border-b bg-background/80 backdrop-blur-sm z-10">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground font-medium w-28 text-center">
                Page {currentPage} of {totalPages}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomIndex(i => Math.max(0, i - 1))} disabled={zoomIndex === 0}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground font-medium w-12 text-center">{zoomLevel}%</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomIndex(i => Math.min(ZOOM_LEVELS.length - 1, i + 1))} disabled={zoomIndex === ZOOM_LEVELS.length - 1}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 px-2">
                {showHighlights ? <Eye className="h-3.5 w-3.5 text-muted-foreground" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                <Label htmlFor="show-highlights-toggle" className="text-xs text-muted-foreground cursor-pointer select-none">
                  Highlights
                </Label>
                <Switch
                  id="show-highlights-toggle"
                  checked={showHighlights}
                  onCheckedChange={setShowHighlights}
                />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleFullscreen}>
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <AnimatePresence>
            {placingHighlight && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-primary text-primary-foreground flex items-center justify-between px-4 py-2 text-sm font-medium z-20 shrink-0"
              >
                <div className="flex items-center gap-2">
                  <Highlighter className="h-4 w-4 shrink-0" />
                  Drag a box over the part of the answer you want to grade
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-primary-foreground hover:bg-white/20" onClick={() => setPlacingHighlight(false)}>
                  <X className="h-3.5 w-3.5 mr-1" /> Cancel
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Continuous scroll area — every page renders at once, stacked. */}
          <div ref={scrollAreaRef} className="flex-1 overflow-auto p-6 flex flex-col items-center gap-6">
            {pdfLoading && (
              <div className="flex flex-col items-center gap-3 text-muted-foreground py-24">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm">Loading document...</span>
              </div>
            )}

            <Document
              file={fileUrl}
              onLoadSuccess={handleDocumentLoadSuccess}
              onLoadError={() => setPdfLoading(false)}
              loading=""
            >
              {numPages && Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => {
                const pins = highlights.filter(h => h.page === pageNum);
                const draftOnThisPage = draftRect?.page === pageNum ? draftRect.rect : null;

                return (
                  <div
                    key={pageNum}
                    data-page={pageNum}
                    ref={(el) => {
                      if (el) pageRefs.current.set(pageNum, el);
                      else pageRefs.current.delete(pageNum);
                    }}
                    className="relative shadow-2xl rounded-sm overflow-hidden mb-2"
                    style={{ width: pageWidth, maxWidth: "100%", cursor: placingHighlight ? "crosshair" : "default" }}
                    onMouseDown={handlePageMouseDown(pageNum)}
                  >
                    <Page
                      pageNumber={pageNum}
                      width={pageWidth}
                      renderAnnotationLayer={false}
                      renderTextLayer={true}
                      className="select-none"
                    />

                    {placingHighlight && (
                      <div className="absolute inset-0 z-30" style={{ background: "rgba(79,70,229,0.05)" }} />
                    )}

                    {draftOnThisPage && (
                      <div
                        className="absolute z-30 border-2 border-primary bg-primary/20 pointer-events-none"
                        style={{
                          left: `${draftOnThisPage.x}%`,
                          top: `${draftOnThisPage.y}%`,
                          width: `${draftOnThisPage.width}%`,
                          height: `${draftOnThisPage.height}%`,
                        }}
                      />
                    )}

                    {showHighlights && pins.map(h => {
                      const num = getHighlightNumber(h.id);
                      const graded = h.marks !== null;
                      return (
                        <Popover key={h.id}>
                          <PopoverTrigger asChild>
                            <button
                              className={`absolute z-20 border-2 transition-colors ${
                                graded ? "border-emerald-500 bg-emerald-500/15 hover:bg-emerald-500/25" : "border-primary bg-primary/15 hover:bg-primary/25"
                              }`}
                              style={{
                                left: `${h.rect.x}%`,
                                top: `${h.rect.y}%`,
                                width: `${h.rect.width}%`,
                                height: `${h.rect.height}%`,
                              }}
                            >
                              <span
                                className={`absolute -top-3 -left-3 w-6 h-6 rounded-full border-2 border-white text-white shadow flex items-center justify-center text-xs font-bold ${
                                  graded ? "bg-emerald-500" : "bg-primary"
                                }`}
                              >
                                {num}
                              </span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-0" align="start" side="right">
                            <div className="p-4 border-b bg-muted/30">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="font-semibold text-sm">Highlight #{num} · p. {h.page}</span>
                                <Badge variant="outline" className={graded ? "text-emerald-600 border-emerald-300 text-[10px]" : "text-primary border-primary/30 text-[10px]"}>
                                  {graded ? `${h.marks} marks` : "Ungraded"}
                                </Badge>
                              </div>
                              <p className="text-sm leading-relaxed text-muted-foreground">
                                {h.feedback || "No feedback added yet."}
                              </p>
                            </div>
                            <div className="p-2 bg-background flex justify-between items-center">
                              <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={() => deleteHighlight(h.id)}>
                                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 text-primary" onClick={() => openEditHighlight(h)}>
                                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    })}
                  </div>
                );
              })}
            </Document>
          </div>

          <Button
            className="absolute bottom-6 right-6 gap-2 shadow-xl rounded-full h-12 px-5"
            onClick={() => setPlacingHighlight(v => !v)}
            variant={placingHighlight ? "secondary" : "default"}
          >
            <Highlighter className="h-4 w-4" />
            {placingHighlight ? "Drag on a page..." : "Add Highlight"}
          </Button>

          <AnimatePresence>
            {downloadToast && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-24 right-6 bg-card border shadow-lg rounded-lg px-4 py-3 flex items-center gap-3 text-sm font-medium"
              >
                <Download className="h-4 w-4 text-primary" />
                Downloading {title}...
                <button onClick={() => setDownloadToast(false)} className="ml-1 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Right sidebar: grading highlights */}
        <aside className="w-80 flex-none border-l bg-card flex flex-col z-10">
          <div className="p-3 border-b flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Grading</h2>
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="rounded-full text-xs">
                  {totalAwarded}{maxMarks ? ` / ${maxMarks}` : ""} marks
                </Badge>
                {ungradedCount > 0 && (
                  <Badge className="rounded-full text-xs bg-primary/10 text-primary border-primary/20" variant="outline">
                    {ungradedCount} ungraded
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
              <button
                className={`flex-1 text-xs py-1 px-2 rounded transition-colors font-medium flex items-center justify-center gap-1.5 ${
                  pageFilter === "all" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setPageFilter("all")}
              >
                <Layers className="h-3 w-3" />
                All pages
              </button>
              <button
                className={`flex-1 text-xs py-1 px-2 rounded transition-colors font-medium flex items-center justify-center gap-1.5 ${
                  pageFilter === "current" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setPageFilter("current")}
              >
                <FileText className="h-3 w-3" />
                Page {currentPage}
              </button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 flex flex-col gap-3">
              {sidebarHighlights.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-10 flex flex-col items-center gap-3">
                  <Highlighter className="h-8 w-8 opacity-30" />
                  <div>
                    <p className="font-medium mb-1">
                      {pageFilter === "current" ? `No highlights on page ${currentPage}` : "No highlights yet"}
                    </p>
                    <p className="text-xs">
                      Click "Add Highlight" and drag over the answer to grade a section.
                    </p>
                  </div>
                </div>
              )}

              {pageFilter === "all"
                ? sortedPages.map(page => (
                    <div key={page} className="flex flex-col gap-2">
                      <button onClick={() => jumpToPage(page)} className="flex items-center gap-2 group">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/60 hover:bg-muted text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                          <FileText className="h-3 w-3" />
                          Page {page}
                          {page === currentPage && (
                            <span className="ml-1 text-[10px] text-primary font-medium">← current</span>
                          )}
                        </div>
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] text-muted-foreground group-hover:text-foreground">{pageGroups[page].length}</span>
                      </button>

                      {pageGroups[page].map(h => (
                        <HighlightCard
                          key={h.id}
                          highlight={h}
                          number={getHighlightNumber(h.id)}
                          expanded={expandedHighlight === h.id}
                          onToggle={() => setExpandedHighlight(expandedHighlight === h.id ? null : h.id)}
                          onEdit={() => openEditHighlight(h)}
                          onDelete={() => deleteHighlight(h.id)}
                          onJumpToPage={() => jumpToPage(h.page)}
                        />
                      ))}
                    </div>
                  ))
                : sidebarHighlights.map(h => (
                    <HighlightCard
                      key={h.id}
                      highlight={h}
                      number={getHighlightNumber(h.id)}
                      expanded={expandedHighlight === h.id}
                      onToggle={() => setExpandedHighlight(expandedHighlight === h.id ? null : h.id)}
                      onEdit={() => openEditHighlight(h)}
                      onDelete={() => deleteHighlight(h.id)}
                      onJumpToPage={() => jumpToPage(h.page)}
                    />
                  ))}
            </div>
          </ScrollArea>

          <div className="p-3 border-t">
            <Button className="w-full gap-2" variant={placingHighlight ? "secondary" : "default"} onClick={() => setPlacingHighlight(v => !v)}>
              <Highlighter className="h-4 w-4" />
              {placingHighlight ? "Cancel placement" : "Add Highlight"}
            </Button>
          </div>
        </aside>
      </div>

      <Dialog open={highlightDialogOpen} onOpenChange={(open) => { if (!open) cancelHighlightDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Highlighter className="h-4 w-4 text-primary" />
              {editingHighlightId ? "Edit highlight" : "New highlight"} — Page {draftRect?.page}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{title}</span>
              <span className="shrink-0">· p. {draftRect?.page}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="marks-input">Marks {maxMarks ? `(out of ${maxMarks})` : ""}</Label>
              <Input
                id="marks-input"
                type="number"
                min={0}
                max={maxMarks}
                placeholder="e.g. 4"
                value={marksInput}
                onChange={(e) => setMarksInput(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="feedback-input">Feedback</Label>
              <Textarea
                id="feedback-input"
                placeholder="What's right or wrong about this part of the answer?"
                className="resize-none"
                rows={3}
                value={feedbackInput}
                onChange={(e) => setFeedbackInput(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelHighlightDialog}>Cancel</Button>
            <Button onClick={saveHighlight}>
              {editingHighlightId ? "Save changes" : "Save highlight"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface HighlightCardProps {
  highlight: Highlight;
  number: number;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onJumpToPage: () => void;
}

function HighlightCard({ highlight, number, expanded, onToggle, onEdit, onDelete, onJumpToPage }: HighlightCardProps) {
  const graded = highlight.marks !== null;
  return (
    <Card
      className={`overflow-hidden transition-all duration-200 border-l-4 ${
        graded ? "border-l-emerald-500/50" : "border-l-primary"
      } ${expanded ? "ring-1 ring-primary/20 shadow-md" : "hover:border-l-primary/60"}`}
    >
      <div className="p-3 cursor-pointer flex flex-col gap-2" onClick={onToggle}>
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 ${graded ? "bg-emerald-500" : "bg-primary"}`}>
              {number}
            </span>
            <span className="text-sm font-medium">Highlight #{number}</span>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{formatRelativeTime(highlight.createdAt)}</span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">
          {highlight.feedback || "No feedback added yet."}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5 items-center">
            {graded ? (
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 flex gap-1 items-center px-1.5 py-0">
                <CheckCircle2 className="w-3 h-3" /> {highlight.marks} marks
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-primary bg-primary/5 border-primary/20 px-1.5 py-0">
                Ungraded
              </Badge>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onJumpToPage(); }}
            className="text-[10px] text-muted-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded border border-transparent hover:border-primary/20 hover:bg-primary/5"
          >
            p. {highlight.page}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t bg-muted/10"
          >
            <div className="p-3 flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit marks & feedback
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}