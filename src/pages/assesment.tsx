import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { CalendarDays, CheckCircle2, Clock, ClipboardCheck, ExternalLink, Eye, FileText, Loader2, Plus, Send, Timer, Upload, Users } from "lucide-react";
import { useLocation } from "wouter";
import { NavBar } from "@/components/Dashboard-viewer-navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { authFetch, useAuth } from "@/lib/auth-context";

type Course = { id: string; name: string };
type Submission = { _id: string; fileUrl: string; fileName: string; status: "submitted" | "reviewed"; grade?: number; feedback?: string; student?: { user_name: string; email: string } };
type AttemptStatus = "in_progress" | "expired" | "submitted";
type Attempt = { _id: string; startedAt: string; expiresAt: string; status: AttemptStatus };
type Question = {
    _id: string;
    title: string;
    instructions: string;
    course: { _id: string; name: string } | string;
    dueDate: string; // last moment an attempt may be STARTED
    durationMinutes: number; // length of each student's own timer once started
    totalMarks: number;
    questionPdfUrl: string;
    questionFileName: string;
    submission?: Submission | null;
    submissionCount?: number;
    attempt?: Attempt | null; // only populated for students
};

const dateLabel = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const courseName = (course: Question["course"]) => typeof course === "string" ? course : course.name;
const isPastDue = (date: string) => new Date(date).getTime() < Date.now();

function formatRemaining(ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const mm = Math.floor(total / 60).toString().padStart(2, "0");
    const ss = (total % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
}

export default function Assessments() {
    const { user } = useAuth();
    const teacher = user?.role === "teacher";
    const [, navigate] = useLocation();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [selected, setSelected] = useState<Question | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [reviewing, setReviewing] = useState<Submission | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ title: "", instructions: "", course: "", dueDate: "", totalMarks: "100", durationMinutes: "45" });
    const [questionFile, setQuestionFile] = useState<File | null>(null);

    // Create-course dialog state (mirrors Dashboard's create-course flow)
    const [createCourseOpen, setCreateCourseOpen] = useState(false);
    const [courseNameInput, setCourseNameInput] = useState("");
    const [courseDesc, setCourseDesc] = useState("");
    const [isCreatingCourse, setIsCreatingCourse] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const [questionRes, courseRes] = await Promise.all([authFetch("/questions"), authFetch("/courses")]);
            const questionData = await questionRes.json(); const courseData = await courseRes.json();
            if (!questionRes.ok) throw new Error(questionData.message ?? "Unable to load questions");
            setQuestions(questionData.data ?? []); setCourses(courseData.body?.courses ?? []);
        } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load assessments"); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    const postQuestion = async (event: FormEvent) => {
        event.preventDefault();
        if (!questionFile) { setMessage("Attach the question paper as a PDF."); return; }
        setSaving(true);
        try {
            // multipart/form-data now — a PDF rides alongside the fields, so this
            // can no longer be JSON.stringify like the old text-only version.
            // NOTE: authFetch must NOT force a Content-Type header for this call;
            // the browser needs to set its own multipart boundary. If your
            // authFetch always attaches "Content-Type: application/json", it
            // needs a branch that skips that header when body is a FormData.
            console.log(form)
            const body = new FormData();
            body.append("title", form.title);
            body.append("instructions", form.instructions);
            body.append("course", form.course);
            body.append("dueDate", new Date(form.dueDate).toISOString());
            body.append("totalMarks", form.totalMarks);
            body.append("durationMinutes", form.durationMinutes);
           body.append("questionPdf", questionFile);
            const res = await authFetch("/questions", {
  method: "POST",
  body,
});

const data = await res.json();

console.log("Status:", res.status);
console.log("Response:", data);

if (!res.ok) {
  throw new Error(data.message);
}
            if (!res.ok) throw new Error(data.message ?? "Unable to publish question");
            setCreateOpen(false);
            setForm({ title: "", instructions: "", course: "", dueDate: "", totalMarks: "100", durationMinutes: "45" });
            setQuestionFile(null);
            setMessage("Question published and available to enrolled students.");
            load();
        } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to publish question"); }
        finally { setSaving(false); }
    };

    const startExam = async (question: Question) => {
        setSaving(true);
        try {
            const res = await authFetch(`/questions/${question._id}/start`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message ?? "Unable to start exam");
            // Trust the server's startedAt/expiresAt rather than computing our
            // own — that's the whole point of moving the timer server-side.
            setQuestions((prev) => prev.map((q) => (q._id === question._id ? { ...q, attempt: data.data } : q)));
        } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to start exam"); }
        finally { setSaving(false); }
    };

    const submitPdf = async (question: Question, event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]; if (!file) return;
        if (file.type !== "application/pdf" || file.size > 50 * 1024 * 1024) { setMessage("Upload a PDF under 50 MB."); event.target.value = ""; return; }
        setSaving(true);
        try {
            const body = new FormData(); body.append("file", file);
            const res = await authFetch(`/questions/${question._id}/submissions`, {
                method: "POST", body
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message ?? "Upload failed");
            setMessage("Answer sheet submitted successfully."); load();
        }
        catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed"); }
        finally { setSaving(false); event.target.value = ""; }
    };

    const openSubmissions = async (question: Question) => {
        setSelected(question); setSubmissions([]); setSaving(true);
        try {
            const res = await authFetch(`/questions/${question._id}/submissions`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.message ?? "Unable to load submissions");
            setSubmissions(data.data ?? []);
        }
        catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load submissions"); }
        finally { setSaving(false); }
    };

    const submitReview = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); if (!reviewing || !selected) return; const values = new FormData(event.currentTarget); setSaving(true);
        try { const res = await authFetch(`/questions/submissions/${reviewing._id}/review`, { method: "PATCH", body: JSON.stringify({ grade: Number(values.get("grade")), feedback: values.get("feedback") }) }); const data = await res.json(); if (!res.ok) throw new Error(data.message ?? "Unable to save review"); setReviewing(null); setMessage("Grade and feedback saved."); openSubmissions(selected); load(); }
        catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save review"); }
        finally { setSaving(false); }
    };

    // Create-course handler, same shape as Dashboard's handleCreateCourse,
    // adapted to this page's lighter Course type ({ id, name }).
    const handleCreateCourse = async () => {
        if (!courseNameInput.trim()) return;
        setIsCreatingCourse(true);
        try {
            const res = await authFetch("/courses", {
                method: "POST",
                body: JSON.stringify({ name: courseNameInput.trim(), description: courseDesc.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message ?? "Failed to create course");

            setCourseNameInput("");
            setCourseDesc("");
            setCreateCourseOpen(false);
            setMessage(`Course "${data.body.course.name}" created successfully.`);

            const courseRes = await authFetch("/courses");
            const courseData = await courseRes.json();
            if (courseRes.ok) setCourses(courseData.body?.courses ?? []);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Something went wrong.");
        } finally {
            setIsCreatingCourse(false);
        }
    };

    const viewSubmission = (submissionId: string) => {
        navigate(`/viewer/${submissionId}`);
    };

    // Teacher preview of the question paper — never exam mode, since a
    // teacher isn't on the clock and wants the normal grading-capable view.
    const viewQuestion = (questionId: string) => {
        navigate(`/viewer/${questionId}`);
    };

    // Student view of the question paper while an attempt is in progress —
    // routes into the same viewer, but flagged as exam mode with the
    // attempt's expiry so the viewer can show the countdown and lock itself
    // once time runs out. ViewerPage is responsible for reading these two
    // query params (exam, expiresAt) and forwarding them to <Viewer />.
    const viewQuestionAsExam = (questionId: string, expiresAt?: string) => {
        const query = expiresAt ? `?exam=1&expiresAt=${encodeURIComponent(expiresAt)}` : "?exam=1";
        navigate(`/viewer/${questionId}${query}`);
    };

    return <div className="min-h-screen bg-muted/25"><NavBar avatarInitials={user?.avatar ?? ""} centerContent={<span className="text-sm font-medium">Assessments</span>} />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <p className="text-sm font-medium text-primary">{teacher ? "Teacher workspace" : "Student workspace"}</p>
                    <h1 className="text-3xl font-bold tracking-tight">{teacher ? "Questions & answer sheets" : "Your assessments"}</h1>
                    <p className="mt-2 text-muted-foreground">{teacher ? "Publish a question paper, then review every submitted PDF in one place." : "Start the exam when you're ready — your timer begins the moment you do."}</p>
                </div>
                {teacher && (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setCreateCourseOpen(true)} data-testid="button-create-course">
                            <Plus className="mr-2 h-4 w-4" />Create course
                        </Button>
                        <Button onClick={() => setCreateOpen(true)} data-testid="button-post-question">
                            <Plus className="mr-2 h-4 w-4" />Post a question
                        </Button>
                    </div>
                )}
            </div>
            {message && <div className="mb-5 flex items-center justify-between rounded-lg border bg-background px-4 py-3 text-sm"><span>{message}</span><button className="text-muted-foreground" onClick={() => setMessage(null)}>×</button></div>}
            {loading ? <div className="flex justify-center py-24"><Loader2 className="animate-spin text-primary" /></div> : questions.length === 0 ? <Card className="py-16 text-center"><ClipboardCheck className="mx-auto mb-4 h-10 w-10 text-muted-foreground" /><CardTitle>No questions yet</CardTitle><CardDescription className="mt-2">{teacher ? "Post your first question paper to start collecting answer sheets." : "Your teacher has not posted an assessment yet."}</CardDescription></Card> : <div className="grid gap-5 md:grid-cols-2">{questions.map(question => <Card key={question._id} className="flex flex-col"><CardHeader><div className="flex items-start justify-between gap-3"><div><Badge variant="secondary" className="mb-2">{courseName(question.course)}</Badge><CardTitle className="text-xl">{question.title}</CardTitle></div><Badge variant={isPastDue(question.dueDate) ? "destructive" : "outline"}>{isPastDue(question.dueDate) ? "Closed" : `${question.totalMarks} marks`}</Badge></div>{question.instructions && <CardDescription className="pt-2 line-clamp-3">{question.instructions}</CardDescription>}</CardHeader><CardContent className="mt-auto space-y-4">
                <Button
    variant="ghost"
    size="sm"
    className="justify-start p-0 h-auto text-primary hover:bg-transparent hover:underline"
    onClick={() => viewQuestion(question._id)}
>
    <FileText className="mr-2 h-4 w-4" />
    {question.questionFileName}
    <Eye className="ml-2 h-3.5 w-3.5" />
</Button>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{teacher ? "Starts by " : "Start by "}{dateLabel(question.dueDate)}</span>
                    <span className="flex items-center gap-2"><Timer className="h-4 w-4" />{question.durationMinutes} min</span>
                </div>
                {teacher ? 
                <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4" />{question.submissionCount ?? 0} submissions</span>
                        <Button size="sm" onClick={() => openSubmissions(question)}>Review</Button></div> : 
                        <StudentAction
    question={question}
    busy={saving}
    onStart={() => startExam(question)}
    onUpload={(event) => submitPdf(question, event)}
    onView={viewSubmission}
    onViewQuestion={viewQuestionAsExam}
/>}</CardContent></Card>)}</div>}
        </main>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Post a question</DialogTitle></DialogHeader><form onSubmit={postQuestion} className="space-y-4">
            <div><Label>Question title</Label><Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Database normalization exercise" /></div>
            <div><Label>Question paper (PDF)</Label><Input required type="file" accept="application/pdf" onChange={e => setQuestionFile(e.target.files?.[0] ?? null)} />{questionFile && <p className="mt-1 text-xs text-muted-foreground">{questionFile.name}</p>}</div>
            <div><Label>Cover note (optional)</Label><Textarea rows={3} value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} placeholder="Anything students should know before opening the paper — the questions themselves live in the PDF above." /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><Label>Course</Label><Select required value={form.course} onValueChange={course => setForm({ ...form, course })}><SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger><SelectContent>{courses.map(course => <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Total marks</Label><Input required min="1" type="number" value={form.totalMarks} onChange={e => setForm({ ...form, totalMarks: e.target.value })} /></div></div>
            <div className="grid gap-4 sm:grid-cols-2">
                <div><Label>Duration (minutes)</Label><Input required min="1" max="600" type="number" value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: e.target.value })} /><p className="mt-1 text-xs text-muted-foreground">Each student's own timer starts the moment they click "Start examination."</p></div>
                <div><Label>Start-by date</Label><Input required type="datetime-local" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /><p className="mt-1 text-xs text-muted-foreground">Last moment a student may begin — not the submission deadline.</p></div>
            </div>
            <DialogFooter><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Publish question</Button></DialogFooter></form></DialogContent></Dialog>
        <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Submitted answer sheets{selected ? ` · ${selected.title}` : ""}</DialogTitle></DialogHeader><div className="max-h-[60vh] space-y-3 overflow-y-auto">{saving && !submissions.length ? <Loader2 className="mx-auto animate-spin" /> : submissions.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No answer sheets submitted yet.</p> : submissions.map(submission => <div key={submission._id} className="rounded-lg border p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="font-medium">{submission.student?.user_name ?? "Student"}</p><p className="text-sm text-muted-foreground">{submission.student?.email}</p><a className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline" href={submission.fileUrl} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" />{submission.fileName}<ExternalLink className="h-3 w-3" /></a></div><div className="flex items-center gap-3"><Badge variant={submission.status === "reviewed" ? "default" : "secondary"}>{submission.status === "reviewed" ? `${submission.grade}/${selected?.totalMarks}` : "Awaiting review"}</Badge><Button size="sm" variant="outline" onClick={() => viewSubmission(submission._id)}><Eye className="mr-1.5 h-3.5 w-3.5" />View & discuss</Button><Button size="sm" variant="outline" onClick={() => setReviewing(submission)}>Review</Button></div></div>{submission.feedback && <p className="mt-3 rounded bg-muted p-3 text-sm">{submission.feedback}</p>}</div>)}</div></DialogContent></Dialog>
        <Dialog open={!!reviewing} onOpenChange={open => !open && setReviewing(null)}><DialogContent><DialogHeader><DialogTitle>Review answer sheet</DialogTitle></DialogHeader><form onSubmit={submitReview} className="space-y-4"><div><Label>Grade (out of {selected?.totalMarks})</Label><Input name="grade" required type="number" min="0" max={selected?.totalMarks} defaultValue={reviewing?.grade} /></div><div><Label>Feedback</Label><Textarea name="feedback" rows={5} defaultValue={reviewing?.feedback} placeholder="Give the student clear, actionable feedback." /></div><DialogFooter><Button type="submit" disabled={saving}><CheckCircle2 className="mr-2 h-4 w-4" />Save review</Button></DialogFooter></form></DialogContent></Dialog>

        {/* Create Course Dialog — mirrors Dashboard's create-course dialog */}
        <Dialog
            open={createCourseOpen}
            onOpenChange={(open) => {
                setCreateCourseOpen(open);
                if (!open) {
                    setCourseNameInput("");
                    setCourseDesc("");
                }
            }}
        >
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
                            value={courseNameInput}
                            onChange={(e) => setCourseNameInput(e.target.value)}
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
                        disabled={!courseNameInput.trim() || isCreatingCourse}
                        data-testid="button-confirm-create-course"
                    >
                        {isCreatingCourse ? "Creating..." : "Create Course"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>;
}

// Live countdown driven by the server's expiresAt — recomputed every second
// from wall-clock time, never counted down independently client-side, so a
// tab left open overnight still shows the correct (expired) state on tick.
function ExamCountdown({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
    const [now, setNow] = useState(Date.now());
    const firedRef = useRef(false);

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const remaining = new Date(expiresAt).getTime() - now;

    useEffect(() => {
        if (remaining <= 0 && !firedRef.current) {
            firedRef.current = true;
            onExpire();
        }
    }, [remaining, onExpire]);

    const low = remaining > 0 && remaining < 5 * 60 * 1000;

    return (
        <span className={`flex items-center gap-1.5 font-mono text-sm font-medium ${low ? "text-destructive" : "text-foreground"}`}>
            <Clock className="h-4 w-4" />
            {remaining > 0 ? formatRemaining(remaining) : "00:00"}
        </span>
    );
}
function StudentAction({
    question,
    busy,
    onStart,
    onUpload,
    onView,
    onViewQuestion,
}: {
    question: Question;
    busy: boolean;
    onStart: () => void;
    onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
    onView: (submissionId: string) => void;
    onViewQuestion: (questionId: string, expiresAt?: string) => void;
}) {
    const input = useRef<HTMLInputElement>(null);

    const submission = question.submission;
    const attempt = question.attempt;

    // Derive expiration from the backend attempt
    const isExpired =
        attempt?.expiresAt &&
        new Date(attempt.expiresAt).getTime() <= Date.now();

    // Reviewed
    if (submission?.status === "reviewed") {
        return (
            <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        Reviewed: {submission.grade}/{question.totalMarks}
                    </div>

                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onView(submission._id)}
                    >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        View
                    </Button>
                </div>

                {submission.feedback && (
                    <p className="mt-1">{submission.feedback}</p>
                )}
            </div>
        );
    }

    // Submitted
    if (submission?.status === "submitted") {
        return (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3 text-sm">
                <span className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Submitted — awaiting review
                </span>

                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onView(submission._id)}
                >
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    View
                </Button>
            </div>
        );
    }

    // Exam in progress
    if (
        attempt?.status === "in_progress" &&
        !isExpired &&
        submission?.status !== "submitted"
    ) {
        return (
            <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                        Exam in progress
                    </span>

                    <ExamCountdown
                        expiresAt={attempt.expiresAt}
                        onExpire={() => {
                            // Let parent refetch if needed
                            window.location.reload();
                        }}
                    />
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() =>
                        onViewQuestion(question._id, attempt.expiresAt)
                    }
                >
                    <FileText className="mr-2 h-4 w-4" />
                    Open Question Paper
                    <ExternalLink className="ml-auto h-3.5 w-3.5" />
                </Button>

                <input
                    ref={input}
                    className="hidden"
                    type="file"
                    accept="application/pdf"
                    onChange={onUpload}
                />

                <Button
                    size="sm"
                    className="w-full"
                    disabled={busy}
                    onClick={() => input.current?.click()}
                >
                    <Upload className="mr-2 h-4 w-4" />
                    Submit Answer Sheet
                </Button>
            </div>
        );
    }

    // Expired without submission
    if (
        (attempt?.status === "expired" || isExpired) &&
        submission?.status !== "submitted"
    ) {
        return (
            <Badge variant="destructive">
                Time's up — no answer sheet was submitted
            </Badge>
        );
    }

    // Cannot start anymore
    if (isPastDue(question.dueDate)) {
        return (
            <Badge variant="destructive">
                The window to start this exam has closed
            </Badge>
        );
    }

    // Start exam
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Timer className="h-4 w-4" />
                {question.durationMinutes} min once started
            </span>

            <Button
                size="sm"
                disabled={busy}
                onClick={onStart}
            >
                {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Clock className="mr-2 h-4 w-4" />
                )}

                Start examination
            </Button>
        </div>
    );
}