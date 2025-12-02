'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MikrotikCredentials, 
  MikrotikPPPoEUser,
  fetchPPPoEUsers,
  processExpiredUsers
} from '@/lib/mikrotik';
import { PPPoEUserCard } from './pppoe-user-card';
import { PPPoEUserForm } from './pppoe-user-form';
import { PPPoEExpiryForm } from './pppoe-expiry-form';
import { PPPoEBatchExpiryForm } from './pppoe-batch-expiry-form';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Plus, RefreshCw, LogOut, Clock, Users } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface PPPoEUserListProps {
  credentials: MikrotikCredentials;
  onDisconnect: () => void;
}

export function PPPoEUserList({ credentials, onDisconnect }: PPPoEUserListProps) {
  const [users, setUsers] = useState<MikrotikPPPoEUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showExpiryForm, setShowExpiryForm] = useState(false);
  const [showBatchExpiryForm, setShowBatchExpiryForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<MikrotikPPPoEUser | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<MikrotikPPPoEUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingExpiry, setProcessingExpiry] = useState(false);
  const [expiryMessage, setExpiryMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showActiveUsersOnly, setShowActiveUsersOnly] = useState(false);
  
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const userData = await fetchPPPoEUsers(credentials);
      setUsers(userData);
    } catch (err: unknown) {
      const error = err as Error;
      setError(`Failed to load PPPoE users: ${error.message}`);
      console.error('Load users error:', error);
    } finally {
      setLoading(false);
    }
  }, [credentials]);
  
  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, [credentials, loadUsers]);
  
  const handleAddSuccess = () => {
    setShowAddForm(false);
    loadUsers();
  };
  
  const handleAddCancel = () => {
    setShowAddForm(false);
  };
  
  const handleEditExpiry = (user: MikrotikPPPoEUser) => {
    setSelectedUser(user);
    setShowExpiryForm(true);
  };
  
  const handleExpirySuccess = () => {
    setShowExpiryForm(false);
    setSelectedUser(null);
    loadUsers();
  };
  
  const handleExpiryCancel = () => {
    setShowExpiryForm(false);
    setSelectedUser(null);
  };
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };
  
  const handleProcessExpiry = async () => {
    setProcessingExpiry(true);
    setExpiryMessage(null);
    
    try {
      const processedCount = await processExpiredUsers(credentials);
      setExpiryMessage(
        processedCount > 0
          ? `Successfully processed ${processedCount} expired user(s)`
          : 'No expired users found to process'
      );
      
      // Reload users to reflect changes
      loadUsers();
    } catch (err: unknown) {
      const error = err as Error;
      setExpiryMessage(`Error processing expired users: ${error.message}`);
      console.error('Process expiry error:', error);
    } finally {
      setProcessingExpiry(false);
    }
  };
  
  const handleBatchExpirySuccess = () => {
    // First close the drawer
    setShowBatchExpiryForm(false);
    // Reset selection state
    setSelectedUsers([]);
    setSelectionMode(false);
    setShowActiveUsersOnly(false);
    // Refresh the user list
    loadUsers();
  };
  
  const handleBatchExpiryCancel = () => {
    setShowBatchExpiryForm(false);
    setSelectedUsers([]);
    setSelectionMode(false);
    setShowActiveUsersOnly(false);
  };
  
  const toggleUserSelection = (user: MikrotikPPPoEUser) => {
    if (selectedUsers.some(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };
  
  const handleBatchExpiry = () => {
    if (selectedUsers.length > 0) {
      setShowBatchExpiryForm(true);
    }
  };
  
  const handleActiveUsersOnlyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowActiveUsersOnly(e.target.checked);
    if (e.target.checked) {
      // Select all active (non-disabled) users
      const activeUsers = users.filter(user => !user.disabled);
      setSelectedUsers(activeUsers);
    } else {
      // Clear selection when unchecking
      setSelectedUsers([]);
    }
  };
  
  // Filter users based on search term and active users filter
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.comment && user.comment.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (showActiveUsersOnly) {
      return matchesSearch && !user.disabled;
    }
    return matchesSearch;
  });
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 h-10 sm:h-11"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className={`h-10 w-10 sm:h-11 sm:w-11 ${refreshing ? 'animate-spin' : ''}`}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-start sm:justify-end">
          {!selectionMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => setSelectionMode(true)}
                className="w-full sm:w-auto h-10 sm:h-11 text-sm"
              >
                <Users className="h-4 w-4 mr-2" />
                Select Users
              </Button>
              <Button 
                onClick={() => setShowAddForm(true)}
                className="w-full sm:w-auto h-10 sm:h-11 text-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
              <Button
                variant="outline"
                onClick={handleProcessExpiry}
                disabled={processingExpiry}
                className="w-full sm:w-auto h-10 sm:h-11 text-sm"
              >
                <Clock className="h-4 w-4 mr-2" />
                Process Expired
              </Button>
              <Button
                variant="outline"
                onClick={onDisconnect}
                className="w-full sm:w-auto h-10 sm:h-11 text-sm"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                <label className="text-sm flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer"
                    checked={showActiveUsersOnly}
                    onChange={handleActiveUsersOnlyChange}
                  />
                  <span className="select-none">Active Users Only</span>
                </label>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedUsers([]);
                  setShowActiveUsersOnly(false);
                }}
                className="w-full sm:w-auto h-10 sm:h-11 text-sm"
              >
                Cancel Selection
              </Button>
              <Button
                onClick={handleBatchExpiry}
                disabled={selectedUsers.length === 0}
                className="w-full sm:w-auto h-10 sm:h-11 text-sm"
              >
                Update {selectedUsers.length} User{selectedUsers.length !== 1 ? 's' : ''}
              </Button>
            </>
          )}
        </div>
      </div>

      {expiryMessage && (
        <Alert variant={expiryMessage.includes('Error') ? 'destructive' : 'default'}>
          <AlertDescription>{expiryMessage}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {showAddForm && (
        <PPPoEUserForm
          credentials={credentials}
          onSuccess={handleAddSuccess}
          onCancel={handleAddCancel}
        />
      )}

      <Sheet open={showExpiryForm} onOpenChange={setShowExpiryForm}>
        <SheetContent side="bottom" className="h-[90vh] sm:h-auto sm:max-w-2xl sm:mx-auto">
          <SheetHeader>
            <SheetTitle>Update Expiry Settings</SheetTitle>
            <SheetDescription>
              {selectedUser ? `Updating expiry for user: ${selectedUser.name}` : 'Select a user to update'}
            </SheetDescription>
          </SheetHeader>
          {showExpiryForm && selectedUser && (
            <div className="mt-6 px-1">
              <PPPoEExpiryForm
                user={selectedUser}
                credentials={credentials}
                onSuccess={handleExpirySuccess}
                onCancel={handleExpiryCancel}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet 
        open={showBatchExpiryForm} 
        onOpenChange={(open) => {
          setShowBatchExpiryForm(open);
          if (!open) {
            setSelectedUsers([]);
            setSelectionMode(false);
            setShowActiveUsersOnly(false);
          }
        }}
      >
        <SheetContent side="bottom" className="h-[90vh] sm:h-auto sm:max-w-3xl sm:mx-auto">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Batch Update Users</SheetTitle>
            <SheetDescription>
              Update expiry settings for {selectedUsers.length} selected user{selectedUsers.length !== 1 ? 's' : ''}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 px-1">
            {showBatchExpiryForm && selectedUsers.length > 0 && (
              <PPPoEBatchExpiryForm
                users={selectedUsers}
                credentials={credentials}
                onSuccess={handleBatchExpirySuccess}
                onCancel={handleBatchExpiryCancel}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {loading ? (
        <Card className="shadow-md">
          <CardContent className="p-3 sm:p-4 md:p-6">
            <div className="text-center py-8 sm:py-12">
              <p className="text-muted-foreground text-sm">Loading users...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {filteredUsers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredUsers.map(user => (
                <div
                  key={user.id}
                  className={`relative ${selectionMode ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
                  onClick={() => selectionMode && toggleUserSelection(user)}
                >
                  {selectionMode && (
                    <div className="absolute -top-2 -right-2 z-10">
                      <div className={`h-7 w-7 sm:h-6 sm:w-6 rounded-full border-2 flex items-center justify-center shadow-md transition-all ${
                        selectedUsers.some(u => u.id === user.id)
                          ? 'bg-blue-500 border-blue-500 scale-110'
                          : 'bg-white border-slate-300'
                      }`}>
                        {selectedUsers.some(u => u.id === user.id) && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )}
                  <PPPoEUserCard
                    user={user}
                    credentials={credentials}
                    onUpdate={loadUsers}
                    onEditExpiry={handleEditExpiry}
                    disabled={selectionMode}
                  />
                </div>
              ))}
            </div>
          ) : (
            <Card className="shadow-md">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="text-center py-8 sm:py-12">
                  <p className="text-muted-foreground text-sm">
                    {searchTerm 
                      ? "No users match your search" 
                      : "No PPPoE users found. Click 'Add User' to create one."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
} 