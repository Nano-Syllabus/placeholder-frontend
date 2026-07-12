import React, { useState, useRef, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line
} from "recharts";
import {
  BookOpen, Users, FileText, MessageSquare, Plus,
  ArrowUpRight, CheckCircle2, TrendingUp, Upload, Eye, FileCheck, X,
} from "lucide-react";
import {
  MOCK_COURSES,
  CHART_ACTIVITY_DATA, CHART_UPLOADS_DATA, CHART_ENGAGEMENT_DATA,
  type Discussion
} from "@/lib/mock-data";
import { useLocation } from "wouter";
import { authFetch } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { NavBar } from "@/components/Dashboard-viewer-navbar";

// ---------------------------------------------------------------------------
// Resource types — same shape as GET /api/courses/resources/all in Viewer.tsx
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
  discussions: number;
  file: string;
}

function courseTitleFromResource(record: { course: ResourceRecord["course"] }): string {
  if (typeof record.course === "string") return record.course;
  if (record.course && typeof record.course === "object" && "title" in record.course) {
    return (record.course as { title?: string }).title || "Untitled course";
  }
  return "Untitled course";
}

function courseIdFromResource(record: { course: ResourceRecord["course"] }): string | undefined {
  if (typeof record.course === "string") return record.course;
  if (record.course && typeof record.course === "object" && "_id" in record.course) {
    return (record.course as { _id?: string })._id;
  }
  return undefined;
}

function toResourceView(record: ResourceRecord, discussionCount: number): ResourceView {
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
    course: courseTitleFromResource(record),
    uploadDate,
    discussions: discussionCount,
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
  return [];
}

// ---------------------------------------------------------------------------
// Discussion types — same shape as GET /api/discussions?resource=<id> in
// Viewer.tsx.
// ---------------------------------------------------------------------------

interface DiscussionUserRecord {
  _id: string;
  user_name: string;
  profile_pic?: string;
}

interface ReplyRecord {
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

function extractUserId(user: DiscussionUserRecord | string | undefined): string | undefined {
  if (!user) return undefined;
  return typeof user === "string" ? user : user._id;
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
    replies: [],
    position: undefined,
  };
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [createCourseOpen, setCreateCourseOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  // Raw records kept alongside the mapped views above — needed to compute
  // real stats (unique active students, per-course engagement, activity
  // over time) without re-fetching.
  const [discussionRecords, setDiscussionRecords] = useState<DiscussionRecord[]>([]);
  const [resourceRecords, setResourceRecords] = useState<ResourceRecord[]>([]);

  // Upload form state
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCourse, setUploadCourse] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [courses, setCourses] = useState<typeof MOCK_COURSES>([]);
  const [resources, setResources] = useState<ResourceView[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);

  // Create course form state
  const [courseName, setCourseName] = useState("");
  const [courseDesc, setCourseDesc] = useState("");
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);

  const showSuccess = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 3500);
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchStudents() {
      try {
        const res = await authFetch("/students");
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        const data = await res.json();
        if (!cancelled) setStudents(data.data ?? []);
      } catch (err) {
        console.error("Failed to load students:", err);
      }
    }

    async function fetchCourses() {
      setCoursesLoading(true);
      setCoursesError(null);
      try {
        const res = await authFetch("/courses");
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Failed to load courses");
        if (!cancelled) setCourses(data.body.courses);
      } catch (err) {
        if (!cancelled) {
          setCoursesError(err instanceof Error ? err.message : "Something went wrong.");
        }
      } finally {
        if (!cancelled) setCoursesLoading(false);
      }
    }

    // Fetches resources, then fetches discussions per-resource in parallel.
    // Keeps both the mapped views (for existing UI) and the raw records
    // (for the stats computed in the useMemos below).
    async function fetchResourcesAndDiscussions() {
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

        if (cancelled) return;

        const discussionResults = await Promise.all(
          records.map(async (record) => {
            try {
              const dRes = await authFetch(`/discussions?resource=${record._id}`, { method: "GET" });
              if (!dRes.ok) return [] as DiscussionRecord[];
              const dPayload = await dRes.json();
              return Array.isArray(dPayload?.data) ? (dPayload.data as DiscussionRecord[]) : [];
            } catch {
              return [] as DiscussionRecord[];
            }
          })
        );

        if (cancelled) return;

        const resourceViews = records.map((record, i) => toResourceView(record, discussionResults[i].length));
        const allDiscussionRecords = discussionResults.flat();
        const allDiscussions = records.flatMap((record, i) =>
          discussionResults[i].map(d => toDiscussionView(d, courseTitleFromResource(record)))
        );

        setResourceRecords(records);
        setResources(resourceViews);
        setDiscussionRecords(allDiscussionRecords);
        setDiscussions(allDiscussions);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load resources/discussions:", err);
        setResourcesError(err instanceof Error ? err.message : "Failed to load resources");
      } finally {
        if (!cancelled) setResourcesLoading(false);
      }
    }

    fetchStudents();
    fetchCourses();
    fetchResourcesAndDiscussions();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreateCourse = async () => {
    if (!courseName.trim()) return;
    setIsCreatingCourse(true);
    try {
      const res = await authFetch("/courses", {
        method: "POST",
        body: JSON.stringify({ name: courseName.trim(), description: courseDesc.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to create course");

      setCourses(prev => [data.body.course, ...prev]);
      setCourseName("");
      setCourseDesc("");
      setCreateCourseOpen(false);
      showSuccess(`Course "${data.body.course.name}" created successfully.`);
    } catch (err) {
      showSuccess(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsCreatingCourse(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      showSuccess("Please select a PDF file.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      showSuccess("File is too large. Max size is 50MB.");
      return;
    }
    setSelectedFile(file);
    if (!uploadTitle.trim()) {
      setUploadTitle(file.name.replace(/\.pdf$/i, ""));
    }
  };

  const handleUpload = async () => {
    if (!uploadTitle.trim() || !uploadCourse || !selectedFile) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", uploadTitle.trim());
      formData.append("courseId", uploadCourse);

      const res = await authFetch("/courses/resources/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message ?? "Upload failed");

      const created = toResourceView(data.body.resource, 0);
      setResources(prev => [created, ...prev]);
      setResourceRecords(prev => [data.body.resource, ...prev]);
      setUploadTitle("");
      setUploadCourse("");
      setSelectedFile(null);
      setUploadOpen(false);
      showSuccess(`"${created.title}" uploaded successfully.`);
    } catch (err) {
      showSuccess(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsUploading(false);
    }
  };

  const openDiscussions = discussions.filter(d => d.status === "Open");

  // ---------------------------------------------------------------------
  // Derived stats from real interactions
  // ---------------------------------------------------------------------

  // Unique student IDs who've asked a question or posted a reply anywhere.
  // NOTE: addReply records req.userId regardless of role, so if you (the
  // teacher) reply to threads, you'll be counted here too — there's no
  // role check on the backend to exclude teacher replies from this set.
  const activeStudentIds = useMemo(() => {
    const ids = new Set<string>();
    discussionRecords.forEach(d => {
      const askerId = extractUserId(d.user);
      if (askerId) ids.add(askerId);
      d.replies?.forEach(r => {
        const replierId = extractUserId(r.user);
        if (replierId) ids.add(replierId);
      });
    });
    return ids;
  }, [discussionRecords]);

  const discussionsToday = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    return discussionRecords.filter(d => d.createdAt?.slice(0, 10) === todayKey).length;
  }, [discussionRecords]);

  const resourcesThisWeek = useMemo(() => {
    return resourceRecords.filter(r => {
      if (!r.createdAt) return false;
      const diffDays = (Date.now() - new Date(r.createdAt).getTime()) / 86_400_000;
      return diffDays <= 7;
    }).length;
  }, [resourceRecords]);

  // Discussions created per day, last 7 days — powers the "Recent Courses"
  // area chart. Falls back to mock data until real discussions have loaded.
  const activityChartData = useMemo(() => {
    if (discussionRecords.length === 0) return CHART_ACTIVITY_DATA;
    const days: { key: string; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString(undefined, { weekday: "short" }) });
    }
    const countsByDay = new Map<string, number>();
    discussionRecords.forEach(d => {
      if (!d.createdAt) return;
      const key = d.createdAt.slice(0, 10);
      countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
    });
    return days.map(({ key, label }) => ({ name: label, discussions: countsByDay.get(key) ?? 0 }));
  }, [discussionRecords]);

  // Active (unique posting students) vs total (enrolled) per course.
  // Assumes resource.course._id and course.id refer to the same Mongo _id —
  // worth verifying in the network tab if this renders all zeroes.
  const engagementChartData = useMemo(() => {
    if (courses.length === 0 || resourceRecords.length === 0) return CHART_ENGAGEMENT_DATA;

    const resourceToCourseId = new Map(resourceRecords.map(r => [r._id, courseIdFromResource(r)]));
    const activeByCourse = new Map<string, Set<string>>();

    discussionRecords.forEach(d => {
      const courseId = resourceToCourseId.get(d.resource);
      if (!courseId) return;
      const set = activeByCourse.get(courseId) ?? new Set<string>();
      const askerId = extractUserId(d.user);
      if (askerId) set.add(askerId);
      d.replies?.forEach(r => {
        const replierId = extractUserId(r.user);
        if (replierId) set.add(replierId);
      });
      activeByCourse.set(courseId, set);
    });

    return courses.map((c: any) => ({
      name: c.name.length > 12 ? `${c.name.slice(0, 12)}…` : c.name,
      active: activeByCourse.get(c.id)?.size ?? 0,
      total: c.students ?? 0,
    }));
  }, [courses, resourceRecords, discussionRecords]);

  // Resources uploaded per week of the current month (rough 4-bucket split,
  // not precise ISO weeks).
  const uploadsChartData = useMemo(() => {
    if (resourceRecords.length === 0) return CHART_UPLOADS_DATA;
    const now = new Date();
    const weekBuckets = [0, 0, 0, 0];
    resourceRecords.forEach(r => {
      if (!r.createdAt) return;
      const d = new Date(r.createdAt);
      if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return;
      const weekIndex = Math.min(3, Math.floor((d.getDate() - 1) / 7));
      weekBuckets[weekIndex] += 1;
    });
    return weekBuckets.map((count, i) => ({ name: `Week ${i + 1}`, uploads: count }));
  }, [resourceRecords]);

  const metrics = [
    {
      title: "Total Courses",
      value: String(courses.length),
      icon: BookOpen,
      trend: `${courses.filter((c: any) => c.status === "Active").length} active`,
    },
    {
      title: "Total Students",
      value: String(students.length),
      icon: Users,
      trend: `${activeStudentIds.size} active in discussions`,
    },
    {
      title: "Resources Uploaded",
      value: String(resources.length),
      icon: FileText,
      trend: `+${resourcesThisWeek} this week`,
    },
    {
      title: "Active Discussions",
      value: String(openDiscussions.length),
      icon: MessageSquare,
      trend: `+${discussionsToday} today`,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <NavBar
        hasNotifications={openDiscussions.length > 0}
        notifOpen={notifOpen}
        onNotifOpenChange={setNotifOpen}
        avatarInitials="Prof"
        centerContent={
          <>
            <span className="text-muted-foreground hidden sm:inline-block">/</span>
            <span className="font-medium hidden sm:inline-block text-sm">Teacher Dashboard</span>
          </>
        }
        searchPlaceholder="Search courses, files..."
        notificationContent={
          <>
            <div className="p-3 border-b flex items-center justify-between">
              <span className="font-semibold text-sm">Notifications</span>
              <Badge variant="destructive" className="rounded-full text-[10px] h-5 px-2">{openDiscussions.length} new</Badge>
            </div>
            <div className="flex flex-col divide-y max-h-72 overflow-y-auto">
              {discussions.map(d => (
                <button
                  key={d.id}
                  className="p-3 text-left hover:bg-muted/50 transition-colors w-full"
                  onClick={() => { setNotifOpen(false); setLocation("/viewer"); }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="h-6 w-6 shrink-0 border">
                      <AvatarFallback className="text-[10px] bg-primary/5">{d.user.avatar}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-xs">{d.user.name}</span>
                    <Badge variant={d.status === "Open" ? "outline" : "secondary"} className="text-[10px] px-1.5 py-0 ml-auto">
                      {d.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 pl-8">{d.question}</p>
                </button>
              ))}
            </div>
            <div className="p-2 border-t">
              <Button variant="ghost" size="sm" className="w-full text-xs text-primary" onClick={() => setNotifOpen(false)}>
                View all notifications
              </Button>
            </div>
          </>
        }
      />

      {/* Success banner */}
      <AnimatePresence>
        {successBanner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800"
          >
            <div className="container mx-auto px-6 py-2.5 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 max-w-7xl">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {successBanner}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 container mx-auto p-6 md:p-8 flex flex-col gap-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
            <p className="text-muted-foreground mt-1">Here's what's happening across your courses today.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setUploadOpen(true)} data-testid="button-upload-resource">
              <Upload className="h-4 w-4 mr-2" /> Upload Resource
            </Button>
            <Button onClick={() => setCreateCourseOpen(true)} data-testid="button-create-course">
              <Plus className="h-4 w-4 mr-2" /> Create Course
            </Button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, i) => (
            <Card key={i} className="shadow-sm border-muted">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-muted-foreground">{metric.title}</span>
                    <span className="text-3xl font-bold">{metric.value}</span>
                  </div>
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <metric.icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-600 font-medium">{metric.trend.split(' ')[0]}</span>
                  <span>{metric.trend.split(' ').slice(1).join(' ')}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 shadow-sm border-muted">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">Discussion Activity</CardTitle>
                <CardDescription>Questions posted per day, last 7 days</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-primary h-8" data-testid="button-view-all-courses">
                View All
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorDiscussions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} itemStyle={{ color: 'hsl(var(--foreground))' }} />
                    <Area type="monotone" dataKey="discussions" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorDiscussions)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-muted">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Student Engagement</CardTitle>
              <CardDescription>Active (posted/replied) vs enrolled, per course</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={engagementChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} cursor={{ fill: 'hsl(var(--muted))' }} />
                    <Bar dataKey="active" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} name="Active" />
                    <Bar dataKey="total" fill="hsl(var(--primary) / 0.2)" radius={[4, 4, 0, 0]} maxBarSize={40} name="Total" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm border-muted">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Weekly Uploads</CardTitle>
            <CardDescription>Resources uploaded per week this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={uploadsChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} itemStyle={{ color: 'hsl(var(--foreground))' }} />
                  <Line type="monotone" dataKey="uploads" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: 'hsl(var(--primary))', r: 4 }} activeDot={{ r: 6 }} name="Uploads" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Courses Table + Unresolved Questions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 shadow-sm border-muted">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">Recent Courses</CardTitle>
                <CardDescription>Your active teaching environments</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-primary h-8" data-testid="button-view-all-courses">
                View All
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="w-[200px]">Course</TableHead>
                    <TableHead className="text-right">Students</TableHead>
                    <TableHead className="text-right">Resources</TableHead>
                    <TableHead className="hidden md:table-cell">Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.map((course: any) => (
                    <TableRow key={course.id} className="border-border group cursor-pointer hover:bg-muted/30">
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                            {course.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                          </div>
                          <span className="truncate max-w-[140px] block">{course.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{course.students}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{course.resources}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge
                          variant={course.status === "Active" ? "secondary" : "outline"}
                          className="font-normal text-xs"
                        >
                          {course.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity text-primary"
                          onClick={() => setLocation("/viewer")}
                          data-testid={`button-open-course-${course.id}`}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-muted flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex justify-between items-center">
                Unresolved Questions
                <Badge variant="destructive" className="ml-2 font-normal rounded-full text-[10px]">
                  {openDiscussions.length} New
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-5">
              {openDiscussions.map((discussion) => (
                <div key={discussion.id} className="flex gap-3 group relative">
                  <Avatar className="h-8 w-8 shrink-0 border z-10 bg-background">
                    <AvatarFallback className="text-xs bg-primary/5">{discussion.user.avatar}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium text-sm text-foreground truncate">{discussion.user.name}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{discussion.time}</span>
                    </div>
                    <div className="bg-muted/40 p-2.5 rounded-md mb-2">
                      <p className="text-sm text-muted-foreground line-clamp-2">{discussion.question}</p>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {discussion.course} &middot; p. {discussion.page}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-muted-foreground group-hover:text-primary transition-colors"
                        onClick={() => setLocation("/viewer")}
                        data-testid={`button-reply-discussion-${discussion.id}`}
                      >
                        Reply <ArrowUpRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Recent Uploads */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Uploads</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUploadOpen(true)}
              data-testid="button-upload-resource-secondary"
            >
              <Upload className="h-3.5 w-3.5 mr-2" /> Upload
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {resources.slice(0, 4).map((resource) => (
              <Card
                key={resource.id}
                className="shadow-sm border-muted hover:border-primary/40 transition-all cursor-pointer group hover:shadow-md"
                data-testid={`card-resource-${resource.id}`}
              >
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="p-2 bg-red-500/10 text-red-500 rounded-md">
                      <FileText className="h-5 w-5" />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setLocation("/viewer")}
                      data-testid={`button-open-resource-${resource.id}`}
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div>
                    <h3 className="font-medium text-sm truncate" title={resource.title}>{resource.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{resource.course}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-2 pt-3 border-t">
                    <span className="text-muted-foreground">{resource.uploadDate}</span>
                    <span className="flex items-center gap-1 font-medium text-muted-foreground">
                      <MessageSquare className="h-3 w-3" /> {resource.discussions}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      {/* Upload Resource Dialog */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) setSelectedFile(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Resource</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="upload-title">Document title</Label>
              <Input
                id="upload-title"
                placeholder="e.g. Lecture 5 – Memory Allocation"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                data-testid="input-upload-title"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="upload-course">Course</Label>
              <Select value={uploadCourse} onValueChange={setUploadCourse}>
                <SelectTrigger id="upload-course" data-testid="select-upload-course">
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.filter((c: any) => c.status === "Active").map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>PDF File</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-file-picker"
              />
              {selectedFile ? (
                <div className="border rounded-lg p-3 flex items-center gap-3 bg-muted/30">
                  <FileCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click to select a PDF</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Max 50MB</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadTitle.trim() || !uploadCourse || !selectedFile || isUploading}
              data-testid="button-confirm-upload"
            >
              {isUploading ? "Uploading..." : "Upload Resource"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Course Dialog */}
      <Dialog open={createCourseOpen} onOpenChange={setCreateCourseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Course</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="course-name">Course name</Label>
              <Input
                id="course-name"
                placeholder="e.g. Advanced Algorithms"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                data-testid="input-course-name"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="course-desc">Description (optional)</Label>
              <Textarea
                id="course-desc"
                placeholder="Brief description of what students will learn..."
                rows={3}
                className="resize-none"
                value={courseDesc}
                onChange={(e) => setCourseDesc(e.target.value)}
                data-testid="input-course-desc"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateCourseOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateCourse}
              disabled={!courseName.trim() || isCreatingCourse}
              data-testid="button-confirm-create-course"
            >
              {isCreatingCourse ? "Creating..." : "Create Course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}