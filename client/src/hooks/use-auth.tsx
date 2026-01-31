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

  const logout = () => {
    window.location.href = "/api/logout";
  };

  return {
    user: data || null,
    isLoading,
    isAuthenticated: !!data && !error,
    logout,
  };
}
