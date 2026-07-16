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
        const res = await authFetch("/courses/resources/all", { method: "GET" });
        const payload = await res.json();
        const all: ResourceDetail[] = payload?.data?.resources ?? payload?.data ?? payload ?? [];
        const found = all.find(r => r._id === resourceId);
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