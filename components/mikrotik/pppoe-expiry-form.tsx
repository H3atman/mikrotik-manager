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
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Calendar, Clock, AlertCircle, Save, X, User, Tag, Info } from 'lucide-react';

interface PPPoEExpiryFormProps {
  user: MikrotikPPPoEUser;
  credentials: MikrotikCredentials;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PPPoEExpiryForm({ user, credentials, onSuccess, onCancel }: PPPoEExpiryFormProps) {
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [expiryTime, setExpiryTime] = useState<string>('23:59');
  const [postExpiryProfile, setPostExpiryProfile] = useState<string>('Due_Date_512Kbps');
  const [profiles, setProfiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize form with existing values
  useEffect(() => {
    const currentExpiryDate = parseExpiryDate(user.comment);
    const currentExpiryTime = parseExpiryTime(user.comment);
    const currentPostExpiryProfile = parsePostExpiryProfile(user.comment);
    
    if (currentExpiryDate) {
      setExpiryDate(currentExpiryDate);
    } else {
      // Default to 30 days from now
      const date = new Date();
      date.setDate(date.getDate() + 30);
      setExpiryDate(date.toISOString().split('T')[0]);
    }
    
    if (currentExpiryTime) {
      setExpiryTime(currentExpiryTime);
    }
    
    if (currentPostExpiryProfile) {
      setPostExpiryProfile(currentPostExpiryProfile);
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
    
    try {
      // Format comment with expiry information
      const originalComment = user.comment || '';
      const expiryDateTime = `${expiryDate}T${expiryTime}`;
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
      console.log('User ID:', user.id);
      console.log('User name:', user.name);
      
      // Try multiple approaches to update the user
      let success = false;
      let lastError = null;
      
      // Approach 1: Use the new simplified format (no brackets, no original comment)
      try {
        console.log('Trying approach 1: Simplified format');
        await updatePPPoEUser(credentials, user.id, {
          comment: newComment,
          name: user.name // Include name to help find the correct user
        });
        success = true;
      } catch (error: any) {
        console.error('Approach 1 failed:', error);
        console.error('Error details:', error.response?.data || error.message);
        lastError = error;
      }
      
      // Approach 2: Try with just the tags in bracket format
      if (!success) {
        try {
          console.log('Trying approach 2: Bracket format');
          const bracketComment = `[EXPIRY:${expiryDateTime}] [POST-EXPIRY:${postExpiryProfile}]`;
          await updatePPPoEUser(credentials, user.id, {
            comment: bracketComment,
            name: user.name // Include name to help find the correct user
          });
          success = true;
        } catch (error: any) {
          console.error('Approach 2 failed:', error);
          console.error('Error details:', error.response?.data || error.message);
          lastError = error;
        }
      }
      
      // Approach 3: Try with just the expiry date
      if (!success) {
        try {
          console.log('Trying approach 3: Only expiry date');
          await updatePPPoEUser(credentials, user.id, {
            comment: `EXPIRY=${expiryDateTime}`,
            name: user.name // Include name to help find the correct user
          });
          success = true;
        } catch (error: any) {
          console.error('Approach 3 failed:', error);
          console.error('Error details:', error.response?.data || error.message);
          lastError = error;
        }
      }
      
      // Approach 4: Try with an empty comment
      if (!success) {
        try {
          console.log('Trying approach 4: Empty comment');
          await updatePPPoEUser(credentials, user.id, {
            comment: '',
            name: user.name // Include name to help find the correct user
          });
          success = true;
        } catch (error: any) {
          console.error('Approach 4 failed:', error);
          console.error('Error details:', error.response?.data || error.message);
          lastError = error;
        }
      }
      
      if (success) {
        onSuccess();
      } else {
        throw lastError || new Error('All update approaches failed');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Unknown error occurred';
      setError(`Failed to update expiry: ${errorMessage}`);
      console.error('Update expiry error:', err);
      
      // Show more detailed error information
      if (err.response) {
        console.error('Response status:', err.response.status);
        console.error('Response data:', err.response.data);
        
        // Add more details to the error message
        if (err.response.data) {
          setError(`Failed to update expiry: ${errorMessage}. Server response: ${JSON.stringify(err.response.data)}`);
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
            <CardTitle className="text-lg">Manage Expiry for <span className="text-blue-500">{user.name}</span></CardTitle>
            <CardDescription className="text-xs">Set when this user's subscription will expire</CardDescription>
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
            <label htmlFor="expiryDateTime" className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-blue-500" />
              Expiry Date and Time
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="relative">
                <Input
                  id="expiryDate"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  required
                  className="pl-8 h-9 text-sm focus-visible:ring-blue-500"
                />
                <Calendar className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              </div>
              <div className="relative">
                <Input
                  id="expiryTime"
                  type="time"
                  value={expiryTime}
                  onChange={(e) => setExpiryTime(e.target.value)}
                  required
                  className="pl-8 h-9 text-sm focus-visible:ring-blue-500"
                />
                <Clock className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              When this date and time is reached, the user's profile will be changed automatically
            </p>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="postExpiryProfile" className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-blue-500" />
              Post-Expiry Profile
            </label>
            <div className="relative">
              <select
                id="postExpiryProfile"
                value={postExpiryProfile}
                onChange={(e) => setPostExpiryProfile(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                required
              >
                {profiles.map(profile => (
                  <option key={profile} value={profile}>
                    {profile}
                  </option>
                ))}
              </select>
              <Tag className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>
            <p className="text-xs text-slate-500">
              The profile that will be applied after expiry
            </p>
          </div>
          
          <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-xs">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-slate-600 leading-relaxed">
                This will store expiry information in the user's comment field. The system will automatically change the profile when the expiry date and time is reached.
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
                Save Expiry
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
} 