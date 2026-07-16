import { useState } from "react";
import { useLocation } from "wouter";
import { BookOpen, Eye, EyeOff, Loader2, GraduationCap, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth, type Role } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";

type Tab = "login" | "register";

const ROLES = [
  {
    role: "teacher" as Role,
    label: "Teacher",
    icon: Presentation,
    color: "text-violet-600",
    bg: "bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800",
    ring: "ring-violet-400",
    badgeClass: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300",
  },
  {
    role: "student" as Role,
    label: "Student",
    icon: GraduationCap,
    color: "text-indigo-600",
    bg: "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800",
    ring: "ring-indigo-400",
    badgeClass: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300",
  },
];

export default function Login() {
  const { login, register } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("login");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState<Role>("student");
  const [showRegPw, setShowRegPw] = useState(false);
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  const redirectAfterAuth = (role: Role) =>
    navigate(role === "teacher" ? "/dashboard" : "/discover");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    const result = await login(loginEmail, loginPassword);
    setLoginLoading(false);
    if (result.success) {
      redirectAfterAuth(result.role ?? "student");
    } else {
      setLoginError(result.error ?? "Login failed.");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) { setRegError("Please enter your full name."); return; }
    if (regPassword.length < 6) { setRegError("Password must be at least 6 characters."); return; }
    setRegError("");
    setRegLoading(true);
    const result = await register(regName, regEmail, regPassword, regRole);
    setRegLoading(false);
    if (result.success) {
      redirectAfterAuth(regRole);
    } else {
      setRegError(result.error ?? "Registration failed.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold mt-1">CollabLearn</h1>
          <p className="text-muted-foreground text-sm">Teacher-Student Collaborative Platform</p>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur overflow-hidden">
          <div className="flex border-b">
            {(["login", "register"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setLoginError(""); setRegError(""); }}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                  tab === t
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <CardContent className="p-6">
            <AnimatePresence mode="wait">
              {tab === "login" ? (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleLogin}
                  className="flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      placeholder="your@email.com"
                      value={loginEmail}
                      onChange={(e) => { setLoginEmail(e.target.value); setLoginError(""); }}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showLoginPw ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => { setLoginPassword(e.target.value); setLoginError(""); }}
                        className="pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showLoginPw ? "Hide password" : "Show password"}
                      >
                        {showLoginPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {loginError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2"
                      >
                        {loginError}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <Button type="submit" className="w-full h-10 mt-1" disabled={loginLoading}>
                    {loginLoading
                      ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Signing in...</>
                      : "Sign in"}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setTab("register")}
                      className="text-primary font-medium hover:underline"
                    >
                      Create one
                    </button>
                  </p>
                </motion.form>
              ) : (
                <motion.form
                  key="register"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleRegister}
                  className="flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground font-medium">I am a...</p>
                    <div className="grid grid-cols-2 gap-2">
                      {ROLES.map(({ role, label, icon: Icon, color, bg, ring, badgeClass }) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setRegRole(role)}
                          className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left ${
                            regRole === role
                              ? `${bg} ring-2 ring-offset-1 ${ring}`
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <Icon className={`h-5 w-5 shrink-0 ${regRole === role ? color : "text-muted-foreground"}`} />
                          <div>
                            <span className={`font-semibold text-sm ${regRole === role ? "" : "text-muted-foreground"}`}>
                              {label}
                            </span>
                            {regRole === role && (
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ml-1.5 ${badgeClass}`}>
                                {role}
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="reg-name">Full name</Label>
                    <Input
                      id="reg-name"
                      type="text"
                      autoComplete="name"
                      placeholder="Jane Doe"
                      value={regName}
                      onChange={(e) => { setRegName(e.target.value); setRegError(""); }}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      autoComplete="email"
                      placeholder="your@email.com"
                      value={regEmail}
                      onChange={(e) => { setRegEmail(e.target.value); setRegError(""); }}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="reg-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="reg-password"
                        type={showRegPw ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Min. 6 characters"
                        value={regPassword}
                        onChange={(e) => { setRegPassword(e.target.value); setRegError(""); }}
                        className="pr-10"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showRegPw ? "Hide password" : "Show password"}
                      >
                        {showRegPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {regError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2"
                      >
                        {regError}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <Button type="submit" className="w-full h-10 mt-1" disabled={regLoading}>
                    {regLoading
                      ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating account...</>
                      : `Create ${regRole} account`}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setTab("login")}
                      className="text-primary font-medium hover:underline"
                    >
                      Sign in
                    </button>
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
