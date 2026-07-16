import { useState, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
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
  Camera, Building2, ShieldAlert, Clock, Loader2, FileCheck, ArrowLeft,
   Globe,
} from "lucide-react";
import { motion } from "framer-motion";

type VerificationStatus = "unverified" | "pending" | "verified";

interface SocialLinks {
  linkedin?: string;
  website?: string;
  facebook?: string;
  twitter?: string;
}

interface TeacherProfileRecord {
  designation: string;
  institution: string;
  verification_doc_url: string;
  verification_status: VerificationStatus;
  qualification?: string;
  years_experience?: number;
  subjects_taught?: string[];
}

interface ProfileStats {
  courses: number;
  resources: number;
  discussions: number;
}

// Shape of the raw user document as returned by the backend
// (GET /api/users/:id or the "user" part of GET /api/users/me).
interface RawUser {
  _id: string;
  id?: string;
  user_name: string;
  email: string;
  bio?: string;
  profile_pic?: string;
  role: "teacher" | "student";
  createdAt?: string;
  joinedDate?: string;
  social_links?: SocialLinks;
}

function initials(name: string) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatJoinedDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value; // already formatted, e.g. from useAuth()
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function Profile() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();

  const authUserId = (user as any)?.id ?? (user as any)?._id;
  const routeUserId = params.id;
  const isOwnProfile = !routeUserId || routeUserId === authUserId;

  // ---------------------------------------------------------------------
  // Data for the profile being VIEWED. For your own profile this mirrors
  // `user` from useAuth(). For someone else's profile it's fetched fresh
  // and read-only — no editable local overrides.
  // ---------------------------------------------------------------------
  const [viewedUser, setViewedUser] = useState<RawUser | null>(null);
  const [viewedTeacherProfile, setViewedTeacherProfile] = useState<TeacherProfileRecord | null>(null);
  const [viewedUserLoading, setViewedUserLoading] = useState(!isOwnProfile);
  const [viewedUserError, setViewedUserError] = useState<string | null>(null);

  useEffect(() => {
    if (isOwnProfile) {
      setViewedUser(null);
      setViewedUserError(null);
      return;
    }
    let cancelled = false;

    async function fetchPublicProfile() {
      setViewedUserLoading(true);
      setViewedUserError(null);
      try {
        const res = await authFetch(`/users/${routeUserId}`);
        if (!res.ok) {
          throw new Error(res.status === 404 ? "User not found" : "Could not load this profile");
        }
        const data = await res.json();
        if (cancelled) return;
        setViewedUser(data.body?.user ?? null);
        setViewedTeacherProfile(data.body?.teacherProfile ?? null);
      } catch (err) {
        if (!cancelled) {
          setViewedUserError(err instanceof Error ? err.message : "Could not load this profile");
        }
      } finally {
        if (!cancelled) setViewedUserLoading(false);
      }
    }

    fetchPublicProfile();
    return () => { cancelled = true; };
  }, [isOwnProfile, routeUserId]);

  // ---------------------------------------------------------------------
  // Editable state — only ever used/shown when isOwnProfile is true.
  // ---------------------------------------------------------------------
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>((user as any)?.profile_pic ?? null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [institution, setInstitution] = useState("");
  const [teacherTitle, setTeacherTitle] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("unverified");
  const [teacherProfileLoading, setTeacherProfileLoading] = useState(false);
  const [credentialFile, setCredentialFile] = useState<File | null>(null);
  const [verificationFormOpen, setVerificationFormOpen] = useState(false);
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const credentialInputRef = useRef<HTMLInputElement>(null);

  // Professional details (teacher-only, fetched together with the teacher profile).
  const [qualification, setQualification] = useState("");
  const [yearsExperience, setYearsExperience] = useState<string>("");
  // Kept as a comma-separated string while editing; split into an array on save.
  const [subjectsTaught, setSubjectsTaught] = useState<string>("");

  // Social links — available to any user, stored on the base profile.
  const [linkedin, setLinkedin] = useState((user as any)?.social_links?.linkedin ?? "");
  const [website, setWebsite] = useState((user as any)?.social_links?.website ?? "");
  const [facebook, setFacebook] = useState((user as any)?.social_links?.facebook ?? "");
  const [twitter, setTwitter] = useState((user as any)?.social_links?.twitter ?? "");

  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // isTeacher reflects whichever profile is being displayed.
  const isTeacher = isOwnProfile ? user?.role === "teacher" : viewedUser?.role === "teacher";

  // GET /api/users/me/teacher-profile — only for your own teacher profile.
  useEffect(() => {
    if (!isOwnProfile || !isTeacher) return;
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
        setQualification(profile.qualification ?? "");
        setYearsExperience(
          profile.years_experience !== undefined && profile.years_experience !== null
            ? String(profile.years_experience)
            : ""
        );
        setSubjectsTaught((profile.subjects_taught ?? []).join(", "));
      } catch (err) {
        console.error("Failed to load teacher profile:", err);
      } finally {
        if (!cancelled) setTeacherProfileLoading(false);
      }
    }

    fetchTeacherProfile();
    return () => { cancelled = true; };
  }, [isOwnProfile, isTeacher]);

  // Real stats scoped to the logged-in user — only meaningful for your own
  // profile, since it's computed from data visible to (and filtered by)
  // the current viewer. Skipped entirely when viewing someone else.
  useEffect(() => {
    if (!isOwnProfile || !user) return;
    let cancelled = false;

    async function fetchStats() {
      setStatsLoading(true);
      try {
        const [coursesRes, resourcesRes] = await Promise.all([
          authFetch("/courses"),
          authFetch("/courses/resources/all"),
        ]);

        const coursesData = await coursesRes.json().catch(() => null);
        const courses = coursesData?.body?.courses ?? [];

        const resourcesData = await resourcesRes.json().catch(() => null);
        const resources: any[] =
          resourcesData?.data?.resources ?? resourcesData?.data ?? [];

        const discussionCounts = await Promise.all(
          resources.map(async (r) => {
            try {
              const dRes = await authFetch(`/discussions?resource=${r._id}`);
              if (!dRes.ok) return 0;
              const dData = await dRes.json();
              const list: any[] = dData?.data ?? [];
              return list.filter((d) => {
                const authorId = typeof d.user === "string" ? d.user : d.user?._id;
                return authorId === (user as any).id || authorId === (user as any)._id;
              }).length;
            } catch {
              return 0;
            }
          })
        );

        if (cancelled) return;

        setStats({
          courses: courses.length,
          resources: resources.length,
          discussions: discussionCounts.reduce((a, b) => a + b, 0),
        });
      } catch (err) {
        console.error("Failed to load profile stats:", err);
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }

    fetchStats();
    return () => { cancelled = true; };
  }, [isOwnProfile, user]);

  if (isOwnProfile && !user) return null;
  if (!isOwnProfile && viewedUserLoading) {
    return (
      <div className="min-h-screen bg-muted/20">
        <Navbar />
        <div className="container mx-auto max-w-3xl px-4 py-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }
  if (!isOwnProfile && (viewedUserError || !viewedUser)) {
    return (
      <div className="min-h-screen bg-muted/20">
        <Navbar />
        <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-muted-foreground">{viewedUserError ?? "This profile couldn't be found."}</p>
          <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => navigate("/discover")}>
            <ArrowLeft className="h-4 w-4" /> Back to Discover
          </Button>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleSave = async () => {
    setIsSavingProfile(true);
    setProfileSaveError(null);
    try {
      const parsedYearsExperience = yearsExperience.trim() === "" ? null : Number(yearsExperience);
      const parsedSubjectsTaught = subjectsTaught
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await authFetch("/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bio,
          designation: teacherTitle,
          institution,
          qualification,
          years_experience: parsedYearsExperience,
          subjects_taught: parsedSubjectsTaught,
          social_links: {
            linkedin,
            website,
            facebook,
            twitter,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? `Request failed with status ${res.status}`);
      }

      const data = await res.json();
      const profile: TeacherProfileRecord | undefined = data.body?.teacherProfile;
      if (profile) {
        setInstitution(profile.institution ?? "");
        setTeacherTitle(profile.designation ?? "");
        setQualification(profile.qualification ?? "");
        setYearsExperience(
          profile.years_experience !== undefined && profile.years_experience !== null
            ? String(profile.years_experience)
            : ""
        );
        setSubjectsTaught((profile.subjects_taught ?? []).join(", "));
      }
      setEditing(false);
    } catch (err) {
      console.error("Failed to save profile:", err);
      setProfileSaveError(err instanceof Error ? err.message : "Failed to save profile");
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

  // ---------------------------------------------------------------------
  // Unified display fields — own profile pulls from editable local state,
  // someone else's profile pulls straight from the fetched read-only data.
  // ---------------------------------------------------------------------
  const displayName = isOwnProfile ? name : (viewedUser?.user_name ?? "Unknown");
  const displayEmail = isOwnProfile ? user?.email : viewedUser?.email;
  const displayBio = isOwnProfile ? bio : (viewedUser?.bio ?? "");
  const displayAvatarUrl = isOwnProfile ? avatarUrl : (viewedUser?.profile_pic ?? null);
  const displayJoinedDate = isOwnProfile
    ? (user as any)?.joinedDate
    : formatJoinedDate(viewedUser?.createdAt);
  const displayInitials = isOwnProfile ? (user as any)?.avatar ?? initials(name) : initials(displayName);
  const displayVerificationStatus: VerificationStatus = isOwnProfile
    ? verificationStatus
    : (viewedTeacherProfile?.verification_status ?? "unverified");
  const displayInstitution = isOwnProfile ? institution : (viewedTeacherProfile?.institution ?? "");
  const displayTeacherTitle = isOwnProfile ? teacherTitle : (viewedTeacherProfile?.designation ?? "");
  const displayQualification = isOwnProfile ? qualification : (viewedTeacherProfile?.qualification ?? "");
  const displayYearsExperience = isOwnProfile
    ? yearsExperience
    : (viewedTeacherProfile?.years_experience !== undefined && viewedTeacherProfile?.years_experience !== null
        ? String(viewedTeacherProfile.years_experience)
        : "");
  const displaySubjectsTaught = isOwnProfile
    ? subjectsTaught
    : (viewedTeacherProfile?.subjects_taught ?? []).join(", ");
  const displaySocialLinks: SocialLinks = isOwnProfile
    ? { linkedin, website, facebook, twitter }
    : (viewedUser?.social_links ?? {});

  const statLabels = isTeacher
    ? [
        { key: "courses" as const, label: "Courses", icon: BookOpen },
        { key: "resources" as const, label: "Resources uploaded", icon: FileText },
        { key: "discussions" as const, label: "Student discussions", icon: MessageSquare },
      ]
    : [
        { key: "courses" as const, label: "Enrolled courses", icon: BookOpen },
        { key: "resources" as const, label: "Resources available", icon: FileText },
        { key: "discussions" as const, label: "Your discussions", icon: MessageSquare },
      ];

  const roleColor = isTeacher
    ? "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300"
    : "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300";

  const hasSocialLinks = Boolean(
    displaySocialLinks.linkedin || displaySocialLinks.website || displaySocialLinks.facebook || displaySocialLinks.twitter
  );

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
          {!isOwnProfile && (
            <Button
              variant="ghost"
              size="sm"
              className="self-start gap-2 -mb-2"
              onClick={() => window.history.length > 1 ? window.history.back() : navigate("/discover")}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          )}

          {/* Profile card */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className={`h-28 ${isTeacher ? "bg-gradient-to-r from-violet-500 to-indigo-500" : "bg-gradient-to-r from-indigo-500 to-blue-500"}`} />
            <CardContent className="pt-0 pb-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end -mt-10 mb-5">
                <div className="relative shrink-0">
                  <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                    {displayAvatarUrl && <AvatarImage src={displayAvatarUrl} alt={displayName} />}
                    <AvatarFallback className={`text-xl font-bold ${isTeacher ? "bg-violet-100 text-violet-700" : "bg-indigo-100 text-indigo-700"}`}>
                      {displayInitials}
                    </AvatarFallback>
                  </Avatar>
                  {isOwnProfile && (
                    <>
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
                    </>
                  )}
                </div>
                <div className="flex-1 flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-1">
                  <div>
                    {editing && isOwnProfile ? (
                      <Input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="h-8 text-xl font-bold w-64 mb-1"
                      />
                    ) : (
                      <h2 className="text-xl font-bold">{displayName}</h2>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className={`flex items-center gap-1 ${roleColor}`}>
                        {isTeacher ? <Presentation className="h-3 w-3" /> : <GraduationCap className="h-3 w-3" />}
                        {isTeacher ? "Teacher" : "Student"}
                      </Badge>
                      {isTeacher && displayVerificationStatus === "verified" && (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-xs flex gap-1 items-center">
                          <ShieldCheck className="h-3 w-3" /> Verified
                        </Badge>
                      )}
                      {isTeacher && displayVerificationStatus === "pending" && isOwnProfile && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-xs flex gap-1 items-center">
                          <Clock className="h-3 w-3" /> Verification pending
                        </Badge>
                      )}
                      {isTeacher && displayVerificationStatus === "unverified" && isOwnProfile && (
                        <Badge variant="outline" className="text-muted-foreground text-xs flex gap-1 items-center">
                          <ShieldAlert className="h-3 w-3" /> Not verified
                        </Badge>
                      )}
                    </div>
                  </div>
                  {isOwnProfile && (
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
                  )}
                </div>
              </div>

              {isOwnProfile && avatarError && <p className="text-xs text-destructive mb-3">{avatarError}</p>}
              {isOwnProfile && profileSaveError && <p className="text-xs text-destructive mb-3">{profileSaveError}</p>}

              <div className="flex flex-col gap-3">
                {isOwnProfile && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{displayEmail}</span>
                  </div>
                )}
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Joined {displayJoinedDate}</span>
                </div>
                {isTeacher && displayVerificationStatus === "verified" && displayInstitution && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{displayTeacherTitle} at {displayInstitution}</span>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground font-medium">Bio</Label>
                  {editing && isOwnProfile ? (
                    <Textarea
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      className="resize-none text-sm"
                      rows={2}
                    />
                  ) : (
                    <p className="text-sm text-foreground leading-relaxed">
                      {displayBio || (isOwnProfile ? "" : "This user hasn't added a bio yet.")}
                    </p>
                  )}
                </div>

                {/* Professional details — teacher only */}
                {isTeacher && (editing && isOwnProfile ? (
                  <div className="grid sm:grid-cols-2 gap-3 pt-1">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="qualification" className="text-xs text-muted-foreground font-medium">Qualification</Label>
                      <Input
                        id="qualification"
                        placeholder="e.g. PhD in Computer Science"
                        value={qualification}
                        onChange={e => setQualification(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="years-experience" className="text-xs text-muted-foreground font-medium">Years of experience</Label>
                      <Input
                        id="years-experience"
                        type="number"
                        min={0}
                        placeholder="e.g. 5"
                        value={yearsExperience}
                        onChange={e => setYearsExperience(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <Label htmlFor="subjects-taught" className="text-xs text-muted-foreground font-medium">Subjects taught</Label>
                      <Input
                        id="subjects-taught"
                        placeholder="Comma separated, e.g. Algorithms, Data Structures"
                        value={subjectsTaught}
                        onChange={e => setSubjectsTaught(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  (displayQualification || displayYearsExperience || displaySubjectsTaught) && (
                    <div className="flex flex-col gap-1.5 pt-1 text-sm">
                      {displayQualification && (
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <GraduationCap className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>{displayQualification}</span>
                        </div>
                      )}
                      {displayYearsExperience && (
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>{displayYearsExperience} years of experience</span>
                        </div>
                      )}
                      {displaySubjectsTaught && (
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <BookOpen className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>{displaySubjectsTaught}</span>
                        </div>
                      )}
                    </div>
                  )
                ))}

                {/* Social links — any user */}
                {editing && isOwnProfile ? (
                  <div className="grid sm:grid-cols-2 gap-3 pt-1">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="linkedin" className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        LinkedIn
                      </Label>
                      <Input
                        id="linkedin"
                        placeholder="https://linkedin.com/in/..."
                        value={linkedin}
                        onChange={e => setLinkedin(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="website" className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <Globe className="h-3 w-3" /> Website
                      </Label>
                      <Input
                        id="website"
                        placeholder="https://yoursite.com"
                        value={website}
                        onChange={e => setWebsite(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="facebook" className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        Facebook
                      </Label>
                      <Input
                        id="facebook"
                        placeholder="https://facebook.com/..."
                        value={facebook}
                        onChange={e => setFacebook(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="twitter" className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                     Twitter / X
                      </Label>
                      <Input
                        id="twitter"
                        placeholder="https://x.com/..."
                        value={twitter}
                        onChange={e => setTwitter(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  hasSocialLinks && (
                    <div className="flex items-center gap-3 pt-1">
                      {displaySocialLinks.linkedin && (
                        <a href={displaySocialLinks.linkedin} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" title="LinkedIn">
                        
                        </a>
                      )}
                      {displaySocialLinks.website && (
                        <a href={displaySocialLinks.website} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" title="Website">
                          <Globe className="h-4 w-4" />
                        </a>
                      )}
                      {displaySocialLinks.facebook && (
                        <a href={displaySocialLinks.facebook} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" title="Facebook">
                         
                        </a>
                      )}
                      {displaySocialLinks.twitter && (
                        <a href={displaySocialLinks.twitter} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" title="Twitter / X">
                      
                        </a>
                      )}
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>

          {/* Teacher verification — submission form only ever shown on your own profile */}
          {isOwnProfile && isTeacher && (
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

          {/* Stats — only computable for your own profile right now */}
          {isOwnProfile && (
            <div className="grid grid-cols-3 gap-4">
              {statLabels.map(({ key, label, icon: Icon }) => (
                <Card key={key} className="border-0 shadow-sm">
                  <CardContent className="p-4 flex flex-col items-center text-center gap-1">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-1 ${isTeacher ? "bg-violet-100 dark:bg-violet-900/30" : "bg-indigo-100 dark:bg-indigo-900/30"}`}>
                      <Icon className={`h-4 w-4 ${isTeacher ? "text-violet-600" : "text-indigo-600"}`} />
                    </div>
                    <span className="text-2xl font-bold">
                      {statsLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : stats ? stats[key] : "—"}
                    </span>
                    <span className="text-xs text-muted-foreground leading-tight">{label}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Access & permissions — describes the viewer's own access, so own-profile only */}
          {isOwnProfile && (
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
          )}

          {/* Quick navigation */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick navigation</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {isOwnProfile ? (
                <>
                  {isTeacher ? (
                    <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
                      <Presentation className="h-4 w-4" /> Dashboard
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => navigate("/courses")} className="gap-2">
                      <FileText className="h-4 w-4" /> Browse Resources
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => navigate("/")} className="gap-2">
                    <BookOpen className="h-4 w-4" /> Home
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => navigate("/discover")} className="gap-2">
                  <BookOpen className="h-4 w-4" /> Back to Discover
                </Button>
              )}
            </CardContent>
          </Card>

          {isOwnProfile && (
            <>
              <Separator />
              <div className="flex justify-end">
                <Button variant="destructive" onClick={handleLogout} className="gap-2">
                  <LogOut className="h-4 w-4" /> Sign out
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}