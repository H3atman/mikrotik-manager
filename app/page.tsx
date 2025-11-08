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
    <main className="container mx-auto py-3 sm:py-6 md:py-8 px-3 sm:px-4 max-w-7xl flex flex-col min-h-screen">
      <header className="mb-4 sm:mb-6 md:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-blue-500 tracking-tight">
          Mikrotik PPPoE Manager
        </h1>
        <p className="text-center text-xs sm:text-sm text-muted-foreground mt-2">
          Manage your MikroTik PPPoE users with ease
        </p>
      </header>
      
      <div className="flex-grow">
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
      </div>
      
      <footer className="mt-6 sm:mt-8 md:mt-12 text-center text-xs sm:text-sm text-muted-foreground py-4 border-t">
        <p className="mb-1">
          Made with <span className="text-blue-500">Next.js</span> and <span className="text-blue-500">shadcn/ui</span>
        </p>
        <p className="text-xs text-muted-foreground/70">
          Works with local, ZeroTier, or Cloudflare Tunnel connections
        </p>
      </footer>
    </main>
  );
}
