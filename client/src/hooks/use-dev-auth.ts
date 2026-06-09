import { useQuery } from "@tanstack/react-query";

export interface DevOrg {
  id: number;
  name: string;
  email: string;
  tier: string | null;
  sandboxOnly: boolean | null;
  isApproved: boolean | null;
  orgType: string | null;
  website: string | null;
  country: string | null;
  createdAt: string | null;
}

export function useDevAuth() {
  const { data: devOrg, isLoading } = useQuery<DevOrg>({
    queryKey: ["/api/developers/me"],
    retry: false,
    staleTime: 30_000,
  });
  return { devOrg: devOrg ?? null, isLoading, isAuthenticated: !!devOrg };
}
