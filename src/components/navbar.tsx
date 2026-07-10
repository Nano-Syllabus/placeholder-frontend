import { Link, useLocation } from "wouter";
import { Moon, Sun, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between">
        <div className="flex items-center gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="font-bold inline-block text-lg">CollabLearn</span>
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link 
              href="/viewer" 
              className={`text-sm font-medium transition-colors hover:text-primary ${location === '/viewer' ? 'text-primary' : 'text-muted-foreground'}`}
            >
              Student Viewer
            </Link>
            <Link 
              href="/dashboard" 
              className={`text-sm font-medium transition-colors hover:text-primary ${location === '/dashboard' ? 'text-primary' : 'text-muted-foreground'}`}
            >
              Teacher Dashboard
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
          <div className="md:hidden">
            {/* Mobile menu could go here */}
          </div>
        </div>
      </div>
    </header>
  );
}
