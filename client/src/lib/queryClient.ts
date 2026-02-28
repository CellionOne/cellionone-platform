import { QueryClient, QueryFunction } from "@tanstack/react-query";

let csrfToken: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  try {
    const res = await fetch("/api/csrf-token", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      csrfToken = data.csrfToken;
      return csrfToken!;
    }
  } catch (e) {
    // Fall through
  }
  return "";
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 403) {
      const text = await res.text();
      if (text.includes("CSRF")) {
        csrfToken = null;
      }
      throw new Error(`${res.status}: ${text}`);
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (!safeMethods.includes(method.toUpperCase())) {
    const token = await getCsrfToken();
    if (token) {
      headers["X-CSRF-Token"] = token;
    }
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
