'use client';

import { useState } from 'react';
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
  updatePPPoEUser,
  deletePPPoEUser,
  parseExpiryDate,
  parseExpiryTime,
  parsePostExpiryProfile,
  isUserExpired,
  daysUntilExpiry
} from '@/lib/mikrotik';
import { AlertCircle, Clock, Trash2, Power, Edit, Wifi, Calendar, Tag, MessageSquare, Download, Upload, User, AlertTriangle } from 'lucide-react';

interface PPPoEUserCardProps {
  user: MikrotikPPPoEUser;
  credentials: MikrotikCredentials;
  onUpdate: () => void;
  onEditExpiry: (user: MikrotikPPPoEUser) => void;
}

export function PPPoEUserCard({ user, credentials, onUpdate, onEditExpiry }: PPPoEUserCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
  
  const handleToggleStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await updatePPPoEUser(credentials, user.id, {
        disabled: !user.disabled
      });
      onUpdate();
    } catch (err: any) {
      setError(`Failed to update user: ${err.message}`);
      console.error('Toggle status error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete user "${user.name}"?`)) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await deletePPPoEUser(credentials, user.id);
      onUpdate();
    } catch (err: any) {
      setError(`Failed to delete user: ${err.message}`);
      console.error('Delete user error:', err);
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
    <Card 
      className={`w-full h-full shadow-md hover:shadow-lg transition-shadow duration-200 border-t-4 ${getCardBackgroundColor()}`} 
      style={{ 
        borderTopColor: getCardBorderColor(),
        ...(user.disabled === true ? { borderColor: '#cbd5e1' } : {})
      }}
    >
      <CardHeader className="pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
        <div className="flex justify-between items-start">
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
            className={`ml-2 whitespace-nowrap text-xs ${user.disabled === true ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : ''}`}
            style={user.disabled === true ? { backgroundColor: '#e2e8f0', color: '#475569' } : {}}
          >
            {getStatusText()}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pb-2 space-y-2 sm:space-y-3 px-3 sm:px-4">
        <div className="grid grid-cols-1 gap-1 sm:gap-2 text-xs sm:text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium flex items-center gap-1 text-muted-foreground">
              <Tag className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              Profile:
            </span>
            <span className={`font-medium ${isDueDateProfile ? "text-destructive font-bold" : ""} flex items-center gap-1`}>
              {isDueDateProfile && <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-destructive" />}
              {user.profile}
            </span>
          </div>
          
          {expiryDate && (
            <div className="flex items-center justify-between">
              <span className="font-medium flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Expires:
              </span>
              <span className={`font-medium ${expired ? "text-destructive" : daysLeft !== null && daysLeft <= 5 ? "text-amber-500" : ""}`}>
                {new Date(expiryDate).toLocaleDateString()}
                {expiryTime && ` at ${expiryTime}`}
                {daysLeft !== null && !expired && ` (${daysLeft} days)`}
              </span>
            </div>
          )}
          
          {postExpiryProfile && (
            <div className="flex items-center justify-between">
              <span className="font-medium flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                After Expiry:
              </span>
              <span>{postExpiryProfile}</span>
            </div>
          )}
          
          {user['caller-id'] && (
            <div className="flex items-center justify-between">
              <span className="font-medium flex items-center gap-1 text-muted-foreground">
                <Wifi className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                MAC:
              </span>
              <span className="font-mono text-xs">{user['caller-id']}</span>
            </div>
          )}
          
          {user['limit-bytes-in'] && (
            <div className="flex items-center justify-between">
              <span className="font-medium flex items-center gap-1 text-muted-foreground">
                <Download className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Download:
              </span>
              <span>{formatBytes(user['limit-bytes-in'])}</span>
            </div>
          )}
          
          {user['limit-bytes-out'] && (
            <div className="flex items-center justify-between">
              <span className="font-medium flex items-center gap-1 text-muted-foreground">
                <Upload className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Upload:
              </span>
              <span>{formatBytes(user['limit-bytes-out'])}</span>
            </div>
          )}
        </div>
        
        {error && (
          <div className="mt-2 text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            {error}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between pt-2 gap-1 sm:gap-2 px-3 sm:px-4 pb-3 sm:pb-4">
        <div className="flex gap-1 sm:gap-2">
          <Button 
            variant={user.disabled === true ? "default" : "outline"} 
            size="sm" 
            onClick={handleToggleStatus}
            disabled={loading}
            className="flex items-center gap-1 h-7 sm:h-8 text-xs"
          >
            <Power className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            {user.disabled === true ? "Enable" : "Disable"}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEditExpiry(user)}
            disabled={loading}
            className="flex items-center gap-1 h-7 sm:h-8 text-xs"
          >
            <Edit className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            {expiryDate ? "Edit" : "Set"}
          </Button>
        </div>
        
        <Button 
          variant="destructive" 
          size="sm" 
          onClick={handleDelete}
          disabled={loading}
          className="flex items-center gap-1 h-7 sm:h-8 text-xs"
        >
          <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          Delete
        </Button>
      </CardFooter>
    </Card>
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