import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { getUnsyncedDrafts, syncDrafts } from "@/lib/offline-drafts";

export function OfflineSyncStatus() {
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const checkUnsynced = async () => {
      try {
        const drafts = await getUnsyncedDrafts();
        setUnsyncedCount(drafts.length);
      } catch {
        setUnsyncedCount(0);
      }
    };

    checkUnsynced();
    const interval = setInterval(checkUnsynced, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    if (!isOnline) {
      toast({
        title: "Offline",
        description: "Cannot sync while offline. Please connect to the internet.",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncDrafts();
      const drafts = await getUnsyncedDrafts();
      setUnsyncedCount(drafts.length);

      if (result.synced > 0) {
        toast({
          title: "Sync Complete",
          description: `Successfully synced ${result.synced} draft${result.synced > 1 ? "s" : ""}.`,
        });
      }

      if (result.failed > 0) {
        toast({
          title: "Some drafts failed to sync",
          description: `${result.failed} draft${result.failed > 1 ? "s" : ""} could not be synced.`,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Sync Error",
        description: "Failed to sync drafts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (isOnline && unsyncedCount === 0) {
    return null;
  }

  return (
    <div 
      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
        isOnline ? "bg-yellow-100 dark:bg-yellow-900/20" : "bg-red-100 dark:bg-red-900/20"
      }`}
      data-testid="offline-sync-status"
    >
      {isOnline ? (
        <Cloud className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
      ) : (
        <CloudOff className="h-4 w-4 text-red-600 dark:text-red-400" />
      )}
      
      <span className={`text-sm ${
        isOnline ? "text-yellow-700 dark:text-yellow-400" : "text-red-700 dark:text-red-400"
      }`}>
        {isOnline 
          ? `${unsyncedCount} unsynced draft${unsyncedCount > 1 ? "s" : ""}`
          : "You are offline"
        }
      </span>

      {isOnline && unsyncedCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing}
          className="ml-auto"
          data-testid="button-sync-drafts"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isSyncing ? "animate-spin" : ""}`} />
          Sync
        </Button>
      )}

      {!isOnline && (
        <Badge 
          variant="secondary" 
          className="ml-auto bg-red-200 text-red-700 dark:bg-red-900/40 dark:text-red-400"
        >
          Changes saved locally
        </Badge>
      )}
    </div>
  );
}
