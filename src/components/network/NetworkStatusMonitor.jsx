import React, { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { WifiOff, Wifi, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NetworkStatusMonitor() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowReconnected(true);
        setWasOffline(false);
        // Auto-hide reconnected message after 5 seconds
        setTimeout(() => setShowReconnected(false), 5000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  const handleRefresh = () => {
    window.location.reload();
  };

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 shadow-lg">
        <Alert variant="destructive" className="rounded-none border-x-0 border-t-0 bg-red-600 text-white">
          <WifiOff className="h-5 w-5" />
          <AlertTitle className="font-bold text-lg">No Internet Connection</AlertTitle>
          <AlertDescription className="text-white/90">
            You are currently offline. Some features may not work. Your work will be saved locally and synced when connection is restored.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 shadow-lg">
        <Alert className="rounded-none border-x-0 border-t-0 bg-emerald-600 text-white border-emerald-700">
          <Wifi className="h-5 w-5" />
          <AlertTitle className="font-bold text-lg flex items-center gap-2">
            Connection Restored
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleRefresh}
              className="ml-auto bg-white text-emerald-600 hover:bg-emerald-50"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Page
            </Button>
          </AlertTitle>
          <AlertDescription className="text-white/90">
            Your internet connection has been restored. Click refresh to sync any pending changes.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return null;
}