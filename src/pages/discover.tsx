import { useEffect, useMemo, useState, useRef } from "react";
import { authFetch } from "../lib/auth-context"; // adjust path to your actual authFetch location
import { Navbar } from "@/components/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Search,
  X,
  CheckCircle2,
  FileText,
  LayoutGrid,
  List as ListIcon,
  ClipboardList,
  
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types — align these with your actual Mongoose/API shapes.
// Resource fields taken from your resource.controller.ts (course.name, not title).
// Teacher fields are a best guess (user_name, profile_pic, is_verified) based
// on patterns already established elsewhere in EduThread — adjust if your
// TeacherProfile/User shape differs.
// ---------------------------------------------------------------------------

interface Teacher {
  _id: string;
  user_name: string;
  profile_pic?: string;
  is_verified?: boolean;
  bio?: string;
  courseCount?: number;
}

interface Resource {
  _id: string;
  title: string;
  fileUrl: string;
  fileSize?: number;
  createdAt: string;
  threadCount?: number;
  course: {
    _id: string;
    name: string;
  };
  uploadedBy: {
    _id: string;
    user_name: string;
    profile_pic?: string;
  };
}

// Matches the real Question model — every doc here was created by a teacher,
// since POST /questions is role-gated server-side (requireRole "teacher").
// There is no student-authored "question" in this schema, so Discover no
// longer needs a client-side filter to exclude non-teacher content — using
// this endpoint at all already guarantees that.
interface TeacherQuestion {
  _id: string;
  title: string;
  instructions?: string;
  course: { _id: string; name: string } | string;
  dueDate: string; // last moment a student may start an attempt
  durationMinutes: number;
  totalMarks: number;
  questionPdfUrl: string;
  questionFileName: string;
}

type SortKey = "newest" | "oldest" | "title" | "size";
type ViewMode = "grid" | "list";

const PAGE_SIZE = 9;

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "title", label: "Title A–Z" },
  { key: "size", label: "Largest file" },
];

function formatBytes(bytes?: number) {
  if (!bytes) return "—";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function courseName(course: TeacherQuestion["course"]) {
  return typeof course === "string" ? course : course.name;
}


// Small debounce hook so search doesn't refilter on every keystroke.
function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export default function DiscoverPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [teacherQuestions, setTeacherQuestions] = useState<TeacherQuestion[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [loadingResources, setLoadingResources] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rawQuery, setRawQuery] = useState("");
  const query = useDebouncedValue(rawQuery, 300);
  const [activeTeacher, setActiveTeacher] = useState<string | null>(null);
  const [activeCourse, setActiveCourse] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [view, setView] = useState<ViewMode>("grid");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const searchRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    let cancelled = false;

    async function loadTeachers() {
      try {
        // TODO: replace "/teachers" with your real endpoint if different
        const res = await authFetch("/teachers");
        if (!res.ok) throw new Error("Could not load teachers");
        const data = await res.json();
        if (!cancelled) setTeachers(data.data ?? data.body ?? []);
      } catch {
        if (!cancelled) setError((prev) => prev ?? "Some teachers could not be loaded");
      } finally {
        if (!cancelled) setLoadingTeachers(false);
      }
    }

    async function loadResources() {
      try {
        const res = await authFetch("/courses/resources/all");
        if (!res.ok) throw new Error("Could not load documents");
        const data = await res.json();
        if (!cancelled) setResources(data.data ?? []);
      } catch {
        if (!cancelled) setError((prev) => prev ?? "Documents could not be loaded");
      } finally {
        if (!cancelled) setLoadingResources(false);
      }
    }

    async function loadQuestions() {
      try {
        // Same endpoint Assessments.tsx uses. As a student, listQuestions
        // already filters to { published: true } and to courses the
        // student is enrolled in — teacher-authorship is guaranteed by
        // the schema itself, not something Discover needs to re-check.
        const res = await authFetch("/questions");
        if (!res.ok) throw new Error("Could not load questions");
        const data = await res.json();
        // Defensive filter only: drop anything missing a question paper,
        // in case older docs predate the questionPdfUrl requirement.
        const withPapers = (data.data ?? []).filter((q: TeacherQuestion) => Boolean(q.questionPdfUrl));
        if (!cancelled) setTeacherQuestions(withPapers);
      } catch {
        if (!cancelled) setError((prev) => prev ?? "Questions could not be loaded");
      } finally {
        if (!cancelled) setLoadingQuestions(false);
      }
    }

    loadTeachers();
    loadResources();
    loadQuestions();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset pagination whenever a filter changes, so "Load more" starts fresh.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, activeTeacher, activeCourse, sortKey]);

  const courses = useMemo(() => {
    const map = new Map<string, string>();
    resources.forEach((r) => {
      if (r.course?._id) map.set(r.course._id, r.course.name);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [resources]);

  const filteredResources = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = resources.filter((r) => {
      if (activeTeacher && r.uploadedBy?._id !== activeTeacher) return false;
      if (activeCourse && r.course?._id !== activeCourse) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.course?.name?.toLowerCase().includes(q) ||
        r.uploadedBy?.user_name?.toLowerCase().includes(q)
      );
    });

    return [...result].sort((a, b) => {
      switch (sortKey) {
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "title":
          return a.title.localeCompare(b.title);
        case "size":
          return (b.fileSize ?? 0) - (a.fileSize ?? 0);
        case "newest":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [resources, query, activeTeacher, activeCourse, sortKey]);

  const visibleResources = filteredResources.slice(0, visibleCount);
  const hasMore = visibleCount < filteredResources.length;

  const filteredQuestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teacherQuestions.filter((item) => {
      if (activeCourse && typeof item.course !== "string" && item.course._id !== activeCourse) return false;
      if (!q) return true;
      return item.title.toLowerCase().includes(q) || courseName(item.course).toLowerCase().includes(q);
    });
  }, [teacherQuestions, query, activeCourse]);

  const activeTeacherName = teachers.find((t) => t._id === activeTeacher)?.user_name;
  const activeCourseName = courses.find((c) => c.id === activeCourse)?.name;
  const hasActiveFilters = Boolean(activeTeacher || activeCourse || rawQuery);

  function clearAllFilters() {
    setActiveTeacher(null);
    setActiveCourse(null);
    setRawQuery("");
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape" && rawQuery) {
      setRawQuery("");
      searchRef.current?.blur();
    }
  }

  // The actual start/timer/upload flow lives on Assessments.tsx — Discover
  // stays a browse surface and hands off there rather than duplicating that
  // logic. If you later split it into its own /questions/:id route, this is
  // the one place that needs to change.
  function goToExamination() {
    navigate("/questions");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1">
        {/* Header / search */}
        <section className="container mx-auto px-4 pb-10 pt-16 md:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl text-center"
          >
            <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground bg-secondary">
              Discover
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
              Find a teacher, find their work
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Browse instructors publishing on EduThread, the examinations
              they've posted, and the documents they've shared.
            </p>

            <div className="mt-8 flex items-center gap-3 rounded-md border bg-background px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-ring">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={searchRef}
                value={rawQuery}
                onChange={(e) => setRawQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search by title, course, or teacher…"
                aria-label="Search documents"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {rawQuery && (
                <button
                  onClick={() => setRawQuery("")}
                  aria-label="Clear search"
                  className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {activeTeacherName && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {activeTeacherName}
                    <button
                      onClick={() => setActiveTeacher(null)}
                      aria-label={`Remove ${activeTeacherName} filter`}
                      className="hover:text-primary/70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {activeCourseName && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {activeCourseName}
                    <button
                      onClick={() => setActiveCourse(null)}
                      aria-label={`Remove ${activeCourseName} filter`}
                      className="hover:text-primary/70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                <button
                  onClick={clearAllFilters}
                  className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </motion.div>
        </section>

        {error && (
          <div className="container mx-auto px-4">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          </div>
        )}

        {/* Teacher rail */}
        <section className="border-y bg-muted/30 py-10">
          <div className="container mx-auto px-4">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-xl font-semibold">Teachers</h2>
              {activeTeacher && (
                <button
                  onClick={() => navigate("/profile")}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Show all
                </button>
              )}
            </div>

            {loadingTeachers ? (
              <div className="flex gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-20 w-48 shrink-0 animate-pulse rounded-xl border bg-muted" />
                ))}
              </div>
            ) : teachers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No teachers to show yet.</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {teachers.map((t) => {
                  return (
                    <button
                      key={t._id}
                      onClick={() => navigate(`/profile/${t._id}`)}
                      className="flex w-52 shrink-0 items-center gap-3 rounded-xl border bg-background p-4 text-left shadow-sm transition-all hover:shadow-md"
                    >
                      {t.profile_pic ? (
                        <img
                          src={t.profile_pic}
                          alt={t.user_name}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {initials(t.user_name)}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 truncate text-sm font-semibold">
                          {t.user_name}
                          {t.is_verified && (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 fill-primary text-primary-foreground" />
                          )}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {t.courseCount ?? "—"} course{t.courseCount === 1 ? "" : "s"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Questions — sourced from /questions, so every card here is a
            teacher-authored, PDF-backed examination. No client-side role
            filtering needed; the endpoint only ever returns those. */}
        <section className="border-b py-12">
          <div className="container mx-auto px-4">
            <div className="mb-6 flex items-baseline justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Examinations from your teachers
                </h2>
                <p className="text-sm text-muted-foreground">
                  {filteredQuestions.length} question paper{filteredQuestions.length === 1 ? "" : "s"} available
                </p>
              </div>
            </div>
{loadingQuestions ? (
  <div className="grid grid-cols-1 gap-4">
    <div className="h-40 animate-pulse rounded-xl border bg-muted" />
  </div>
) : (
  <Card className="border-muted shadow-sm">
    <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <ClipboardList className="h-8 w-8 text-primary" />
      </div>

      <div>
        <h3 className="text-lg font-semibold">Online Examinations</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          View all available examinations, start your exams, upload answer
          sheets, and track your submissions.
        </p>
      </div>

      <Button
        size="lg"
        onClick={goToExamination}
        className="mt-2"
      >
        <ClipboardList className="mr-2 h-4 w-4" />
        Go to Examinations
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>

      {!loadingQuestions && (
        <p className="text-xs text-muted-foreground">
          {filteredQuestions.length} examination
          {filteredQuestions.length !== 1 ? "s" : ""} available
        </p>
      )}
    </CardContent>
  </Card>
)}
          </div>
        </section>

        {/* Course filter chips */}
        {courses.length > 0 && (
          <section className="border-b py-6">
            <div className="container mx-auto flex flex-wrap items-center gap-2 px-4">
              <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Courses
              </span>
              {courses.map((c) => {
                const isActive = activeCourse === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveCourse(isActive ? null : c.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Document grid */}
        <section className="container mx-auto px-4 py-12">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">
                {activeTeacherName ? `Documents from ${activeTeacherName}` : "Recent documents"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {filteredResources.length} result{filteredResources.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="sort-select">
                Sort documents
              </label>
              <select
                id="sort-select"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="h-9 rounded-md border bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <div className="flex overflow-hidden rounded-md border shadow-sm">
                <button
                  onClick={() => setView("grid")}
                  aria-pressed={view === "grid"}
                  aria-label="Grid view"
                  className={`p-2 transition-colors ${
                    view === "grid"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setView("list")}
                  aria-pressed={view === "list"}
                  aria-label="List view"
                  className={`p-2 transition-colors ${
                    view === "list"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <ListIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {loadingResources ? (
            <div
              className={
                view === "grid"
                  ? "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
                  : "flex flex-col gap-3"
              }
            >
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`animate-pulse rounded-xl border bg-muted ${
                    view === "grid" ? "h-44" : "h-16"
                  }`}
                />
              ))}
            </div>
          ) : filteredResources.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center py-16 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-lg font-semibold">Nothing here yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasActiveFilters
                    ? "Try a different search or clear your filters."
                    : "Check back once teachers publish."}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="mt-5 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
                  >
                    Clear filters
                  </button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div
                className={
                  view === "grid"
                    ? "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
                    : "flex flex-col gap-3"
                }
              >
                {visibleResources.map((r, i) =>
                  view === "grid" ? (
                    <motion.a
                      key={r._id}
                      href={`/viewer/${r._id}`}
                      initial={{ opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: (i % PAGE_SIZE) * 0.04 }}
                      viewport={{ once: true }}
                    >
                      <Card className="group h-full transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">
                        <CardContent className="flex h-full flex-col justify-between p-5">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                                {r.course?.name ?? "Uncategorized"}
                              </span>
                              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            </div>
                            <h3 className="mt-3 text-lg font-semibold leading-snug group-hover:text-primary">
                              {r.title}
                            </h3>
                            {typeof r.threadCount === "number" && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {r.threadCount} thread{r.threadCount === 1 ? "" : "s"}
                              </p>
                            )}
                          </div>

                          <div className="mt-6 flex items-center justify-between border-t pt-3">
                            <span className="flex items-center gap-2 text-xs text-muted-foreground">
                              {r.uploadedBy?.profile_pic ? (
                                <img
                                  src={r.uploadedBy.profile_pic}
                                  alt={r.uploadedBy.user_name}
                                  className="h-5 w-5 rounded-full object-cover"
                                />
                              ) : (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">
                                  {initials(r.uploadedBy?.user_name ?? "?")}
                                </span>
                              )}
                              {r.uploadedBy?.user_name ?? "Unknown"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(r.createdAt)} · {formatBytes(r.fileSize)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.a>
                  ) : (
                    <a key={r._id} href={`/viewer/${r._id}`}>
                      <Card className="transition-colors hover:border-primary/50 hover:bg-accent/40">
                        <CardContent className="flex items-center justify-between gap-4 p-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium hover:text-primary">
                                {r.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {r.course?.name ?? "Uncategorized"}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-4 text-right">
                            <span className="hidden text-xs text-muted-foreground sm:inline">
                              {r.uploadedBy?.user_name ?? "Unknown"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(r.createdAt)} · {formatBytes(r.fileSize)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </a>
                  )
                )}
              </div>

              {hasMore && (
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    className="inline-flex h-10 items-center justify-center rounded-md border bg-background px-6 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Load more ({filteredResources.length - visibleCount} more)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}