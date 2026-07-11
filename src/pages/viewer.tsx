import React, { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Download, Maximize, Minimize, ZoomIn, ZoomOut,
  ChevronLeft, ChevronRight, MessageSquare, Send, CheckCircle2, Circle,
  FileText, X, MapPin, Loader2, Layers, AlertTriangle, Eye, EyeOff
} from "lucide-react";
import type { Discussion, Reply, PinPosition } from "@/lib/mock-data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";
import { NavBar } from "@/components/Dashboard-viewer-navbar";
import { authFetch } from "@/lib/auth-context";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200];
const BASE_PAGE_WIDTH = 760;

// ---------------------------------------------------------------------------
// Resource types
// ---------------------------------------------------------------------------

interface ResourceRecord {
  _id: string;
  title: string;
  course: { _id: string; title: string } | string;
  uploadedBy: { _id: string; user_name: string; profile_pic?: string } | string;
  fileUrl: string;
  fileSize: number;
  pages?: number;
  createdAt?: string;
}

interface ResourceView {
  id: string;
  title: string;
  course: string;
  uploadDate: string;
  pages?: number;
  file: string;
}

function toResourceView(record: ResourceRecord): ResourceView {
  let courseTitle = "Untitled course";
  if (typeof record.course === "string") {
    courseTitle = record.course;
  } else if (record.course && typeof record.course === "object" && "title" in record.course) {
    courseTitle = (record.course as { title?: string }).title || "Untitled course";
  }

  const uploadDate = record.createdAt
    ? new Date(record.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Unknown date";

  return {
    id: record._id,
    title: record.title ?? "Untitled",
    course: courseTitle,
    uploadDate,
    pages: record.pages,
    file: record.fileUrl,
  };
}

function extractResourceArray(payload: unknown): ResourceRecord[] {
  if (Array.isArray(payload)) return payload as ResourceRecord[];

  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as ResourceRecord[];
    if (obj.data && typeof obj.data === "object") {
      const inner = obj.data as Record<string, unknown>;
      if (Array.isArray(inner.resources)) return inner.resources as ResourceRecord[];
    }
    if (Array.isArray(obj.resources)) return obj.resources as ResourceRecord[];
  }

  throw new Error("Unrecognized response shape for resources");
}

// ---------------------------------------------------------------------------
// Discussion types
//
// Mirrors what the Discussion mongoose model + controllers actually return.
// `user`/`replies[].user` come back populated with { _id, user_name, profile_pic }
// on GET/POST-thread/POST-reply, but the PATCH endpoints (status, edit) return
// the raw unpopulated document — see the merge logic in markResolved below.
// ---------------------------------------------------------------------------

interface DiscussionUserRecord {
  _id: string;
  user_name: string;
  profile_pic?: string;
}

interface ReplyRecord {
  _id?: string;
  user: DiscussionUserRecord | string;
  message: string;
  createdAt?: string;
}

interface DiscussionRecord {
  _id: string;
  resource: string;
  user: DiscussionUserRecord | string;
  question: string;
  page: number;
  position?: PinPosition;
  status: "Open" | "Resolved";
  replies: ReplyRecord[];
  createdAt?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function toDiscussionUser(user: DiscussionUserRecord | string | undefined): { name: string; avatar: string } {
  if (user && typeof user === "object" && "user_name" in user) {
    return { name: user.user_name, avatar: getInitials(user.user_name) };
  }
  return { name: "Unknown user", avatar: "?" };
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

function toReplyView(record: ReplyRecord): Reply {
  return {
    user: toDiscussionUser(record.user),
    message: record.message,
    time: formatRelativeTime(record.createdAt),
  };
}

function toDiscussionView(record: DiscussionRecord, courseTitle: string): Discussion {
  return {
    id: record._id,
    resourceId: record.resource,
    user: toDiscussionUser(record.user),
    course: courseTitle,
    question: record.question,
    page: record.page,
    time: formatRelativeTime(record.createdAt),
    status: record.status,
    replies: (record.replies ?? []).map(toReplyView),
    position: record.position,
  };
}

function extractDiscussionArray(payload: unknown): DiscussionRecord[] {
  if (payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).data)) {
    return (payload as Record<string, unknown>).data as DiscussionRecord[];
  }
  return [];
}

export default function Viewer() {
  const [resources, setResources] = useState<ResourceView[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState<boolean>(true);
  const [resourcesError, setResourcesError] = useState<string | null>(null);

  const [activeDocument, setActiveDocument] = useState<string>("");
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});

  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [discussionsLoading, setDiscussionsLoading] = useState(false);
  const [discussionsError, setDiscussionsError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [zoomIndex, setZoomIndex] = useState(2);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloadToast, setDownloadToast] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pageFilter, setPageFilter] = useState<"all" | "current">("all");
  const [showPins, setShowPins] = useState(true);

  const [placingPin, setPlacingPin] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<PinPosition | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [discussionDialogOpen, setDiscussionDialogOpen] = useState(false);
  const [submittingDiscussion, setSubmittingDiscussion] = useState(false);
  const [discussionSubmitError, setDiscussionSubmitError] = useState<string | null>(null);
  const [replySubmittingId, setReplySubmittingId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const docAreaRef = useRef<HTMLDivElement>(null);

  // GET /api/courses/resources/all
  useEffect(() => {
    let cancelled = false;

    const getResources = async () => {
      setResourcesLoading(true);
      setResourcesError(null);

      try {
        const res = await authFetch("/courses/resources/all", { method: "GET" });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message ?? `Request failed with status ${res.status}`);
        }

        const payload = await res.json();
        const records = extractResourceArray(payload);
        const mapped = records.map(toResourceView);

        if (cancelled) return;
        setResources(mapped);
        if (mapped.length > 0) setActiveDocument(mapped[0].id);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load resources:", err);
        setResourcesError(err instanceof Error ? err.message : "Failed to load resources");
      } finally {
        if (!cancelled) setResourcesLoading(false);
      }
    };

    getResources();

    return () => {
      cancelled = true;
    };
  }, []);

  // GET /api/discussions?resource=<activeDocument> — refetch whenever the
  // open resource changes.
  useEffect(() => {
    if (!activeDocument) {
      setDiscussions([]);
      return;
    }

    let cancelled = false;

    const getDiscussionsForResource = async () => {
      setDiscussionsLoading(true);
      setDiscussionsError(null);

      try {
        const res = await authFetch(`/discussions?resource=${activeDocument}`, { method: "GET" });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message ?? `Request failed with status ${res.status}`);
        }

        const payload = await res.json();
        const records = extractDiscussionArray(payload);
        const courseTitle = resources.find(r => r.id === activeDocument)?.course ?? "";
        const mapped = records.map(r => toDiscussionView(r, courseTitle));

        if (cancelled) return;
        setDiscussions(mapped);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load discussions:", err);
        setDiscussionsError(err instanceof Error ? err.message : "Failed to load discussions");
        setDiscussions([]);
      } finally {
        if (!cancelled) setDiscussionsLoading(false);
      }
    };

    getDiscussionsForResource();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocument]);

  const selectedFile = resources.find(r => r.id === activeDocument);
  const totalPages = numPages ?? selectedFile?.pages ?? 1;
  const zoomLevel = ZOOM_LEVELS[zoomIndex];
  const pageWidth = (zoomLevel / 100) * BASE_PAGE_WIDTH;

  // discussions is already scoped to activeDocument by the API query param
  const resourceDiscussions = discussions;

  const sidebarDiscussions =
    pageFilter === "current"
      ? resourceDiscussions.filter(d => d.page === currentPage)
      : resourceDiscussions;

  const currentPagePins = resourceDiscussions.filter(d => d.page === currentPage && d.position);

  // resourceDiscussions is newest-first (server sorts by createdAt: -1, and
  // new local discussions are prepended) — reverse it so pin #1 is always the
  // first discussion ever pinned, and numbers only climb as more are added,
  // instead of shuffling around on every new post.
  const allResourcePins = resourceDiscussions.filter(d => d.position);
  const chronologicalPins = [...allResourcePins].reverse();
  const getPinNumber = (id: string) => chronologicalPins.findIndex(d => d.id === id) + 1;

  const pageGroups: Record<number, Discussion[]> = {};
  sidebarDiscussions.forEach(d => {
    if (!pageGroups[d.page]) pageGroups[d.page] = [];
    pageGroups[d.page].push(d);
  });
  const sortedPages = Object.keys(pageGroups).map(Number).sort((a, b) => a - b);

  const handleDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setPdfLoading(false);
  };

  const switchDocument = (id: string) => {
    setActiveDocument(id);
    setCurrentPage(1);
    setNumPages(null);
    setPdfLoading(true);
    setExpandedThread(null);
    setPlacingPin(false);
    setPageFilter("all");
  };

  const goToPage = (delta: number) => {
    setCurrentPage(p => Math.max(1, Math.min(totalPages, p + delta)));
    setExpandedThread(null);
  };

  const jumpToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(totalPages, page)));
    setExpandedThread(null);
    if (pageFilter === "all") setPageFilter("current");
  };

  const handleDownload = () => {
    if (!selectedFile) return;
    const a = document.createElement("a");
    a.href = selectedFile.file;
    a.download = selectedFile.title;
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

  const handleDocClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!placingPin || !docAreaRef.current) return;
    const rect = docAreaRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPosition({ x, y });
    setPlacingPin(false);
    setDiscussionDialogOpen(true);
  };

  // POST /api/discussions
  const submitDiscussion = async () => {
    if (!newQuestion.trim() || !selectedFile) return;

    setSubmittingDiscussion(true);
    setDiscussionSubmitError(null);

    try {
      const res = await authFetch("/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: activeDocument,
          question: newQuestion.trim(),
          page: currentPage,
          position: pendingPosition ?? undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Request failed with status ${res.status}`);
      }

      const payload = await res.json();
      const created = toDiscussionView(payload.data, selectedFile.course);

      setDiscussions(prev => [created, ...prev]);
      setNewQuestion("");
      setPendingPosition(null);
      setDiscussionDialogOpen(false);
      setExpandedThread(created.id);
      setPageFilter("current");
    } catch (err) {
      console.error("Failed to create discussion:", err);
      setDiscussionSubmitError(err instanceof Error ? err.message : "Failed to post discussion");
    } finally {
      setSubmittingDiscussion(false);
    }
  };

  // POST /api/discussions/:id/replies
  // NOTE: addReply only populates replies.user server-side, not the thread's
  // top-level user — so we merge just the replies array in rather than
  // replacing the whole discussion object.
  const sendReply = async (discussionId: string) => {
    const text = replyTexts[discussionId]?.trim();
    if (!text) return;

    setReplySubmittingId(discussionId);

    try {
      const res = await authFetch(`/discussions/${discussionId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Request failed with status ${res.status}`);
      }

      const payload = await res.json();
      const updatedReplies = (payload.data.replies ?? []).map(toReplyView);

      setDiscussions(prev =>
        prev.map(d => (d.id === discussionId ? { ...d, replies: updatedReplies } : d))
      );
      setReplyTexts(prev => ({ ...prev, [discussionId]: "" }));
    } catch (err) {
      console.error("Failed to add reply:", err);
    } finally {
      setReplySubmittingId(null);
    }
  };

  // PATCH /api/discussions/:id/status
  // Optimistic toggle with rollback on failure — the endpoint doesn't
  // repopulate user/replies.user, so there's nothing useful to merge back in
  // besides the status itself.
  const markResolved = async (discussionId: string) => {
    setDiscussions(prev =>
      prev.map(d => (d.id === discussionId ? { ...d, status: d.status === "Open" ? "Resolved" : "Open" } : d))
    );

    try {
      const res = await authFetch(`/discussions/${discussionId}/status`, { method: "PATCH" });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Request failed with status ${res.status}`);
      }
    } catch (err) {
      console.error("Failed to toggle discussion status:", err);
      setDiscussions(prev =>
        prev.map(d => (d.id === discussionId ? { ...d, status: d.status === "Open" ? "Resolved" : "Open" } : d))
      );
    }
  };

  const openCount = resourceDiscussions.filter(d => d.status === "Open").length;

  if (resourcesLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm">Loading resources...</span>
      </div>
    );
  }

  if (resourcesError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground bg-background px-4 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <span className="text-sm">{resourcesError}</span>
      </div>
    );
  }

  if (!selectedFile) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground bg-background px-4 text-center">
        <FileText className="h-8 w-8 opacity-40" />
        <span className="text-sm">No resources have been uploaded yet.</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-screen flex flex-col bg-background overflow-hidden">
      <NavBar
        
        hasNotifications={openCount > 0}
        notifOpen={notifOpen}
        onNotifOpenChange={setNotifOpen}
        avatarInitials="ST"
        centerContent={
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground min-w-0">
            <span className="text-muted-foreground">/</span>
            <span>Course</span>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">{selectedFile.course}</span>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium truncate max-w-[180px]">{selectedFile.title}</span>
          </div>
        }
        notificationContent={
          <>
            <div className="p-3 border-b font-semibold text-sm">Notifications</div>
            <div className="flex flex-col divide-y max-h-72 overflow-y-auto">
              {resourceDiscussions.slice(0, 5).map(d => (
                <button
                  key={d.id}
                  className="p-3 text-left hover:bg-muted/50 transition-colors w-full"
                  onClick={() => { setExpandedThread(d.id); setNotifOpen(false); setPageFilter("all"); }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{d.user.avatar}</AvatarFallback></Avatar>
                    <span className="font-medium text-xs">{d.user.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{d.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{d.question}</p>
                </button>
              ))}
            </div>
          </>
        }
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar: resources */}
        <aside className="hidden md:flex w-60 flex-col border-r bg-card/50">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-sm">Course Resources</h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 flex flex-col gap-0.5">
              {resources.map((resource) => (
                <button
                  key={resource.id}
                  onClick={() => switchDocument(resource.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-md flex items-start gap-3 transition-colors ${
                    activeDocument === resource.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <FileText className={`h-4 w-4 shrink-0 mt-0.5 ${activeDocument === resource.id ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="flex flex-col flex-1 truncate gap-0.5">
                    <span className="truncate text-xs leading-relaxed">{resource.title}</span>
                    <span className="text-[10px] text-muted-foreground">{resource.uploadDate}</span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* Center: PDF viewer */}
        <main className="flex-1 flex flex-col relative bg-muted/20 overflow-hidden">
          <div className="flex-none h-12 flex items-center justify-between px-4 border-b bg-background/80 backdrop-blur-sm z-10">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goToPage(-1)} disabled={currentPage <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground font-medium w-28 text-center">
                Page {currentPage} of {totalPages}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goToPage(1)} disabled={currentPage >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
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
  {showPins ? <Eye className="h-3.5 w-3.5 text-muted-foreground" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
  <Label htmlFor="show-pins-toggle" className="text-xs text-muted-foreground cursor-pointer select-none">
    Pins
  </Label>
  <Switch
    id="show-pins-toggle"
    checked={showPins}
    onCheckedChange={setShowPins}
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
            {placingPin && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-primary text-primary-foreground flex items-center justify-between px-4 py-2 text-sm font-medium z-20 shrink-0"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0" />
                  Click anywhere on page {currentPage} to place your pin
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-primary-foreground hover:bg-white/20" onClick={() => setPlacingPin(false)}>
                  <X className="h-3.5 w-3.5 mr-1" /> Cancel
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-auto p-6 flex justify-center items-start">
            <div
              ref={docAreaRef}
              className="relative"
              style={{ width: pageWidth, maxWidth: "100%" }}
              onClick={handleDocClick}
            >
              {pdfLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-card z-10 rounded-sm shadow-lg" style={{ minHeight: 960 }}>
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm">Loading document...</span>
                  </div>
                </div>
              )}
              <Document
                file={selectedFile.file}
                onLoadSuccess={handleDocumentLoadSuccess}
                onLoadError={() => setPdfLoading(false)}
                className="shadow-2xl rounded-sm overflow-hidden"
                loading=""
              >
                <Page
                  pageNumber={currentPage}
                  width={pageWidth}
                  renderAnnotationLayer={false}
                  renderTextLayer={true}
                  className="select-none"
                />
              </Document>

              {placingPin && (
                <div
                  className="absolute inset-0 z-30 cursor-crosshair rounded-sm"
                  style={{ background: "rgba(79,70,229,0.07)" }}
                />
              )}

              {showPins && currentPagePins.map((disc) => {
                if (!disc.position) return null;
                const num = getPinNumber(disc.id);
                return (
                  <Popover key={disc.id}>
                    <PopoverTrigger asChild>
                      <button
                        className={`absolute w-8 h-8 rounded-full border-2 border-white text-white shadow-lg flex items-center justify-center text-sm font-bold transition-transform hover:scale-110 z-20 ${
                          disc.status === "Open" ? "bg-primary" : "bg-emerald-500"
                        }`}
                        style={{
                          left: `calc(${disc.position.x}% - 16px)`,
                          top: `calc(${disc.position.y}% - 16px)`,
                        }}
                      >
                        {num}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start" side="right">
                      <div className="p-4 border-b flex items-start gap-3 bg-muted/30">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{disc.user.avatar}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-sm">{disc.user.name}</span>
                            <span className="text-xs text-muted-foreground">{disc.time}</span>
                          </div>
                          <p className="text-sm leading-relaxed">{disc.question}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">p. {disc.page}</Badge>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${disc.status === "Open" ? "text-primary border-primary/30" : "text-emerald-600 border-emerald-300"}`}>
                              {disc.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="p-2 bg-background flex justify-between items-center">
                        <span className="text-xs text-muted-foreground pl-2">{disc.replies.length} {disc.replies.length === 1 ? "reply" : "replies"}</span>
                        <Button variant="ghost" size="sm" onClick={() => { setExpandedThread(disc.id); setPageFilter("all"); }} className="text-primary h-8">
                          View thread
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              })}
            </div>
          </div>

          <Button
            className="absolute bottom-6 right-6 gap-2 shadow-xl rounded-full h-12 px-5"
            onClick={() => setPlacingPin(true)}
            disabled={placingPin}
          >
            <MapPin className="h-4 w-4" />
            {placingPin ? "Click to place pin..." : "New Discussion"}
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
                Downloading {selectedFile.title}...
                <button onClick={() => setDownloadToast(false)} className="ml-1 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Right sidebar: discussions */}
        <aside className="w-80 flex-none border-l bg-card flex flex-col z-10">
          <div className="p-3 border-b flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Discussions</h2>
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="rounded-full text-xs">{resourceDiscussions.length} total</Badge>
                {openCount > 0 && (
                  <Badge className="rounded-full text-xs bg-primary/10 text-primary border-primary/20" variant="outline">
                    {openCount} open
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
              {discussionsLoading && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-10">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading discussions...
                </div>
              )}

              {!discussionsLoading && discussionsError && (
                <div className="text-center text-muted-foreground text-sm py-10 flex flex-col items-center gap-2">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                  <p>{discussionsError}</p>
                </div>
              )}

              {!discussionsLoading && !discussionsError && sidebarDiscussions.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-10 flex flex-col items-center gap-3">
                  <MessageSquare className="h-8 w-8 opacity-30" />
                  <div>
                    <p className="font-medium mb-1">
                      {pageFilter === "current" ? `No discussions on page ${currentPage}` : "No discussions yet"}
                    </p>
                    <p className="text-xs">
                      {pageFilter === "current"
                        ? "Click \"New Discussion\" and place a pin on this page."
                        : "Be the first to start one!"}
                    </p>
                  </div>
                </div>
              )}

              {!discussionsLoading && !discussionsError && pageFilter === "all"
                ? sortedPages.map(page => (
                    <div key={page} className="flex flex-col gap-2">
                      <button
                        onClick={() => jumpToPage(page)}
                        className="flex items-center gap-2 group"
                      >
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

                      {pageGroups[page].map(discussion => (
                        <DiscussionCard
                          key={discussion.id}
                          discussion={discussion}
                          expanded={expandedThread === discussion.id}
                          onToggle={() => setExpandedThread(expandedThread === discussion.id ? null : discussion.id)}
                          onReply={() => sendReply(discussion.id)}
                          onMarkResolved={() => markResolved(discussion.id)}
                          replyText={replyTexts[discussion.id] || ""}
                          onReplyTextChange={(v) => setReplyTexts(prev => ({ ...prev, [discussion.id]: v }))}
                          pinNumber={discussion.position ? getPinNumber(discussion.id) : undefined}
                          onJumpToPage={() => jumpToPage(discussion.page)}
                          replySubmitting={replySubmittingId === discussion.id}
                        />
                      ))}
                    </div>
                  ))
                : !discussionsLoading && !discussionsError && sidebarDiscussions.map(discussion => (
                    <DiscussionCard
                      key={discussion.id}
                      discussion={discussion}
                      expanded={expandedThread === discussion.id}
                      onToggle={() => setExpandedThread(expandedThread === discussion.id ? null : discussion.id)}
                      onReply={() => sendReply(discussion.id)}
                      onMarkResolved={() => markResolved(discussion.id)}
                      replyText={replyTexts[discussion.id] || ""}
                      onReplyTextChange={(v) => setReplyTexts(prev => ({ ...prev, [discussion.id]: v }))}
                      pinNumber={discussion.position ? getPinNumber(discussion.id) : undefined}
                      onJumpToPage={() => jumpToPage(discussion.page)}
                      replySubmitting={replySubmittingId === discussion.id}
                    />
                  ))
              }
            </div>
          </ScrollArea>

          <div className="p-3 border-t">
            <Button className="w-full gap-2" variant={placingPin ? "secondary" : "default"} onClick={() => setPlacingPin(v => !v)}>
              <MapPin className="h-4 w-4" />
              {placingPin ? "Cancel placement" : "Pin a Discussion"}
            </Button>
          </div>
        </aside>
      </div>

      <Dialog open={discussionDialogOpen} onOpenChange={(open) => { if (!open) { setDiscussionDialogOpen(false); setPendingPosition(null); setDiscussionSubmitError(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              New discussion — Page {currentPage}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{selectedFile.title}</span>
              <span className="shrink-0">· p. {currentPage}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-question">Your question or comment</Label>
              <Textarea
                id="new-question"
                placeholder="What would you like to discuss about this part of the document?"
                className="resize-none"
                rows={3}
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) submitDiscussion(); }}
              />
              <p className="text-[11px] text-muted-foreground">Press Ctrl+Enter to post</p>
              {discussionSubmitError && (
                <p className="text-[11px] text-destructive">{discussionSubmitError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDiscussionDialogOpen(false); setPendingPosition(null); setDiscussionSubmitError(null); }}>Cancel</Button>
            <Button onClick={submitDiscussion} disabled={!newQuestion.trim() || submittingDiscussion}>
              {submittingDiscussion ? "Posting..." : "Post Discussion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface DiscussionCardProps {
  discussion: Discussion;
  expanded: boolean;
  onToggle: () => void;
  onReply: () => void;
  onMarkResolved: () => void;
  replyText: string;
  onReplyTextChange: (v: string) => void;
  pinNumber?: number;
  onJumpToPage: () => void;
  replySubmitting: boolean;
}

function DiscussionCard({ discussion, expanded, onToggle, onReply, onMarkResolved, replyText, onReplyTextChange, pinNumber, onJumpToPage, replySubmitting }: DiscussionCardProps) {
  return (
    <Card
      className={`overflow-hidden transition-all duration-200 border-l-4 ${
        discussion.status === "Open" ? "border-l-primary" : "border-l-emerald-500/50"
      } ${expanded ? "ring-1 ring-primary/20 shadow-md" : "hover:border-l-primary/60"}`}
    >
      <div className="p-3 cursor-pointer flex flex-col gap-2" onClick={onToggle}>
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2">
            {pinNumber !== undefined && (
              <span className={`w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 ${discussion.status === "Open" ? "bg-primary" : "bg-emerald-500"}`}>
                {pinNumber}
              </span>
            )}
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px]">{discussion.user.avatar}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{discussion.user.name}</span>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{discussion.time}</span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">{discussion.question}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5 items-center">
            <button onClick={(e) => { e.stopPropagation(); onMarkResolved(); }}>
              {discussion.status === "Open" ? (
                <Badge variant="outline" className="text-[10px] text-primary bg-primary/5 border-primary/20 flex gap-1 items-center px-1.5 py-0 cursor-pointer hover:bg-primary/10">
                  <Circle className="w-2 h-2 fill-current" /> Open
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 flex gap-1 items-center px-1.5 py-0 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                  <CheckCircle2 className="w-3 h-3" /> Resolved
                </Badge>
              )}
            </button>
            {discussion.replies.length > 0 && (
              <Badge variant="secondary" className="text-[10px] flex gap-1 items-center px-1.5 py-0">
                <MessageSquare className="w-3 h-3" /> {discussion.replies.length}
              </Badge>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onJumpToPage(); }}
            className="text-[10px] text-muted-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded border border-transparent hover:border-primary/20 hover:bg-primary/5"
          >
            p. {discussion.page}
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
            <div className="p-3 flex flex-col gap-3">
              {discussion.replies.length === 0 && (
                <p className="text-xs text-center text-muted-foreground py-2 italic">No replies yet. Be the first!</p>
              )}
              {discussion.replies.map((reply, i) => (
                <div key={i} className="flex gap-2">
                  <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                    <AvatarFallback className="text-[10px]">{reply.user.avatar}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 bg-background border rounded-md p-2.5 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-xs">{reply.user.name}</span>
                      <span className="text-[10px] text-muted-foreground">{reply.time}</span>
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed">{reply.message}</p>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="Reply to thread..."
                  className="h-8 text-xs bg-background"
                  value={replyText}
                  onChange={(e) => onReplyTextChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onReply(); } }}
                  disabled={replySubmitting}
                />
                <Button size="icon" className="h-8 w-8 shrink-0" onClick={onReply} disabled={!replyText.trim() || replySubmitting}>
                  {replySubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}