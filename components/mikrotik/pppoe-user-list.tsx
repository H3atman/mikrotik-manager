'use client';

import { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Plus, RefreshCw, LogOut, Clock } from 'lucide-react';

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
  const [selectedUser, setSelectedUser] = useState<MikrotikPPPoEUser | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingExpiry, setProcessingExpiry] = useState(false);
  const [expiryMessage, setExpiryMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const userData = await fetchPPPoEUsers(credentials);
      setUsers(userData);
    } catch (err: any) {
      setError(`Failed to load PPPoE users: ${err.message}`);
      console.error('Load users error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, [credentials]);
  
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
    } catch (err: any) {
      setExpiryMessage(`Error processing expired users: ${err.message}`);
      console.error('Process expiry error:', err);
    } finally {
      setProcessingExpiry(false);
    }
  };
  
  // Filter users based on search term
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.comment && user.comment.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardContent className="p-3 sm:p-4 md:p-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-blue-500">PPPoE Users</h2>
            
            <div className="flex flex-wrap gap-2 justify-center md:justify-end w-full md:w-auto">
              <Button 
                variant="outline" 
                onClick={onDisconnect}
                className="flex items-center gap-1 h-8 text-xs sm:text-sm"
                size="sm"
              >
                <LogOut className="h-3.5 w-3.5" />
                Disconnect
              </Button>
              
              <Button 
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="flex items-center gap-1 h-8 text-xs sm:text-sm"
                size="sm"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
              
              <Button 
                variant="outline"
                onClick={handleProcessExpiry}
                disabled={processingExpiry}
                className="flex items-center gap-1 h-8 text-xs sm:text-sm"
                size="sm"
              >
                <Clock className="h-3.5 w-3.5" />
                {processingExpiry ? "Processing..." : "Process Expired"}
              </Button>
              
              <Button 
                onClick={() => setShowAddForm(true)}
                disabled={showAddForm}
                className="flex items-center gap-1 h-8 text-xs sm:text-sm bg-blue-500 hover:bg-blue-600"
                size="sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Add User
              </Button>
            </div>
          </div>
          
          {error && (
            <Alert variant="destructive" className="mb-4 text-xs sm:text-sm">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {expiryMessage && (
            <Alert 
              variant={expiryMessage.includes('Error') ? 'destructive' : 'default'}
              className="mb-4 text-xs sm:text-sm"
            >
              <AlertDescription>{expiryMessage}</AlertDescription>
            </Alert>
          )}
          
          {!showAddForm && !showExpiryForm && (
            <div className="relative mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search users by name or comment..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full h-9 text-sm"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {showAddForm ? (
        <Card className="shadow-md">
          <CardContent className="p-3 sm:p-4 md:p-6">
            <PPPoEUserForm 
              credentials={credentials}
              onSuccess={handleAddSuccess}
              onCancel={handleAddCancel}
            />
          </CardContent>
        </Card>
      ) : showExpiryForm && selectedUser ? (
        <Card className="shadow-md">
          <CardContent className="p-3 sm:p-4 md:p-6">
            <PPPoEExpiryForm
              user={selectedUser}
              credentials={credentials}
              onSuccess={handleExpirySuccess}
              onCancel={handleExpiryCancel}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {loading ? (
            <Card className="shadow-md">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex justify-center items-center py-8 sm:py-12">
                  <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-blue-500"></div>
                </div>
              </CardContent>
            </Card>
          ) : filteredUsers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredUsers.map(user => (
                <PPPoEUserCard
                  key={user.id}
                  user={user}
                  credentials={credentials}
                  onUpdate={loadUsers}
                  onEditExpiry={handleEditExpiry}
                />
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