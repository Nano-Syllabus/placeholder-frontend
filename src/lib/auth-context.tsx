import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type Role = "student" | "teacher";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  bio: string;
  joinedDate: string;
}

interface LoginResult {
  success: boolean;
  error?: string;
  role?: Role;
}

interface RegisterResult {
  success: boolean;
  error?: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (name: string, email: string, password: string, role: Role) => Promise<RegisterResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";
const TOKEN_KEY = "auth_token";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

// Maps your Express /signin, /signup response.body.user -> frontend User shape
function toUser(raw: Record<string, unknown>): User {
  const name = String(raw.user_name ?? "");
  const createdAt = String(raw.createdAt ?? raw.created_at ?? "");
  return {
    id: String(raw._id ?? raw.id ?? ""),
    name,
    email: String(raw.email ?? ""),
    role: (raw.role as Role) ?? "student",
    avatar: getInitials(name),
    bio: String(raw.bio ?? ""),
    joinedDate: createdAt
      ? new Date(createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : "",
  };
}

export async function authFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const isFormData = options.body instanceof FormData;

  const headers: HeadersInit = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }), // ← critical line
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate session on load using stored token
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }

    authFetch("/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { body?: { user?: Record<string, unknown> } } | null) => {
        if (data?.body?.user) {
          setUser(toUser(data.body.user));
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      const res = await authFetch("/signin", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const data: { body?: { token?: string; user?: Record<string, unknown> }; error?: string; message?: string } =
        await res.json();

      if (res.ok && data.body?.token && data.body?.user) {
        localStorage.setItem(TOKEN_KEY, data.body.token);
        const u = toUser(data.body.user);
        setUser(u);
        return { success: true, role: u.role };
      }
      return { success: false, error: data.error ?? data.message ?? "Invalid email or password." };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string, role: Role): Promise<RegisterResult> => {
      try {
        const res = await authFetch("/signup", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            role,
            user_name: name,
            is_verified: false,
            is_active: true,
          }),
        });
        const data: { body?: { user?: Record<string, unknown> }; error?: string; message?: string } =
          await res.json();

        if (res.ok && data.body?.user) {
          // signup doesn't return a token, so log in right after to get one
          const loginResult = await login(email, password);
          return { success: loginResult.success, error: loginResult.error };
        }
        return { success: false, error: data.error ?? data.message ?? "Registration failed. Please try again." };
      } catch {
        return { success: false, error: "Network error. Please try again." };
      }
    },
    [login],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}