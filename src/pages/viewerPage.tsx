import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Loader2 } from "lucide-react";
import Viewer from "./viewer"; // adjust this import path to wherever Viewer.tsx actually lives
import { authFetch } from "@/lib/auth-context";

// ---------------------------------------------------------------------------
// Route: /viewer/:id
//
// Two ways this page gets opened:
//
//   1. Exam mode  — /viewer/:questionId?exam=1&expiresAt=<ISO>
//      Set by StudentAction's "Open Question Paper" button while an attempt
//      is in_progress. `:id` is a QUESTION id. Renders the question PDF in
//      Viewer's read-only examMode, with the live countdown + lock overlay.
//
//   2. Grading/review mode — /viewer/:submissionId
//      Set by viewSubmission() (teacher review, or a student checking their
//      own graded/awaiting-review sheet). `:id` is a SUBMISSION id. Renders
//      the full Viewer with highlight/grading tools.
//
// NOTE: the two GET endpoints below (`/questions/:id` and
// `/questions/submissions/:id`) aren't among the routes you've shown me so
// far — I've matched them to the existing REST shape
// (`/questions/submissions/:submissionId/highlights` etc.), but you'll want
// to confirm the path and response shape against your actual backend and
// adjust the two spots marked below if they differ.
// ---------------------------------------------------------------------------

type ViewerResource = {
  resourceId: string;
  fileUrl: string;
  title: string;
  course?: string;
  pages?: number;
  maxMarks?: number;
};

export default function ViewerPage() {
  const [, params] = useRoute("/viewer/:id");
  const [location, navigate] = useLocation();
  const id = params?.id;

  // wouter doesn't parse the query string itself — pull it straight off
  // window.location, re-derived whenever `location` changes (e.g. on nav).
  const search = useMemo(() => new URLSearchParams(window.location.search), [location]);
  const examMode = search.get("exam") === "1";
  const attemptExpiresAt = search.get("expiresAt") ?? undefined;

  const [resource, setResource] = useState<ViewerResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expiring, setExpiring] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        // --- ADJUST HERE if your endpoints differ ---
        const path = examMode ? `/questions/${id}` : `/questions/submissions/${id}`;
        const res = await authFetch(path);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Unable to load document");
        const body = data.data ?? data.body ?? data;
        // --- end adjust ---

        if (cancelled) return;

        if (examMode) {
          setResource({
            resourceId: body._id,
            fileUrl: body.questionPdfUrl,
            title: body.title,
            course: typeof body.course === "string" ? undefined : body.course?.name,
            maxMarks: body.totalMarks,
          });
        } else {
          setResource({
            resourceId: body._id,
            fileUrl: body.fileUrl,
            title: body.fileName ?? "Answer sheet",
            maxMarks: body.question?.totalMarks,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load document");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, examMode]);

  // Fires the moment Viewer's countdown hits zero, or immediately if the
  // student reopens an already-expired link. Marks the attempt "expired"
  // server-side so an unsubmitted attempt actually transitions out of
  // in_progress — otherwise it just sits there forever and Assessments has
  // no way to know the window closed without a submission.
  const handleExamExpire = async () => {
    if (!id || expiring) {
      navigate("/assessments");
      return;
    }
    setExpiring(true);
    try {
      // --- ADJUST HERE: point this at your actual "mark attempt expired"
      // endpoint. Mirrors the existing POST /questions/:id/start shape. ---
      await authFetch(`/questions/${id}/expire`, { method: "POST" });
    } catch (err) {
      console.error("Failed to mark attempt expired:", err);
      // Don't block navigation on this — the student's view is already
      // locked client-side either way, and Assessments reconciles status
      // from the server on its next load.
    } finally {
      navigate("/assessments");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm">Loading document...</span>
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-sm text-destructive">{error ?? "Document not found."}</p>
        <button className="text-sm text-primary underline" onClick={() => navigate("/assessments")}>
          Back to Assessments
        </button>
      </div>
    );
  }

  return (
    <Viewer
      resourceId={resource.resourceId}
      fileUrl={resource.fileUrl}
      title={resource.title}
      course={resource.course}
      pages={resource.pages}
      maxMarks={resource.maxMarks}
      examMode={examMode}
      attemptExpiresAt={attemptExpiresAt}
      onExamExpire={handleExamExpire}
    />
  );
}