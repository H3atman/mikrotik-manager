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
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

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
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            className={refreshing ? 'animate-spin' : ''}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          {!selectionMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => setSelectionMode(true)}
              >
                <Users className="h-4 w-4 mr-1" />
                Select Users
              </Button>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add User
              </Button>
              <Button
                variant="outline"
                onClick={handleProcessExpiry}
                disabled={processingExpiry}
              >
                <Clock className="h-4 w-4 mr-1" />
                Process Expired
              </Button>
              <Button
                variant="outline"
                onClick={onDisconnect}
              >
                <LogOut className="h-4 w-4 mr-1" />
                Disconnect
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mr-4">
                <label className="text-sm">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={showActiveUsersOnly}
                    onChange={handleActiveUsersOnlyChange}
                  />
                  Active Users Only
                </label>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedUsers([]);
                  setShowActiveUsersOnly(false);
                }}
              >
                Cancel Selection
              </Button>
              <Button
                onClick={handleBatchExpiry}
                disabled={selectedUsers.length === 0}
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

      <Drawer open={showExpiryForm} onOpenChange={setShowExpiryForm}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Update Expiry Settings</DrawerTitle>
            <DrawerDescription>
              {selectedUser ? `Updating expiry for user: ${selectedUser.name}` : 'Select a user to update'}
            </DrawerDescription>
          </DrawerHeader>
          {showExpiryForm && selectedUser && (
            <div className="px-4 pb-4">
              <PPPoEExpiryForm
                user={selectedUser}
                credentials={credentials}
                onSuccess={handleExpirySuccess}
                onCancel={handleExpiryCancel}
              />
            </div>
          )}
        </DrawerContent>
      </Drawer>

      <Drawer 
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
        <DrawerContent>
          <DrawerHeader className="border-b">
            <DrawerTitle>Batch Update Users</DrawerTitle>
            <DrawerDescription>
              Update expiry settings for {selectedUsers.length} selected user{selectedUsers.length !== 1 ? 's' : ''}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 py-6">
            {showBatchExpiryForm && selectedUsers.length > 0 && (
              <PPPoEBatchExpiryForm
                users={selectedUsers}
                credentials={credentials}
                onSuccess={handleBatchExpirySuccess}
                onCancel={handleBatchExpiryCancel}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>

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
                  className={`relative ${selectionMode ? 'cursor-pointer' : ''}`}
                  onClick={() => selectionMode && toggleUserSelection(user)}
                >
                  {selectionMode && (
                    <div className="absolute -top-2 -right-2 z-10">
                      <div className={`h-5 w-5 rounded-full border-2 ${
                        selectedUsers.some(u => u.id === user.id)
                          ? 'bg-blue-500 border-blue-500'
                          : 'bg-white border-slate-300'
                      }`} />
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