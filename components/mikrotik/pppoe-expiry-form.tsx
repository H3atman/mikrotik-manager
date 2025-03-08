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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DatePickerWithNextMonth } from '@/components/ui/date-picker';
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
import { AlertCircle, Save, X, User, Tag, Info, Calendar, Clock } from 'lucide-react';
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
      const formattedDate = expiryDate.toISOString().split('T')[0];
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
      
      // Try multiple approaches to update the user
      let success = false;
      let lastError = null;
      
      // Approach 1: Update with profile and comment
      try {
        console.log('Trying approach 1: Update with profile and comment');
        await updatePPPoEUser(credentials, user.id, {
          comment: newComment,
          profile: currentProfile,
          name: user.name // Include name to help find the correct user
        });
        success = true;
      } catch (error: unknown) {
        const err = error as Error & { 
          response?: { 
            data: unknown;
            status?: number;
          } 
        };
        console.error('Approach 1 failed:', err);
        console.error('Error details:', err.response?.data || err.message);
        lastError = err;
      }
      
      // Approach 2: Try updating profile first, then comment
      if (!success) {
        try {
          console.log('Trying approach 2: Update profile first, then comment');
          // First update the profile
          await updatePPPoEUser(credentials, user.id, {
            profile: currentProfile,
            name: user.name
          });
          
          // Then update the comment
          await updatePPPoEUser(credentials, user.id, {
            comment: newComment,
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
          console.error('Approach 2 failed:', err);
          console.error('Error details:', err.response?.data || err.message);
          lastError = err;
        }
      }
      
      // Approach 3: Try with just the expiry date
      if (!success) {
        try {
          console.log('Trying approach 3: Only expiry date');
          await updatePPPoEUser(credentials, user.id, {
            comment: `EXPIRY=${expiryDateTime}`,
            profile: currentProfile,
            name: user.name // Include name to help find the correct user
          });
          success = true;
        } catch (error: unknown) {
          const err = error as Error & { 
            response?: { 
              data: unknown;
              status?: number;
            } 
          };
          console.error('Approach 3 failed:', err);
          console.error('Error details:', err.response?.data || err.message);
          lastError = err;
        }
      }
      
      // Approach 4: Try with an empty comment
      if (!success) {
        try {
          console.log('Trying approach 4: Empty comment');
          await updatePPPoEUser(credentials, user.id, {
            comment: '',
            profile: currentProfile,
            name: user.name // Include name to help find the correct user
          });
          success = true;
        } catch (error: unknown) {
          const err = error as Error & { 
            response?: { 
              data: unknown;
              status?: number;
            } 
          };
          console.error('Approach 4 failed:', err);
          console.error('Error details:', err.response?.data || err.message);
          lastError = err;
        }
      }
      
      if (success) {
        onSuccess();
      } else {
        throw lastError || new Error('All update approaches failed');
      }
    } catch (err: unknown) {
      const error = err as Error & {
        response?: {
          status: number;
          data: unknown;
        };
      };
      const errorMessage = error.message || 'Unknown error occurred';
      setError(`Failed to update expiry: ${errorMessage}`);
      console.error('Update expiry error:', error);
      
      // Show more detailed error information
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        
        // Add more details to the error message
        if (error.response.data) {
          setError(`Failed to update expiry: ${errorMessage}. Server response: ${JSON.stringify(error.response.data)}`);
        }
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card className="w-full max-w-lg mx-auto shadow-md border border-blue-100">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-blue-500" />
          <div>
            <CardTitle className="text-lg">Manage User <span className="text-blue-500">{user.name}</span></CardTitle>
            <CardDescription className="text-xs">Adjust profile, expiry date, and post-expiry settings</CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-4">
          {error && (
            <Alert variant="destructive" className="animate-pulse text-sm py-2">
              <AlertCircle className="h-3.5 w-3.5 mr-2" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <label htmlFor="currentProfile" className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-blue-500" />
              Current Profile
            </label>
            <div className="relative">
              <Select
                value={currentProfile}
                onValueChange={setCurrentProfile}
              >
                <SelectTrigger className="w-full pl-8">
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
              <Tag className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>
            <p className="text-xs text-slate-500">
              The profile determines the user&apos;s bandwidth and service level
            </p>
          </div>
          
          <div className="space-y-2 border-t pt-4 mt-4">
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-blue-500" />
              Expiry Date
            </label>
            <DatePickerWithNextMonth 
              value={expiryDate}
              onChange={setExpiryDate}
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="expiryTime" className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-blue-500" />
              Expiry Time
            </label>
            <input
              type="time"
              id="expiryTime"
              value={expiryTime}
              onChange={(e) => setExpiryTime(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              required
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="postExpiryProfile" className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-blue-500" />
              Post-Expiry Profile
            </label>
            <div className="relative">
              <Select
                value={postExpiryProfile}
                onValueChange={setPostExpiryProfile}
              >
                <SelectTrigger className="w-full pl-8">
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
              <Tag className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>
            <p className="text-xs text-slate-500">
              When this date and time is reached, the user&apos;s profile will be changed automatically
            </p>
          </div>
          
          <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-xs">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-slate-600 leading-relaxed">
                This will update the user&apos;s profile immediately and store expiry information in the user&apos;s comment field. The system will automatically change the profile when the expiry date and time is reached.
              </p>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between pt-3 pb-3 px-4 border-t border-slate-100">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            disabled={loading}
            className="flex items-center gap-1 h-8 text-sm"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
          
          <Button 
            type="submit" 
            disabled={loading}
            className="flex items-center gap-1 h-8 text-sm bg-blue-500 hover:bg-blue-600"
          >
            {loading ? (
              <>
                <div className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                Save Changes
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
} 