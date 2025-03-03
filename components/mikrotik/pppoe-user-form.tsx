'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MikrotikCredentials, 
  MikrotikPPPoEUser,
  addPPPoEUser,
  fetchPPPoEProfiles,
  formatCommentWithExpiry
} from '@/lib/mikrotik';

interface PPPoEUserFormProps {
  credentials: MikrotikCredentials;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PPPoEUserForm({ credentials, onSuccess, onCancel }: PPPoEUserFormProps) {
  const [user, setUser] = useState<Omit<MikrotikPPPoEUser, 'id'>>({
    name: '',
    password: '',
    service: 'pppoe',
    profile: 'default',
    disabled: false,
    'caller-id': '',
    comment: '',
    'limit-bytes-in': '',
    'limit-bytes-out': ''
  });
  
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [expiryTime, setExpiryTime] = useState<string>('23:59');
  const [postExpiryProfile, setPostExpiryProfile] = useState<string>('Due_Date_512Kbps');
  const [enableExpiry, setEnableExpiry] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<string[]>(['default']);
  
  // Set default expiry date to 30 days from now
  useEffect(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    setExpiryDate(date.toISOString().split('T')[0]);
  }, []);
  
  // Fetch available profiles
  useEffect(() => {
    const getProfiles = async () => {
      try {
        const profileList = await fetchPPPoEProfiles(credentials);
        setProfiles(profileList);
        
        // Set default profile if available
        if (profileList.length > 0 && profileList.includes('default')) {
          setUser(prev => ({ ...prev, profile: 'default' }));
        } else if (profileList.length > 0) {
          setUser(prev => ({ ...prev, profile: profileList[0] }));
        }
      } catch (err) {
        console.error('Failed to fetch profiles:', err);
      }
    };
    
    getProfiles();
  }, [credentials]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setUser(prev => ({ ...prev, [name]: checked }));
    } else {
      setUser(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // Validate required fields
    if (!user.name || !user.password) {
      setError('Username and password are required');
      setLoading(false);
      return;
    }
    
    try {
      // Clean up empty fields
      const userToSubmit = { ...user };
      
      // Remove empty optional fields
      if (!userToSubmit['caller-id']) delete userToSubmit['caller-id'];
      if (!userToSubmit['limit-bytes-in']) delete userToSubmit['limit-bytes-in'];
      if (!userToSubmit['limit-bytes-out']) delete userToSubmit['limit-bytes-out'];
      
      // Add expiry information to comment if enabled
      if (enableExpiry && expiryDate && postExpiryProfile) {
        const expiryDateTime = `${expiryDate}T${expiryTime}`;
        userToSubmit.comment = formatCommentWithExpiry(
          userToSubmit.comment,
          expiryDateTime,
          postExpiryProfile
        );
      }
      
      await addPPPoEUser(credentials, userToSubmit);
      onSuccess();
    } catch (err: any) {
      setError(`Failed to add user: ${err.message}`);
      console.error('Add user error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Add PPPoE User</CardTitle>
      </CardHeader>
      
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Username *
            </label>
            <Input
              id="name"
              name="name"
              value={user.name}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password *
            </label>
            <Input
              id="password"
              name="password"
              type="text"
              value={user.password}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="profile" className="text-sm font-medium">
              Profile
            </label>
            <select
              id="profile"
              name="profile"
              value={user.profile}
              onChange={handleChange}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {profiles.map(profile => (
                <option key={profile} value={profile}>
                  {profile}
                </option>
              ))}
            </select>
          </div>
          
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center space-x-2">
              <input
                id="enableExpiry"
                type="checkbox"
                checked={enableExpiry}
                onChange={(e) => setEnableExpiry(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="enableExpiry" className="text-sm font-medium">
                Enable Subscription Expiry
              </label>
            </div>
            
            {enableExpiry && (
              <>
                <div className="space-y-2 mt-2">
                  <label htmlFor="expiryDateTime" className="text-sm font-medium">
                    Expiry Date and Time
                  </label>
                  <div className="flex space-x-2">
                    <Input
                      id="expiryDate"
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      required={enableExpiry}
                      className="flex-1"
                    />
                    <Input
                      id="expiryTime"
                      type="time"
                      value={expiryTime}
                      onChange={(e) => setExpiryTime(e.target.value)}
                      required={enableExpiry}
                      className="w-1/3"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="postExpiryProfile" className="text-sm font-medium">
                    Post-Expiry Profile
                  </label>
                  <select
                    id="postExpiryProfile"
                    value={postExpiryProfile}
                    onChange={(e) => setPostExpiryProfile(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required={enableExpiry}
                  >
                    {profiles.map(profile => (
                      <option key={profile} value={profile}>
                        {profile}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Profile that will be applied after expiry
                  </p>
                </div>
              </>
            )}
          </div>
          
          <div className="space-y-2">
            <label htmlFor="caller-id" className="text-sm font-medium">
              MAC Address (Caller ID)
            </label>
            <Input
              id="caller-id"
              name="caller-id"
              value={user['caller-id'] || ''}
              onChange={handleChange}
              placeholder="00:11:22:33:44:55"
            />
            <p className="text-xs text-muted-foreground">
              Optional: Restrict this user to a specific device
            </p>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="comment" className="text-sm font-medium">
              Comment
            </label>
            <Input
              id="comment"
              name="comment"
              value={user.comment || ''}
              onChange={handleChange}
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="limit-bytes-in" className="text-sm font-medium">
              Download Limit (bytes)
            </label>
            <Input
              id="limit-bytes-in"
              name="limit-bytes-in"
              type="number"
              value={user['limit-bytes-in'] || ''}
              onChange={handleChange}
              placeholder="e.g. 1073741824 for 1GB"
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="limit-bytes-out" className="text-sm font-medium">
              Upload Limit (bytes)
            </label>
            <Input
              id="limit-bytes-out"
              name="limit-bytes-out"
              type="number"
              value={user['limit-bytes-out'] || ''}
              onChange={handleChange}
              placeholder="e.g. 1073741824 for 1GB"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              id="disabled"
              name="disabled"
              type="checkbox"
              checked={user.disabled}
              onChange={e => setUser(prev => ({ ...prev, disabled: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-slate-500 focus:ring-slate-500"
            />
            <label htmlFor="disabled" className="text-sm font-medium flex items-center gap-1">
              Disabled
              {user.disabled && <span className="text-xs text-slate-500">(User will be shown with gray styling)</span>}
            </label>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          
          <Button 
            type="submit" 
            disabled={loading}
          >
            {loading ? "Adding..." : "Add User"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
} 