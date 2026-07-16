import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Viewer from "@/pages/viewer";
import Dashboard from "@/pages/dashboard";
import Login from "@/pages/login";
import DiscoverPage from "./pages/discover";
import Profile from "@/pages/profile";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import ViewerPage from "./pages/viewerPage";

const queryClient = new QueryClient();

function RequireAuth({ children, teacherOnly = false }: { children: React.ReactNode; teacherOnly?: boolean }) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate("/login"); return; }
    if (teacherOnly && user.role !== "teacher") { navigate("/viewer"); }
  }, [user, isLoading, teacherOnly, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;
  if (teacherOnly && user.role !== "teacher") return null;
  return <>{children}</>;
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && user) {
      navigate(user.role === "teacher" ? "/dashboard" : "/viewer");
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (user) return null;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <RequireGuest><Login /></RequireGuest>
      </Route>
      <Route path="/">
       <Home />
      </Route>
      <Route path="/viewer/:resourceId">
  <RequireAuth><ViewerPage /></RequireAuth>
</Route>
      <Route path="/dashboard">
        <RequireAuth teacherOnly><Dashboard /></RequireAuth>
      </Route>
     <Route path="/profile/:id?">
  <RequireAuth><Profile /></RequireAuth>
</Route>
      <Route path={"/discover"}>
        <RequireAuth><DiscoverPage/></RequireAuth>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="collablearn-theme">
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
