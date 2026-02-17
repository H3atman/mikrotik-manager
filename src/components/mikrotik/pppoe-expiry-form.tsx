'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DatePickerWithNextMonth } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { 
  MikrotikCredentials, 
  MikrotikPPPoEUser,
  updatePPPoEUser,
  fetchPPPoEProfiles,
  parseExpiryDate,
  parseExpiryTime,
  parsePostExpiryProfile,
  formatCommentWithExpiry
} from '@/lib/mikrotik';
import {
  IconAlertCircle,
  IconCalendar,
  IconClock,
  IconDeviceFloppy,
  IconTag,
  IconX,
} from '@tabler/icons-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PPPoEExpiryFormProps {
  user: MikrotikPPPoEUser;
  credentials: MikrotikCredentials;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PPPoEExpiryForm({ user, credentials, onSuccess, onCancel }: PPPoEExpiryFormProps) {
  const [expiryDate, setExpiryDate] = useState<Date | undefined>();
  const [expiryTime, setExpiryTime] = useState<string>('23:59');
  const [postExpiryProfile, setPostExpiryProfile] = useState<string>('Due_Date_512Kbps');
  const [currentProfile, setCurrentProfile] = useState<string>(user.profile || 'default');
  const [profiles, setProfiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize form with existing values
  useEffect(() => {
    const currentExpiryDate = parseExpiryDate(user.comment);
    const currentExpiryTime = parseExpiryTime(user.comment);
    const currentPostExpiryProfile = parsePostExpiryProfile(user.comment);
    
    if (currentExpiryDate) {
      setExpiryDate(new Date(currentExpiryDate));
    }
    
    if (currentExpiryTime) {
      setExpiryTime(currentExpiryTime);
    }
    
    if (currentPostExpiryProfile) {
      setPostExpiryProfile(currentPostExpiryProfile);
    }
    
    // Set current profile from user
    if (user.profile) {
      setCurrentProfile(user.profile);
    }
    
    // Fetch available profiles
    const getProfiles = async () => {
      try {
        const profileList = await fetchPPPoEProfiles(credentials);
        setProfiles(profileList);
      } catch (err) {
        console.error('Failed to fetch profiles:', err);
        setProfiles(['default', 'Due_Date_512Kbps']);
      }
    };
    
    getProfiles();
  }, [user, credentials]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    if (!expiryDate) {
      setError('Please select an expiry date');
      setLoading(false);
      return;
    }

    try {
      // Format comment with expiry information
      const originalComment = user.comment || '';
      
      // Format date to preserve local date (YYYY-MM-DD)
      const formattedDate = expiryDate.toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD format
      const expiryDateTime = `${formattedDate}T${expiryTime}`;
      
      const newComment = formatCommentWithExpiry(
        originalComment,
        expiryDateTime,
        postExpiryProfile
      );
      
      // Debug logging
      console.log('Original comment:', originalComment);
      console.log('New comment:', newComment);
      console.log('Expiry date and time:', expiryDateTime);
      console.log('Post-expiry profile:', postExpiryProfile);
      console.log('Current profile:', currentProfile);
      console.log('User ID:', user.id);
      console.log('User name:', user.name);
      
      let success = false;
      
      try {
        // Always include both profile and comment in the update
        // The profile will only trigger a disconnect if it's different from the current profile
        await updatePPPoEUser(credentials, user.id, {
          comment: newComment,
          profile: currentProfile,
          name: user.name
        });
        success = true;
      } catch (error: unknown) {
        const err = error as Error & { 
          response?: { 
            data: unknown;
            status?: number;
          } 
        };
        console.error('Update failed:', err);
        console.error('Error details:', err.response?.data || err.message);
        
        // Try fallback approach if the first attempt failed
        try {
          // Always include both profile and comment in a single update
          await updatePPPoEUser(credentials, user.id, {
            comment: newComment,
            profile: currentProfile,
            name: user.name
          });
          success = true;
        } catch (fallbackError: unknown) {
          const fbErr = fallbackError as Error;
          console.error('Fallback approach failed:', fbErr);
          throw fbErr;
        }
      }
      
      if (success) {
        onSuccess();
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(`Failed to update expiry: ${error.message}`);
      console.error('Update expiry error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        {error && (
          <Alert variant="destructive" className="animate-pulse text-sm py-2">
            <IconAlertCircle className="h-3.5 w-3.5 mr-2" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <label htmlFor="currentProfile" className="text-sm font-medium flex items-center gap-2">
            <IconTag className="h-3.5 w-3.5 text-blue-500" />
            Current Profile
          </label>
          <Select
            value={currentProfile}
            onValueChange={setCurrentProfile}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a profile" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map(profile => (
                <SelectItem key={profile} value={profile}>
                  {profile}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">
            The profile determines the user&apos;s bandwidth and service level
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <IconCalendar className="h-3.5 w-3.5 text-blue-500" />
            Expiry Date
          </label>
          <DatePickerWithNextMonth 
            value={expiryDate}
            onChange={setExpiryDate}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="expiryTime" className="text-sm font-medium flex items-center gap-2">
            <IconClock className="h-3.5 w-3.5 text-blue-500" />
            Expiry Time
          </label>
          <Input
            id="expiryTime"
            type="time"
            value={expiryTime}
            onChange={(e) => setExpiryTime(e.target.value)}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="postExpiryProfile" className="text-sm font-medium flex items-center gap-2">
            <IconTag className="h-3.5 w-3.5 text-blue-500" />
            Post-Expiry Profile
          </label>
          <Select
            value={postExpiryProfile}
            onValueChange={setPostExpiryProfile}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a profile" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map(profile => (
                <SelectItem key={profile} value={profile}>
                  {profile}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">
            Profile to apply after expiry date
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          <IconX className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading || !expiryDate}
        >
          <IconDeviceFloppy className="h-4 w-4 mr-1" />
          Save Changes
        </Button>
      </div>
    </form>
  );
} 
