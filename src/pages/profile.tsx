import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth, authFetch } from "@/lib/auth-context";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  GraduationCap, Presentation, BookOpen, MessageSquare,
  FileText, Calendar, Mail, LogOut, Edit2, Check, X, ShieldCheck,
  Camera, Building2, ShieldAlert, Clock, Loader2, FileCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import { MOCK_RESOURCES, INITIAL_DISCUSSIONS } from "@/lib/mock-data";

type VerificationStatus = "unverified" | "pending" | "verified";

interface TeacherProfileRecord {
  designation: string;
  institution: string;
  verification_doc_url: string;
  verification_status: VerificationStatus;
}

export default function Profile() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);

  // Avatar upload — still lives on User.profile_pic
  const [avatarUrl, setAvatarUrl] = useState<string | null>((user as any)?.profile_pic ?? null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Teacher verification — now a separate TeacherProfile record, fetched
  // fresh on mount rather than pulled off the useAuth() user object, since
  // it lives in its own Mongo collection.
  const [institution, setInstitution] = useState("");
  const [teacherTitle, setTeacherTitle] = useState(""); // maps to TeacherProfile.designation
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("unverified");
  const [teacherProfileLoading, setTeacherProfileLoading] = useState(false);
  const [credentialFile, setCredentialFile] = useState<File | null>(null);
  const [verificationFormOpen, setVerificationFormOpen] = useState(false);
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const credentialInputRef = useRef<HTMLInputElement>(null);

  const isTeacher = user?.role === "teacher";

  // GET /api/users/me/teacher-profile — only called for teachers, since
  // there's no StudentProfile model and the endpoint 403s for students.
  useEffect(() => {
    if (!isTeacher) return;
    let cancelled = false;

    async function fetchTeacherProfile() {
      setTeacherProfileLoading(true);
      try {
        const res = await authFetch("/users/me/teacher-profile", { method: "GET" });
        if (!res.ok) return;
        const data = await res.json();
        const profile: TeacherProfileRecord | null = data.body?.teacherProfile;
        if (cancelled || !profile) return;
        setInstitution(profile.institution ?? "");
        setTeacherTitle(profile.designation ?? "");
        setVerificationStatus(profile.verification_status ?? "unverified");
      } catch (err) {
        console.error("Failed to load teacher profile:", err);
      } finally {
        if (!cancelled) setTeacherProfileLoading(false);
      }
    }

    fetchTeacherProfile();
    return () => { cancelled = true; };
  }, [isTeacher]);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // PATCH /api/users/me — sends user_name (not "name") to match the backend.
  const handleSave = async () => {
    setIsSavingProfile(true);
    setProfileSaveError(null);
    try {
      const res = await authFetch("/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: name.trim(), bio: bio.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Request failed with status ${res.status}`);
      }
      setEditing(false);
    } catch (err) {
      console.error("Failed to save profile:", err);
      setProfileSaveError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAvatarError("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Image is too large. Max size is 5MB.");
      return;
    }

    setAvatarError(null);
    setIsUploadingAvatar(true);

    const localPreview = URL.createObjectURL(file);
    setAvatarUrl(localPreview);

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await authFetch("/users/me/avatar", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Request failed with status ${res.status}`);
      }

      const data = await res.json();
      setAvatarUrl(data.body.user.profile_pic);
    } catch (err) {
      console.error("Failed to upload avatar:", err);
      setAvatarError(err instanceof Error ? err.message : "Failed to upload photo");
      setAvatarUrl((user as any)?.profile_pic ?? null);
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleCredentialSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPdf = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) {
      setVerificationError("Please upload a PDF or image of your credential.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setVerificationError("File is too large. Max size is 10MB.");
      return;
    }
    setVerificationError(null);
    setCredentialFile(file);
  };

  // POST /api/users/me/verification — upserts TeacherProfile server-side.
  const handleSubmitVerification = async () => {
    if (!institution.trim() || !teacherTitle.trim()) return;

    setIsSubmittingVerification(true);
    setVerificationError(null);

    try {
      const formData = new FormData();
      formData.append("institution", institution.trim());
      formData.append("title", teacherTitle.trim());
      if (credentialFile) formData.append("credential", credentialFile);

      const res = await authFetch("/users/me/verification", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Request failed with status ${res.status}`);
      }

      const data = await res.json();
      const profile: TeacherProfileRecord = data.body.teacherProfile;
      setInstitution(profile.institution);
      setTeacherTitle(profile.designation);
      setVerificationStatus(profile.verification_status);
      setVerificationFormOpen(false);
      setCredentialFile(null);
    } catch (err) {
      console.error("Failed to submit verification:", err);
      setVerificationError(err instanceof Error ? err.message : "Failed to submit for review");
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  const resourceCount = MOCK_RESOURCES.length;
  const discussionCount = INITIAL_DISCUSSIONS.filter(d => d.resourceId).length;

  const stats = isTeacher
    ? [
        { label: "Courses", value: "5", icon: BookOpen },
        { label: "Resources uploaded", value: String(resourceCount), icon: FileText },
        { label: "Student discussions", value: String(discussionCount), icon: MessageSquare },
      ]
    : [
        { label: "Enrolled courses", value: "4", icon: BookOpen },
        { label: "Discussions started", value: "3", icon: MessageSquare },
        { label: "Replies given", value: "7", icon: MessageSquare },
      ];

  const roleColor = isTeacher
    ? "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300"
    : "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300";

  return (
    <div className="min-h-screen bg-muted/20">
      <Navbar />
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col gap-6"
        >
          {/* Profile card */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className={`h-28 ${isTeacher ? "bg-gradient-to-r from-violet-500 to-indigo-500" : "bg-gradient-to-r from-indigo-500 to-blue-500"}`} />
            <CardContent className="pt-0 pb-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end -mt-10 mb-5">
                <div className="relative shrink-0">
                  <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
                    <AvatarFallback className={`text-xl font-bold ${isTeacher ? "bg-violet-100 text-violet-700" : "bg-indigo-100 text-indigo-700"}`}>
                      {user.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarSelect}
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center border-2 border-background hover:bg-primary/90 transition-colors disabled:opacity-60"
                    title="Change profile photo"
                  >
                    {isUploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="flex-1 flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-1">
                  <div>
                    {editing ? (
                      <Input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="h-8 text-xl font-bold w-64 mb-1"
                      />
                    ) : (
                      <h2 className="text-xl font-bold">{name}</h2>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className={`flex items-center gap-1 ${roleColor}`}>
                        {isTeacher ? <Presentation className="h-3 w-3" /> : <GraduationCap className="h-3 w-3" />}
                        {isTeacher ? "Teacher" : "Student"}
                      </Badge>
                      {isTeacher && verificationStatus === "verified" && (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-xs flex gap-1 items-center">
                          <ShieldCheck className="h-3 w-3" /> Verified
                        </Badge>
                      )}
                      {isTeacher && verificationStatus === "pending" && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-xs flex gap-1 items-center">
                          <Clock className="h-3 w-3" /> Verification pending
                        </Badge>
                      )}
                      {isTeacher && verificationStatus === "unverified" && (
                        <Badge variant="outline" className="text-muted-foreground text-xs flex gap-1 items-center">
                          <ShieldAlert className="h-3 w-3" /> Not verified
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {editing ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setEditing(false); setProfileSaveError(null); }} disabled={isSavingProfile}>
                          <X className="h-3.5 w-3.5 mr-1" /> Cancel
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={isSavingProfile || !name.trim()}>
                          {isSavingProfile ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                          {isSavingProfile ? "Saving..." : "Save"}
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                        <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit profile
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {avatarError && <p className="text-xs text-destructive mb-3">{avatarError}</p>}
              {profileSaveError && <p className="text-xs text-destructive mb-3">{profileSaveError}</p>}

              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{user.email}</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Joined {user.joinedDate}</span>
                </div>
                {isTeacher && verificationStatus === "verified" && institution && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{teacherTitle} at {institution}</span>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground font-medium">Bio</Label>
                  {editing ? (
                    <Textarea
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      className="resize-none text-sm"
                      rows={2}
                    />
                  ) : (
                    <p className="text-sm text-foreground leading-relaxed">{bio}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Teacher verification */}
          {isTeacher && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Teacher Verification
                  </span>
                  {verificationStatus === "verified" && (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-xs flex gap-1 items-center">
                      <ShieldCheck className="h-3 w-3" /> Verified
                    </Badge>
                  )}
                  {verificationStatus === "pending" && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-xs flex gap-1 items-center">
                      <Clock className="h-3 w-3" /> Pending review
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {teacherProfileLoading ? (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-6">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                ) : verificationStatus === "verified" ? (
                  <div className="flex flex-col gap-2 text-sm">
                    <p className="text-muted-foreground">Your identity has been verified.</p>
                    <div className="flex items-center gap-2 text-foreground">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{teacherTitle} at {institution}</span>
                    </div>
                  </div>
                ) : verificationStatus === "pending" && !verificationFormOpen ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                      Your verification request for <span className="font-medium text-foreground">{teacherTitle} at {institution}</span> is under review. This usually takes 1–2 business days.
                    </p>
                    <Button size="sm" variant="outline" className="self-start" onClick={() => setVerificationFormOpen(true)}>
                      Update submission
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-muted-foreground">
                      Verified teachers get a badge on their profile and course pages, so students know who's confirmed. Submit your institution and a credential document for review.
                    </p>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="institution">Institution</Label>
                      <Input
                        id="institution"
                        placeholder="e.g. Tribhuvan University"
                        value={institution}
                        onChange={e => setInstitution(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="teacher-title">Title / role</Label>
                      <Input
                        id="teacher-title"
                        placeholder="e.g. Assistant Professor, Computer Science"
                        value={teacherTitle}
                        onChange={e => setTeacherTitle(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Credential document (ID, faculty card, or appointment letter)</Label>
                      <input
                        ref={credentialInputRef}
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        onChange={handleCredentialSelect}
                      />
                      {credentialFile ? (
                        <div className="border rounded-lg p-3 flex items-center gap-3 bg-muted/30">
                          <FileCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{credentialFile.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(credentialFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setCredentialFile(null);
                              if (credentialInputRef.current) credentialInputRef.current.value = "";
                            }}
                            className="text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => credentialInputRef.current?.click()}
                          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-5 text-center hover:border-primary/50 transition-colors cursor-pointer"
                        >
                          <FileText className="h-6 w-6 mx-auto text-muted-foreground mb-1.5" />
                          <p className="text-sm text-muted-foreground">Click to upload PDF or image</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">Max 10MB · optional but speeds up review</p>
                        </div>
                      )}
                    </div>
                    {verificationError && <p className="text-xs text-destructive">{verificationError}</p>}
                    <div className="flex gap-2 justify-end">
                      {verificationFormOpen && (
                        <Button size="sm" variant="outline" onClick={() => setVerificationFormOpen(false)} disabled={isSubmittingVerification}>
                          Cancel
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={handleSubmitVerification}
                        disabled={!institution.trim() || !teacherTitle.trim() || isSubmittingVerification}
                      >
                        {isSubmittingVerification ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                        {isSubmittingVerification ? "Submitting..." : "Submit for review"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {stats.map(({ label, value, icon: Icon }) => (
              <Card key={label} className="border-0 shadow-sm">
                <CardContent className="p-4 flex flex-col items-center text-center gap-1">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-1 ${isTeacher ? "bg-violet-100 dark:bg-violet-900/30" : "bg-indigo-100 dark:bg-indigo-900/30"}`}>
                    <Icon className={`h-4 w-4 ${isTeacher ? "text-violet-600" : "text-indigo-600"}`} />
                  </div>
                  <span className="text-2xl font-bold">{value}</span>
                  <span className="text-xs text-muted-foreground leading-tight">{label}</span>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Access & permissions */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Access & Permissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {[
                  { label: "View course PDFs", allowed: true },
                  { label: "Place discussion pins", allowed: true },
                  { label: "Reply to discussions", allowed: true },
                  { label: "Upload resources", allowed: isTeacher },
                  { label: "Create courses", allowed: isTeacher },
                  { label: "Access teacher dashboard", allowed: isTeacher },
                  { label: "Manage student activity", allowed: isTeacher },
                ].map(({ label, allowed }) => (
                  <div key={label} className="flex items-center justify-between py-1">
                    <span className="text-sm">{label}</span>
                    {allowed ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-xs flex gap-1 items-center">
                        <Check className="h-3 w-3" /> Allowed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-xs flex gap-1 items-center">
                        <X className="h-3 w-3" /> Restricted
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick navigation */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick navigation</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/viewer")} className="gap-2">
                <FileText className="h-4 w-4" /> Open Viewer
              </Button>
              {isTeacher && (
                <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
                  <Presentation className="h-4 w-4" /> Dashboard
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => navigate("/")} className="gap-2">
                <BookOpen className="h-4 w-4" /> Home
              </Button>
            </CardContent>
          </Card>

          <Separator />

          {/* Sign out */}
          <div className="flex justify-end">
            <Button variant="destructive" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}