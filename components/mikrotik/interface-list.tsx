'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InterfaceCard } from './interface-card';
import { 
  MikrotikCredentials, 
  MikrotikInterface, 
  fetchInterfaces,
  toggleInterface
} from '@/lib/mikrotik';

interface InterfaceListProps {
  credentials: MikrotikCredentials;
  onDisconnect: () => void;
}

export function InterfaceList({ credentials, onDisconnect }: InterfaceListProps) {
  const [interfaces, setInterfaces] = useState<MikrotikInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggleLoading, setToggleLoading] = useState<Record<string, boolean>>({});
  
  const loadInterfaces = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchInterfaces(credentials);
      
      // Ensure each interface has a unique ID
      const processedData = data.map((iface, index) => {
        // If id is missing or duplicate, generate a fallback id
        if (!iface.id) {
          return { ...iface, id: `interface-${index}` };
        }
        return iface;
      });
      
      setInterfaces(processedData);
    } catch (err) {
      setError('Failed to load interfaces. Please check your connection.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadInterfaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials.address, credentials.username, credentials.password]);
  
  const handleToggle = async (id: string, disabled: boolean) => {
    setToggleLoading(prev => ({ ...prev, [id]: true }));
    
    try {
      await toggleInterface(credentials, id, disabled);
      
      // Refresh the interface list
      await loadInterfaces();
    } catch (err) {
      setError('Failed to update interface. Please try again.');
      console.error(err);
    } finally {
      setToggleLoading(prev => ({ ...prev, [id]: false }));
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Network Interfaces</h2>
          <p className="text-muted-foreground">
            Connected to {credentials.address}
          </p>
        </div>
        
        <div className="flex space-x-2">
          <Button onClick={loadInterfaces} variant="outline">
            Refresh
          </Button>
          <Button onClick={onDisconnect} variant="ghost">
            Disconnect
          </Button>
        </div>
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {loading ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">Loading interfaces...</p>
        </div>
      ) : interfaces.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No interfaces found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {interfaces.map((iface, index) => (
            <InterfaceCard
              key={iface.id || `interface-${index}`}
              interface={iface}
              onToggle={handleToggle}
              loading={toggleLoading[iface.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
} 