'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DatePickerWithNextMonth } from '@/components/ui/date-picker';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { 
  MikrotikCredentials, 
  MikrotikPPPoEUser,
  updatePPPoEUser,
  fetchPPPoEProfiles,
  formatCommentWithExpiry
} from '@/lib/mikrotik';
import { AlertCircle, Save, X, Tag, Calendar, Clock, Check } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PPPoEBatchExpiryFormProps {
  users: MikrotikPPPoEUser[];
  credentials: MikrotikCredentials;
  onSuccess: () => void;
  onCancel: () => void;
}

interface UpdateProgress {
  total: number;
  current: number;
  success: number;
  failed: number;
  errors: { user: string; error: string }[];
}

export function PPPoEBatchExpiryForm({ users, credentials, onSuccess, onCancel }: PPPoEBatchExpiryFormProps) {
  const [expiryDate, setExpiryDate] = useState<Date | undefined>();
  const [expiryTime, setExpiryTime] = useState<string>('23:59');
  const [postExpiryProfile, setPostExpiryProfile] = useState<string>('Due_Date_512Kbps');
  const [profiles, setProfiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress>({
    total: users.length,
    current: 0,
    success: 0,
    failed: 0,
    errors: []
  });

  // Fetch available profiles
  useEffect(() => {
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
  }, [credentials]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProgress({
      total: users.length,
      current: 0,
      success: 0,
      failed: 0,
      errors: []
    });

    if (!expiryDate) {
      setError('Please select an expiry date');
      setLoading(false);
      return;
    }

    try {
      // Fix date handling to prevent subtraction
      const year = expiryDate.getFullYear();
      const month = String(expiryDate.getMonth() + 1).padStart(2, '0');
      const day = String(expiryDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      const expiryDateTime = `${formattedDate}T${expiryTime}`;

      let successCount = 0;
      let failedCount = 0;
      const errors: { user: string; error: string }[] = [];

      for (const user of users) {
        try {
          // Format comment with expiry information
          const newComment = formatCommentWithExpiry(
            user.comment || '',
            expiryDateTime,
            postExpiryProfile
          );

          // Update user
          await updatePPPoEUser(credentials, user.id, {
            comment: newComment,
            name: user.name
          });

          successCount++;
          setProgress(prev => ({
            ...prev,
            current: prev.current + 1,
            success: successCount
          }));
        } catch (err: unknown) {
          const error = err as Error;
          console.error(`Failed to update user ${user.name}:`, error);
          
          failedCount++;
          errors.push({ user: user.name, error: error.message });
          setProgress(prev => ({
            ...prev,
            current: prev.current + 1,
            failed: failedCount,
            errors
          }));
        }
      }

      // Show success dialog if at least one user was updated successfully
      if (successCount > 0) {
        setShowSuccessDialog(true);
        // Don't call onSuccess here, it will be called when the dialog is closed
      } else if (failedCount > 0) {
        setError(`Failed to update any users. ${failedCount} operation${failedCount !== 1 ? 's' : ''} failed.`);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(`Failed to process batch update: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowSuccessDialog(false);
    onCancel();
  };

  const handleDialogClose = () => {
    setShowSuccessDialog(false);
    // Call onSuccess which will close the drawer and refresh the user list
    onSuccess();
  };

  const progressPercentage = (progress.current / progress.total) * 100;

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="destructive" className="mx-0">
            <AlertCircle className="h-4 w-4 mr-2" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Expiry Date
              </label>
              <DatePickerWithNextMonth 
                value={expiryDate}
                onChange={setExpiryDate}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="expiryTime" className="text-sm font-medium flex items-center gap-2 text-foreground">
                <Clock className="h-4 w-4 text-muted-foreground" />
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
              <label htmlFor="postExpiryProfile" className="text-sm font-medium flex items-center gap-2 text-foreground">
                <Tag className="h-4 w-4 text-muted-foreground" />
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
              <p className="text-sm text-muted-foreground">
                Profile to apply after expiry date
              </p>
            </div>
          </div>

          {loading && (
            <div className="space-y-4 py-2">
              <Progress value={progressPercentage} className="w-full h-2" />
              <div className="text-sm text-muted-foreground flex justify-between">
                <span>Processing: {progress.current} / {progress.total}</span>
                <span>
                  Success: {progress.success} | Failed: {progress.failed}
                </span>
              </div>
              {progress.errors.length > 0 && (
                <div className="mt-4 bg-destructive/10 p-3 rounded-md">
                  <p className="text-sm font-medium text-destructive mb-2">Failed Updates:</p>
                  <ul className="text-sm space-y-1 text-destructive">
                    {progress.errors.map(({ user, error }, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{user}: {error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="min-w-[80px]"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || !expiryDate}
            className="min-w-[120px]"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Updating...' : `Update ${users.length} User${users.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </form>

      <Dialog 
        open={showSuccessDialog} 
        onOpenChange={(open) => {
          if (!open) {
            handleDialogClose();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 rounded-full bg-green-50 p-3 ring-8 ring-green-50">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <DialogTitle className="text-xl font-semibold text-foreground">Update Successful</DialogTitle>
              <DialogDescription className="mt-2 text-base">
                Successfully updated {progress.success} user{progress.success !== 1 ? 's' : ''}.
                {progress.failed > 0 && (
                  <div className="mt-2 text-destructive">
                    {progress.failed} update{progress.failed !== 1 ? 's' : ''} failed
                  </div>
                )}
              </DialogDescription>
            </div>
          </DialogHeader>
          
          {progress.failed > 0 && (
            <div className="max-h-[200px] overflow-y-auto rounded-md bg-destructive/5 p-4">
              <div className="text-sm font-medium text-destructive mb-2">Failed Updates:</div>
              <ul className="text-sm space-y-2">
                {progress.errors.map(({ user, error }, index) => (
                  <li key={index} className="flex items-start gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{user}: {error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-center mt-6">
            <Button
              type="button"
              size="lg"
              className="min-w-[200px] bg-green-600 hover:bg-green-700 text-white"
              onClick={handleDialogClose}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 