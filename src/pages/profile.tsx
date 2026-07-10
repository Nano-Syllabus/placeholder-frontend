import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  GraduationCap, Presentation, BookOpen, MessageSquare,
  FileText, Calendar, Mail, LogOut, Edit2, Check, X, ShieldCheck
} from "lucide-react";
import { motion } from "framer-motion";
import { MOCK_RESOURCES, INITIAL_DISCUSSIONS } from "@/lib/mock-data";

export default function Profile() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");

  if (!user) return null;

  const isTeacher = user.role === "teacher";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleSave = () => {
    setEditing(false);
  };

  // const userDiscussions = INITIAL_DISCUSSIONS.filter(
  //   d => d.user.name === user.name || (user.role === "student" && d.user.avatar === "AC")
  // );
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
            {/* Banner */}
            <div className={`h-28 ${isTeacher ? "bg-gradient-to-r from-violet-500 to-indigo-500" : "bg-gradient-to-r from-indigo-500 to-blue-500"}`} />
            <CardContent className="pt-0 pb-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end -mt-10 mb-5">
                <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                  <AvatarFallback className={`text-xl font-bold ${isTeacher ? "bg-violet-100 text-violet-700" : "bg-indigo-100 text-indigo-700"}`}>
                    {user.avatar}
                  </AvatarFallback>
                </Avatar>
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
                      {/* {user.course && (
                        <Badge variant="secondary" className="text-xs">{user.course}</Badge>
                      )} */}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {editing ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                          <X className="h-3.5 w-3.5 mr-1" /> Cancel
                        </Button>
                        <Button size="sm" onClick={handleSave}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Save
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

              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{user.email}</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Joined {user.joinedDate}</span>
                </div>
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
