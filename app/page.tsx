'use client';

import { useState, useEffect } from 'react';
import { ConnectForm } from '@/components/mikrotik/connect-form';
import { PPPoEUserList } from '@/components/mikrotik/pppoe-user-list';
import { 
  MikrotikCredentials, 
  loadCredentials,
  hasStoredCredentials,
  clearCredentials
} from '@/lib/mikrotik';

export default function Home() {
  const [credentials, setCredentials] = useState<MikrotikCredentials | null>(null);
  const [initialValues, setInitialValues] = useState<Partial<MikrotikCredentials>>({});
  
  // Check for stored credentials on component mount
  useEffect(() => {
    if (hasStoredCredentials()) {
      const storedCreds = loadCredentials();
      setInitialValues(storedCreds);
    }
  }, []);
  
  const handleConnect = (creds: MikrotikCredentials) => {
    setCredentials(creds);
  };
  
  const handleDisconnect = () => {
    setCredentials(null);
    clearCredentials();
  };
  
  return (
    <main className="container mx-auto py-4 sm:py-6 md:py-8 px-3 sm:px-4 max-w-7xl">
      <h1 className="text-2xl sm:text-3xl font-bold text-center mb-4 sm:mb-6 md:mb-8 text-blue-500">
        Mikrotik PPPoE Manager
      </h1>
      
      {credentials ? (
        <div className="space-y-4 sm:space-y-6">
          <PPPoEUserList
            credentials={credentials}
            onDisconnect={handleDisconnect}
          />
        </div>
      ) : (
        <div className="w-full max-w-md mx-auto px-2 sm:px-0">
          <ConnectForm 
            onConnect={handleConnect} 
            initialValues={initialValues}
          />
        </div>
      )}
      
      <footer className="mt-8 sm:mt-12 md:mt-16 text-center text-xs sm:text-sm text-muted-foreground py-4">
        <p>
          Made with Next.js and shadcn UI. Works with local or ZeroTier network connections.
        </p>
      </footer>
    </main>
  );
}
