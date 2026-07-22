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
   CheckCircle2, TrendingUp, Upload, FileCheck, X, HelpCircle,
} from "lucide-react";
import {
  MOCK_COURSES,
  CHART_UPLOADS_DATA,
} from "@/lib/mock-data";

import { authFetch } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { NavBar } from "@/components/Dashboard-viewer-navbar";
import { navigate } from "wouter/use-browser-location";

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



function toResourceView(record: ResourceRecord, questionCount: number): ResourceView {
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
    discussions: questionCount,
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

// ---------------------------------------------------------------------------
// Questions — teachers post questions for their courses, students answer them
// on the Discover page. For now these are static/local: posting a question
// just appends to local state, it is not persisted to a backend.
// ---------------------------------------------------------------------------

interface QuestionAnswer {
  id: string;
  student: { name: string; avatar: string };
  answer: string;
  createdAt: string;
}

interface QuestionItem {
  id: string;
  question: string;
  course: string;
  createdAt: string;
  answers: QuestionAnswer[];
}

function minutesAgo(mins: number): string {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

const STATIC_QUESTIONS: QuestionItem[] = [
  {
    id: "q-1",
    question: "What is the time complexity of merge sort in the worst case, and why?",
    course: "Advanced Algorithms",
    createdAt: minutesAgo(180),
    answers: [
      {
        id: "a-1",
        student: { name: "Amara Chen", avatar: "AC" },
        answer: "O(n log n) — the array is always split in half, and merging two halves takes linear time at each of the log n levels.",
        createdAt: minutesAgo(90),
      },
    ],
  },
  {
    id: "q-2",
    question: "Explain the difference between a stack and a queue, with a real-world example of each.",
    course: "Data Structures 101",
    createdAt: minutesAgo(1200),
    answers: [],
  },
  {
    id: "q-3",
    question: "Why does normalizing a database reduce redundancy?",
    course: "Database Systems",
    createdAt: minutesAgo(1800),
    answers: [
      {
        id: "a-2",
        student: { name: "Priya Nair", avatar: "PN" },
        answer: "Each fact is stored in exactly one place, so an update only needs to touch a single row instead of many duplicates.",
        createdAt: minutesAgo(1400),
      },
      {
        id: "a-3",
        student: { name: "Diego Ruiz", avatar: "DR" },
        answer: "It splits data into related tables so the same information isn't repeated across rows.",
        createdAt: minutesAgo(1100),
      },
    ],
  },
  {
    id: "q-4",
    question: "What happens when a recursive function is written without a base case?",
    course: "Advanced Algorithms",
    createdAt: minutesAgo(20),
    answers: [],
  },
  {
    id: "q-5",
    question: "How does a hash map achieve close to O(1) average lookup time?",
    course: "Data Structures 101",
    createdAt: minutesAgo(15),
    answers: [],
  },
];

export default function Dashboard() {
  
  const [uploadOpen, setUploadOpen] = useState(false);
  const [createCourseOpen, setCreateCourseOpen] = useState(false);
  const [postQuestionOpen, setPostQuestionOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const [questions, setQuestions] = useState<QuestionItem[]>(STATIC_QUESTIONS);
  const [resourceRecords, setResourceRecords] = useState<ResourceRecord[]>([]);

  // Upload form state
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCourse, setUploadCourse] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [courses, setCourses] = useState<typeof MOCK_COURSES>([]);
  const [resources, setResources] = useState<ResourceView[]>([]);

  const [students, setStudents] = useState<any[]>([]);

  // Create course form state
  const [courseName, setCourseName] = useState("");
  const [courseDesc, setCourseDesc] = useState("");
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);

  // Post question form state
  const [questionText, setQuestionText] = useState("");
  const [questionCourse, setQuestionCourse] = useState("");
  const [isPostingQuestion, setIsPostingQuestion] = useState(false);

  const showSuccess = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 3500);
  };

  // Re-fetch resources after a successful upload, so the Dashboard reflects
  // the new resource without a full page reload.
  const fetchResources = async () => {
    try {
      const res = await authFetch("/courses/resources/all", { method: "GET" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Request failed with status ${res.status}`);
      }
      const payload = await res.json();
      const records = extractResourceArray(payload);

      // Question counts per resource aren't tracked yet since questions are
      // course-level rather than resource-level for now — default to 0.
      const resourceViews = records.map((record) => toResourceView(record, 0));

      setResourceRecords(records);
      setResources(resourceViews);
    } catch (err) {
      console.error("Failed to load resources:", err);
    }
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
      try {
        const res = await authFetch("/courses");
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Failed to load courses");
        if (!cancelled) setCourses(data.body.courses);
      } catch (err) {
        console.log(err);
      }
    }

    fetchStudents();
    fetchCourses();
    fetchResources();

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

  // Posting a question is static/local for now: it just gets added to
  // component state so it shows up immediately in the lists and charts
  // below. Students answer these on the Discover page.
  const handlePostQuestion = () => {
    if (!questionText.trim() || !questionCourse) return;
    setIsPostingQuestion(true);

    const courseName =
      (courses as any[]).find((c: any) => c.id === questionCourse)?.name ?? questionCourse;

    const newQuestion: QuestionItem = {
      id: `q-${Date.now()}`,
      question: questionText.trim(),
      course: courseName,
      createdAt: new Date().toISOString(),
      answers: [],
    };

    setQuestions(prev => [newQuestion, ...prev]);
    setQuestionText("");
    setQuestionCourse("");
    setPostQuestionOpen(false);
    setIsPostingQuestion(false);
    showSuccess("Question posted. Students will see it on Discover.");
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
      formData.append("metadata", JSON.stringify({ subject: uploadTitle.trim() }));
      formData.append("course", uploadCourse);
      formData.append("namespace", uploadCourse);

      const res = await authFetch("/courses/resources/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message ?? data?.detail ?? `Upload failed with status ${res.status}`);
      }

      showSuccess("Document uploaded successfully.");

      setUploadTitle("");
      setUploadCourse("");
      setSelectedFile(null);
      setUploadOpen(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      fetchResources();
    } catch (err) {
      console.error(err);
      showSuccess(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsUploading(false);
    }
  };

  const openQuestions = useMemo(() => questions.filter(q => q.answers.length === 0), [questions]);
  const answeredQuestions = useMemo(() => questions.filter(q => q.answers.length > 0), [questions]);

  // ---------------------------------------------------------------------
  // Derived stats from questions
  // ---------------------------------------------------------------------

  const activeStudentIds = useMemo(() => {
    const names = new Set<string>();
    questions.forEach(q => q.answers.forEach(a => names.add(a.student.name)));
    return names;
  }, [questions]);

  const questionsToday = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    return questions.filter(q => q.createdAt.slice(0, 10) === todayKey).length;
  }, [questions]);

  const resourcesThisWeek = useMemo(() => {
    return resourceRecords.filter(r => {
      if (!r.createdAt) return false;
      const diffDays = (Date.now() - new Date(r.createdAt).getTime()) / 86_400_000;
      return diffDays <= 7;
    }).length;
  }, [resourceRecords]);

  // Questions posted per day, last 7 days — powers the "Questions Activity"
  // area chart.
  const activityChartData = useMemo(() => {
    const days: { key: string; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString(undefined, { weekday: "short" }) });
    }
    const countsByDay = new Map<string, number>();
    questions.forEach(q => {
      const key = q.createdAt.slice(0, 10);
      countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
    });
    return days.map(({ key, label }) => ({ name: label, questions: countsByDay.get(key) ?? 0 }));
  }, [questions]);

  // Students who've answered at least one question vs total enrolled, per
  // course.
  const engagementChartData = useMemo(() => {
    const activeByCourse = new Map<string, Set<string>>();
    questions.forEach(q => {
      const set = activeByCourse.get(q.course) ?? new Set<string>();
      q.answers.forEach(a => set.add(a.student.name));
      activeByCourse.set(q.course, set);
    });

    if (courses.length === 0) {
      return Array.from(activeByCourse.entries()).map(([name, set]) => ({
        name: name.length > 12 ? `${name.slice(0, 12)}…` : name,
        active: set.size,
        total: set.size,
      }));
    }

    return courses.map((c: any) => ({
      name: c.name.length > 12 ? `${c.name.slice(0, 12)}…` : c.name,
      active: activeByCourse.get(c.name)?.size ?? 0,
      total: c.students ?? 0,
    }));
  }, [courses, questions]);

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
      trend: `${activeStudentIds.size} active answering`,
    },
    {
      title: "Resources Uploaded",
      value: String(resources.length),
      icon: FileText,
      trend: `+${resourcesThisWeek} this week`,
    },
    {
      title: "Open Questions",
      value: String(openQuestions.length),
      icon: HelpCircle,
      trend: `+${questionsToday} today`,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <NavBar
        hasNotifications={openQuestions.length > 0}
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
              <Badge variant="destructive" className="rounded-full text-[10px] h-5 px-2">{openQuestions.length} new</Badge>
            </div>
            <div className="flex flex-col divide-y max-h-72 overflow-y-auto">
              {questions.map(q => (
                <button
                  key={q.id}
                  className="p-3 text-left hover:bg-muted/50 transition-colors w-full"
                  onClick={() => setNotifOpen(false)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-6 w-6 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                      <HelpCircle className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="font-medium text-xs">{q.course}</span>
                    <Badge variant={q.answers.length === 0 ? "outline" : "secondary"} className="text-[10px] px-1.5 py-0 ml-auto">
                      {q.answers.length === 0 ? "Open" : `${q.answers.length} answered`}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 pl-8">{q.question}</p>
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
            <Button variant="outline" onClick={() => navigate('/questions')} data-testid="button-post-question">
              <HelpCircle className="h-4 w-4 mr-2" /> Post Question
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
                <CardTitle className="text-base font-semibold">Questions Posted</CardTitle>
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
                      <linearGradient id="colorQuestions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} itemStyle={{ color: 'hsl(var(--foreground))' }} />
                    <Area type="monotone" dataKey="questions" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorQuestions)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-muted">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Student Engagement</CardTitle>
              <CardDescription>Students who've answered vs enrolled, per course</CardDescription>
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

        {/* Courses Table + Open Questions */}
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-muted flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex justify-between items-center">
                Open Questions
                <Badge variant="destructive" className="ml-2 font-normal rounded-full text-[10px]">
                  {openQuestions.length} New
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-5">
              {openQuestions.length === 0 && (
                <p className="text-sm text-muted-foreground">All questions have been answered. Post a new one to keep students engaged.</p>
              )}
              {openQuestions.map((q) => (
                <div key={q.id} className="flex gap-3 group relative">
                  <Avatar className="h-8 w-8 shrink-0 border z-10 bg-background">
                    <AvatarFallback className="text-xs bg-primary/5">
                      <HelpCircle className="h-3.5 w-3.5 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium text-sm text-foreground truncate">{q.course}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatRelativeTime(q.createdAt)}</span>
                    </div>
                    <div className="bg-muted/40 p-2.5 rounded-md mb-2">
                      <p className="text-sm text-muted-foreground line-clamp-2">{q.question}</p>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                        Awaiting student answers
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Answered Questions */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Answered Questions</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPostQuestionOpen(true)}
              data-testid="button-post-question-secondary"
            >
              <HelpCircle className="h-3.5 w-3.5 mr-2" /> Post Question
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {answeredQuestions.slice(0, 4).map((q) => (
              <Card
                key={q.id}
                className="shadow-sm border-muted hover:border-primary/40 transition-all cursor-pointer group hover:shadow-md"
                data-testid={`card-question-${q.id}`}
              >
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="p-2 bg-primary/10 text-primary rounded-md">
                      <HelpCircle className="h-5 w-5" />
                    </div>
                    <div className="flex -space-x-2">
                      {q.answers.slice(0, 3).map(a => (
                        <Avatar key={a.id} className="h-6 w-6 border-2 border-background">
                          <AvatarFallback className="text-[10px] bg-primary/10">{a.student.avatar}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium text-sm line-clamp-2" title={q.question}>{q.question}</h3>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{q.course}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-2 pt-3 border-t">
                    <span className="text-muted-foreground">{formatRelativeTime(q.createdAt)}</span>
                    <span className="flex items-center gap-1 font-medium text-muted-foreground">
                      <MessageSquare className="h-3 w-3" /> {q.answers.length}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {answeredQuestions.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full">No answers yet — check back once students respond.</p>
            )}
          </div>
        </div>
      </main>

      {/* Upload Resource Dialog */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) {
            setSelectedFile(null);
            setUploadTitle("");
            setUploadCourse("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="upload-title">Subject</Label>
              <Input
                id="upload-title"
                placeholder="Uploaded document"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="upload-course">Course</Label>
              <Select value={uploadCourse} onValueChange={setUploadCourse}>
                <SelectTrigger id="upload-course" data-testid="select-upload-course">
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {courses.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Create a course first before uploading a resource.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>PDF File</Label>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />

              {selectedFile ? (
                <div className="border rounded-lg p-3 flex items-center gap-3 bg-muted/30">
                  <FileCheck className="h-5 w-5 text-emerald-600" />

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {selectedFile.name}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary"
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />

                  <p>Select a PDF document</p>

                  <p className="text-xs text-muted-foreground mt-1">
                    Maximum file size: 50 MB
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadOpen(false)}
            >
              Cancel
            </Button>

            <Button
              onClick={handleUpload}
              disabled={
                !uploadTitle.trim() ||
                !uploadCourse ||
                !selectedFile ||
                isUploading
              }
            >
              {isUploading ? "Uploading..." : "Upload Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post Question Dialog */}
      <Dialog
        open={postQuestionOpen}
        onOpenChange={(open) => {
          setPostQuestionOpen(open);
          if (!open) {
            setQuestionText("");
            setQuestionCourse("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Post a Question</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="question-course">Course</Label>
              <Select value={questionCourse} onValueChange={setQuestionCourse}>
                <SelectTrigger id="question-course" data-testid="select-question-course">
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {courses.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Create a course first before posting a question.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="question-text">Question</Label>
              <Textarea
                id="question-text"
                placeholder="e.g. What is the time complexity of binary search?"
                rows={4}
                className="resize-none"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                data-testid="input-question-text"
              />
              <p className="text-xs text-muted-foreground">
                Students will see this question on the Discover page and can submit an answer.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPostQuestionOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePostQuestion}
              disabled={!questionText.trim() || !questionCourse || isPostingQuestion}
              data-testid="button-confirm-post-question"
            >
              {isPostingQuestion ? "Posting..." : "Post Question"}
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