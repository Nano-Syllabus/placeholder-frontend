// ViewerPage.tsx
import { useParams } from "wouter";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth-context";
import Viewer from "./viewer";
import { Loader2 } from "lucide-react";

interface ResourceDetail {
  _id: string;
  title: string;
  fileUrl: string;
  pages?: number;
  course: { _id: string; title: string } | string;
}

// ---------------------------------------------------------------------------
// Submission fallback — a student's submitted answer sheet (from
// /questions/:id/submissions) isn't in the Resource collection, so it can't
// be found via /courses/resources/all. We fall back to fetching it directly.
//
// ASSUMPTION: this expects a GET /questions/submissions/:id endpoint that
// mirrors the existing PATCH /questions/submissions/:id/review route, and
// returns the submission with `question` populated (at least { _id, title,
// course }) so we have something to show as the title/course in the viewer
// breadcrumb. If this endpoint doesn't exist yet on the backend, add it —
// otherwise submission PDFs will show "Resource not found".
// ---------------------------------------------------------------------------

interface SubmissionQuestion {
  _id: string;
  title: string;
  course?: { _id: string; title?: string; name?: string } | string;
}

interface SubmissionDetail {
  _id: string;
  fileUrl: string;
  fileName: string;
  question?: SubmissionQuestion | string;
}

function courseTitleFromQuestion(question: SubmissionQuestion | string | undefined): string | undefined {
  if (!question || typeof question === "string") return undefined;
  if (!question.course) return undefined;
  if (typeof question.course === "string") return question.course;
  return question.course.title ?? question.course.name;
}

async function fetchResource(resourceId: string): Promise<ResourceDetail | null> {
  const res = await authFetch("/courses/resources/all", { method: "GET" });
  if (!res.ok) return null;
  const payload = await res.json();
  const all: ResourceDetail[] = payload?.data?.resources ?? payload?.data ?? payload ?? [];
  return all.find(r => r._id === resourceId) ?? null;
}

async function fetchSubmissionAsResource(resourceId: string): Promise<ResourceDetail | null> {
  const res = await authFetch(`/questions/submissions/${resourceId}`, { method: "GET" });
  if (!res.ok) return null;
  const payload = await res.json();
  const submission: SubmissionDetail | undefined = payload?.data;
  if (!submission?.fileUrl) return null;

  const questionTitle =
    submission.question && typeof submission.question === "object" ? submission.question.title : undefined;

  return {
    _id: submission._id,
    title: questionTitle ? `Answer sheet — ${questionTitle}` : (submission.fileName ?? "Submitted answer sheet"),
    fileUrl: submission.fileUrl,
    course: courseTitleFromQuestion(submission.question) ?? "",
  };
}

export default function ViewerPage() {
  const { resourceId } = useParams<{ resourceId: string }>();
  const [resource, setResource] = useState<ResourceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resourceId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Try the course-resource lookup first (the common case), then fall
        // back to treating the id as a submission id.
        let found = await fetchResource(resourceId);
        if (!found) {
          found = await fetchSubmissionAsResource(resourceId);
        }
        if (cancelled) return;
        if (!found) throw new Error("Resource not found");
        setResource(found);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load resource");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [resourceId]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading document...
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="h-screen flex items-center justify-center text-destructive">
        {error ?? "Resource not found"}
      </div>
    );
  }

  const courseTitle = typeof resource.course === "string" ? resource.course : resource.course?.title;

  return (
    <Viewer
      resourceId={resource._id}
      fileUrl={resource.fileUrl}
      title={resource.title}
      course={courseTitle}
      pages={resource.pages}
    />
  );
}