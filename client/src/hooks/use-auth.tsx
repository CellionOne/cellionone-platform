import { useQuery } from "@tanstack/react-query";

export interface AuthUser {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  roles?: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}

export function useAuth(): AuthContextValue {
  const { data, isLoading, error } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (e) {
      // Ignore errors
    }
    window.location.href = "/login";
  };

  return {
    user: data || null,
    isLoading,
    isAuthenticated: !!data && !error,
    logout,
  };
}
