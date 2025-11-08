'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MikrotikCredentials, 
  MikrotikPPPoEUser,
  MikrotikQueueStats,
  MikrotikActiveConnection,
  updatePPPoEUser,
  parseExpiryDate,
  parseExpiryTime,
  parsePostExpiryProfile,
  isUserExpired,
  daysUntilExpiry,
  fetchQueueStats,
  fetchActiveConnection
} from '@/lib/mikrotik';
import { AlertCircle, Clock, Power, Edit, Wifi, Calendar, Tag, Download, Upload, User, AlertTriangle, ExternalLink, CalendarPlus } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface PPPoEUserCardProps {
  user: MikrotikPPPoEUser;
  credentials: MikrotikCredentials;
  onUpdate: () => void;
  onEditExpiry: (user: MikrotikPPPoEUser) => void;
  disabled?: boolean;
}

export function PPPoEUserCard({ user, credentials, onUpdate, onEditExpiry, disabled }: PPPoEUserCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToggleDialog, setShowToggleDialog] = useState(false);
  const [queueStats, setQueueStats] = useState<MikrotikQueueStats | null>(null);
  const [activeConnection, setActiveConnection] = useState<MikrotikActiveConnection | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  // Debug log for disabled state
  console.log(`User ${user.name} - disabled: ${user.disabled}`, user);
  
  // Parse expiry information from comment
  const expiryDate = parseExpiryDate(user.comment);
  const expiryTime = parseExpiryTime(user.comment);
  const postExpiryProfile = parsePostExpiryProfile(user.comment);
  
  // Combine date and time if both exist
  let expiryDateTime = expiryDate;
  if (expiryDate && expiryTime) {
    expiryDateTime = `${expiryDate}T${expiryTime}`;
  }
  
  const expired = expiryDateTime ? isUserExpired(expiryDateTime) : false;
  const daysLeft = expiryDateTime ? daysUntilExpiry(expiryDateTime) : null;
  
  // Fetch queue stats and active connection info
  useEffect(() => {
    const fetchData = async () => {
      try {
        setDataError(null);
        const [queueData, connectionData] = await Promise.all([
          fetchQueueStats(credentials, user.name),
          fetchActiveConnection(credentials, user.name)
        ]);

        console.log('Queue data received:', queueData);
        console.log('Connection data received:', connectionData);

        setQueueStats(queueData);
        setActiveConnection(connectionData);
      } catch (err) {
        console.error('Error fetching user data:', err);
        setDataError('Failed to fetch user statistics');
      } finally {
        setIsDataLoading(false);
      }
    };

    // Initial fetch only
    fetchData();
  }, [credentials, user.name]);
  
  const handleToggleStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await updatePPPoEUser(credentials, user.id, {
        disabled: !user.disabled
      });
      onUpdate();
    } catch (err: unknown) {
      const error = err as Error;
      setError(`Failed to update user: ${error.message}`);
      console.error('Toggle status error:', error);
    } finally {
      setLoading(false);
      setShowToggleDialog(false);
    }
  };
  
  
  const handleSetNextMonthExpiry = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Calculate first day of next month
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      
      // Format date as YYYY-MM-DD in local timezone
      const year = nextMonth.getFullYear();
      const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
      const day = String(nextMonth.getDate()).padStart(2, '0');
      const expiryDateStr = `${year}-${month}-${day}`;
      
      // Parse existing comment to extract date, time, and profile
      let newComment = user.comment || '';
      
      // Pattern: YYYY-MM-DD,HH:MM,ProfileName
      const commentPattern = /^(\d{4}-\d{2}-\d{2}),(\d{2}:\d{2}),(.+)$/;
      const match = newComment.match(commentPattern);
      
      if (match) {
        // Preserve time and profile, update only the date
        const time = match[2];
        const profile = match[3];
        newComment = `${expiryDateStr},${time},${profile}`;
      } else {
        // If comment doesn't match pattern, use default format
        newComment = `${expiryDateStr},23:59,Due_Date_512Kbps`;
      }
      
      console.log('Setting expiry to:', expiryDateStr);
      console.log('New comment:', newComment);
      
      await updatePPPoEUser(credentials, user.id, {
        comment: newComment
      });
      
      onUpdate();
    } catch (err: unknown) {
      const error = err as Error;
      setError(`Failed to set expiry date: ${error.message}`);
      console.error('Set expiry error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Get status badge variant based on expiry and disabled status
  const getStatusBadgeVariant = () => {
    // Force secondary (gray) variant for disabled users
    if (user.disabled === true) {
      console.log(`User ${user.name} is disabled, using secondary variant`);
      return "secondary";
    }
    if (expired || isDueDateProfile) return "destructive";
    if (daysLeft !== null && daysLeft <= 5) return "secondary";
    return "default";
  };
  
  // Get status text based on expiry and disabled status
  const getStatusText = () => {
    // Force "Disabled" text for disabled users
    if (user.disabled === true) {
      console.log(`User ${user.name} is disabled, showing "Disabled" text`);
      return "Disabled";
    }
    if (expired) return "Expired";
    if (isDueDateProfile) return "Limited Speed";
    if (daysLeft !== null && daysLeft <= 5) return `${daysLeft} days left`;
    return "Active";
  };
  
  // Get clean comment (without expiry tags)
  const getCleanComment = () => {
    if (!user.comment) return null;
    return user.comment
      .replace(/\[EXPIRY:[^\]]+\]/, '')
      .replace(/\[POST-EXPIRY:[^\]]+\]/, '')
      .trim() || null;
  };
  
  const cleanComment = getCleanComment();
  
  // Check if profile is Due_Date_512Kbps
  const isDueDateProfile = user.profile === "Due_Date_512Kbps";
  
  // Get card border color based on status
  const getCardBorderColor = () => {
    // Force slate color for disabled users
    if (user.disabled === true) {
      console.log(`User ${user.name} is disabled, using slate border`);
      return '#94a3b8'; // Slate-400 for disabled
    } else if (expired || isDueDateProfile) {
      return '#ef4444'; // Red for expired, or Due_Date_512Kbps
    } else if (daysLeft !== null && daysLeft <= 5) {
      return '#f97316'; // Orange for near expiry
    } else {
      return '#22c55e'; // Green for active
    }
  };
  
  // Get card background color based on status
  const getCardBackgroundColor = () => {
    // Force slate background for disabled users
    if (user.disabled === true) {
      console.log(`User ${user.name} is disabled, using slate background`);
      return 'bg-slate-50'; // Light slate background for disabled
    } else if (expired || isDueDateProfile) {
      return 'bg-red-50'; // Light red background for expired or Due_Date_512Kbps
    }
    return '';
  };
  
  return (
    <>
      <Card 
        className={`w-full h-full shadow-md hover:shadow-lg transition-shadow duration-200 border-t-4 ${getCardBackgroundColor()}`} 
        style={{ 
          borderTopColor: getCardBorderColor(),
          ...(user.disabled === true ? { borderColor: '#cbd5e1' } : {})
        }}
      >
        <CardHeader className="pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-1 sm:gap-2">
                <User 
                  className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${user.disabled === true ? 'text-slate-400' : (expired || isDueDateProfile) ? 'text-destructive' : 'text-primary'}`}
                  style={user.disabled === true ? { color: '#94a3b8' } : {}}
                />
                {user.name}
              </CardTitle>
              {cleanComment && (
                <CardDescription className="text-xs mt-1 line-clamp-1">
                  {cleanComment}
                </CardDescription>
              )}
            </div>
            <Badge 
              variant={getStatusBadgeVariant()} 
              className={`whitespace-nowrap text-xs ${user.disabled === true ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : ''}`}
              style={user.disabled === true ? { backgroundColor: '#e2e8f0', color: '#475569' } : {}}
            >
              {getStatusText()}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="pb-2 space-y-4 px-3 sm:px-4">
          {/* User Details Section */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Tag className="h-4 w-4 flex-shrink-0" />
                Profile
              </span>
              <span className={`text-sm font-medium ${isDueDateProfile ? "text-destructive font-bold" : ""} flex items-center gap-2`}>
                {isDueDateProfile && <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />}
                {user.profile}
              </span>
            </div>
            
            {expiryDate && (
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  Expires
                </span>
                <span className={`text-sm font-medium ${expired ? "text-destructive" : daysLeft !== null && daysLeft <= 5 ? "text-amber-500" : ""}`}>
                  {new Date(expiryDate).toLocaleDateString()}
                  {expiryTime && ` at ${expiryTime}`}
                  {daysLeft !== null && !expired && ` (${daysLeft} days)`}
                </span>
              </div>
            )}
            
            {postExpiryProfile && (
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 flex-shrink-0" />
                  After Expiry
                </span>
                <span className="text-sm">{postExpiryProfile}</span>
              </div>
            )}
            
            {user['caller-id'] && (
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                  <Wifi className="h-4 w-4 flex-shrink-0" />
                  MAC Address
                </span>
                <span className="font-mono text-sm break-all">{user['caller-id']}</span>
              </div>
            )}
          </div>

          {/* Usage Statistics Section */}
          <div className="space-y-4">
            {isDataLoading ? (
              <div className="flex items-center justify-center py-2">
                <span className="text-sm text-muted-foreground">Loading statistics...</span>
              </div>
            ) : dataError ? (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {dataError}
              </div>
            ) : (
              <>
                {/* Queue Statistics */}
                {queueStats && (
                  <div className="space-y-4">
                    {/* Traffic Statistics */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between bg-secondary/20 px-3 py-2 rounded-md">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <Upload className="h-4 w-4 text-primary" />
                          Total Upload
                        </span>
                        <span className="text-sm font-bold">{queueStats['formatted-upload']}</span>
                      </div>
                      <div className="flex items-center justify-between bg-secondary/20 px-3 py-2 rounded-md">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <Download className="h-4 w-4 text-primary" />
                          Total Download
                        </span>
                        <span className="text-sm font-bold">{queueStats['formatted-download']}</span>
                      </div>
                    </div>

                    {/* Additional Stats */}
                    <div className="space-y-2.5 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                          <Upload className="h-4 w-4" />
                          Current Rate
                        </span>
                        <span className="text-sm">{formatBytes(queueStats['rate'])}/s</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                          <AlertCircle className="h-4 w-4" />
                          Dropped Packets
                        </span>
                        <span className="text-sm">{formatBytes(queueStats['dropped'])}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Connection Status */}
                <div className="pt-1">
                  {activeConnection ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          Uptime
                        </span>
                        <span className="text-sm font-medium text-green-600">{formatUptime(activeConnection.uptime)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                          <Wifi className="h-4 w-4" />
                          Address
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{activeConnection.address}</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 hover:bg-secondary/80"
                                  onClick={() => window.open(`http://${activeConnection.address}`, '_blank')}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  <span className="sr-only">Open in browser</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                <p>{/^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/.test(activeConnection.address) 
                                    ? "Note: This is a private IP address - may only be accessible on local network"
                                    : "Open client's address in browser"}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        Status
                      </span>
                      <span className="text-sm font-medium text-yellow-600">Offline</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          
          {error && (
            <div className="mt-2 text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2 px-3 sm:px-4 pb-3 sm:pb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEditExpiry(user)}
            disabled={disabled}
            className="w-full sm:w-auto h-9 sm:h-8 text-sm"
          >
            <Edit className="h-4 w-4 sm:h-3.5 sm:w-3.5 mr-2 sm:mr-1" />
            Edit Expiry
          </Button>
          <Button
            size="sm"
            onClick={handleSetNextMonthExpiry}
            disabled={disabled || loading}
            className="w-full sm:w-auto h-9 sm:h-8 text-sm bg-green-100 hover:bg-green-200 text-green-700 border border-green-300"
            title="Mark as paid - set expiry to first day of next month"
          >
            <CalendarPlus className="h-4 w-4 sm:h-3.5 sm:w-3.5 mr-2 sm:mr-1" />
            Paid
          </Button>
          <Button
            variant={user.disabled ? "outline" : "default"}
            size="sm"
            onClick={() => setShowToggleDialog(true)}
            disabled={disabled}
            className={`w-full sm:w-auto h-9 sm:h-8 text-sm ${user.disabled ? "" : "bg-orange-100 hover:bg-orange-200 text-orange-700 border-orange-200"}`}
          >
            <Power className="h-4 w-4 sm:h-3.5 sm:w-3.5 mr-2 sm:mr-1" />
            {user.disabled ? 'Enable' : 'Disable'}
          </Button>
        </CardFooter>
      </Card>

      <ConfirmationDialog
        open={showToggleDialog}
        onOpenChange={setShowToggleDialog}
        title={user.disabled ? "Enable User" : "Disable User"}
        description={`Are you sure you want to ${user.disabled ? "enable" : "disable"} user "${user.name}"?`}
        actionLabel={user.disabled ? "Enable" : "Disable"}
        onAction={handleToggleStatus}
        variant={user.disabled ? "default" : "destructive"}
        loading={loading}
      />
    </>
  );
}

// Helper function to format bytes
function formatBytes(bytes: string): string {
  const numBytes = parseInt(bytes, 10);
  if (isNaN(numBytes)) return bytes;
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = numBytes;
  let unitIndex = 0;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

// Helper function to format uptime
function formatUptime(uptime: string): string {
  // Handle invalid input
  if (!uptime) return 'N/A';

  // Parse the uptime string (format: "1d6h8m4s" or similar)
  const days = uptime.match(/(\d+)d/)?.[1] || '0';
  const hours = uptime.match(/(\d+)h/)?.[1] || '0';
  const minutes = uptime.match(/(\d+)m/)?.[1] || '0';
  const seconds = uptime.match(/(\d+)s/)?.[1] || '0';

  const d = parseInt(days);
  const h = parseInt(hours);
  const m = parseInt(minutes);
  const s = parseInt(seconds);

  // Format based on the duration
  if (d > 0) {
    return `${d}d ${h}h ${m}m`;
  } else if (h > 0) {
    return `${h}h ${m}m`;
  } else if (m > 0) {
    return `${m}m ${s}s`;
  } else {
    return `${s}s`;
  }
} 