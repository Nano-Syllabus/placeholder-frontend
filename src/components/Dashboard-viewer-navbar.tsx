import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Bell, Sun, Moon, BookOpen, ClipboardCheck, User, Settings, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/lib/auth-context";

interface NavBarProps {
  /** Breadcrumb / title area shown right after the logo, e.g. "Course / Lecture 5" */
  centerContent?: ReactNode;
  showSearch?: boolean;
  searchPlaceholder?: string;
  /** Whether to show the red notification dot */
  hasNotifications?: boolean;
  /** Controlled popover open state — pass your own useState if the parent needs to react to it */
  notifOpen?: boolean;
  onNotifOpenChange?: (open: boolean) => void;
  /** Whatever you want rendered inside the notifications popover body */
  notificationContent?: ReactNode;
  /** Initials shown in the account avatar */
  avatarInitials?: string;
  className?: string;
}

export function NavBar({
  centerContent,

  
  hasNotifications = false,
  notifOpen,
  onNotifOpenChange,
  notificationContent,
  avatarInitials = "ST",
  className = "",
}: NavBarProps) {
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  return (
    <header className={`flex-none h-16 border-b bg-card flex items-center justify-between px-6 z-20 ${className}`}>
      <div className="flex items-center gap-4 min-w-0">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg hidden lg:inline">CollabLearn</span>
        </Link>
        {centerContent}
      </div>

   <div className="flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="sm" className="hidden sm:flex" onClick={() => setLocation("/questions")}>
          <ClipboardCheck className="mr-2 h-4 w-4" /> Assessments
        </Button>
        <Popover open={notifOpen} onOpenChange={onNotifOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground relative"
              data-testid="button-notifications"
            >
              <Bell className="h-5 w-5" />
              {hasNotifications && (
                <span className="absolute top-2 right-2.5 w-2 h-2 bg-destructive rounded-full" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            {notificationContent}
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          data-testid="button-theme-toggle"
        >
          <Sun className="h-[1.1rem] w-[1.1rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="h-9 w-9 cursor-pointer border">
              <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
                {avatarInitials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setLocation("/profile")}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLocation("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}