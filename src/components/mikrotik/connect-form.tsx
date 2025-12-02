'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MikrotikCredentials, 
  testConnection, 
  saveCredentials 
} from '@/lib/mikrotik';
import { Wifi, User, Lock, AlertCircle, Server, ArrowRight, Cloud } from 'lucide-react';

interface ConnectFormProps {
  onConnect: (credentials: MikrotikCredentials) => void;
  initialValues?: Partial<MikrotikCredentials>;
}

export function ConnectForm({ onConnect, initialValues = {} }: ConnectFormProps) {
  const [usingCloudflare, setUsingCloudflare] = useState(false);
  const [credentials, setCredentials] = useState<MikrotikCredentials>({
    address: initialValues.address || '10.0.0.1',
    username: initialValues.username || 'admin',
    password: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  
  // Check if we're using Cloudflare Tunnel
  useEffect(() => {
    const isUsingTunnel = process.env.NEXT_PUBLIC_USE_CLOUDFLARE_TUNNEL === 'true';
    setUsingCloudflare(isUsingTunnel);
    
    // If using Cloudflare Tunnel, set a placeholder address
    if (isUsingTunnel) {
      setCredentials(prev => ({
        ...prev,
        address: 'cloudflare-tunnel'
      }));
    }
  }, []);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
  };
  
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDebugInfo(null);
    
    try {
      // Add debug info
      setDebugInfo(`Attempting to connect ${usingCloudflare ? 'via Cloudflare Tunnel' : `to ${credentials.address}`}...`);
      
      const connected = await testConnection(credentials);
      
      if (connected) {
        // Save credentials (except password)
        saveCredentials({
          address: credentials.address,
          username: credentials.username,
        });
        
        // Notify parent component
        onConnect(credentials);
      } else {
        setError('Could not connect to the router. Please check your credentials and network connection.');
        setDebugInfo('Connection test returned false. The router did not respond correctly.');
      }
    } catch (err: unknown) {
      const error = err as Error & { code?: string };
      
      // Check for network errors which are often CORS-related in development
      if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        if (usingCloudflare) {
          setError('Network error connecting to Cloudflare Tunnel. This may be due to CORS restrictions.');
          setDebugInfo(`
If you're running in development mode, this is likely a CORS issue.
Make sure:
1. Your Cloudflare Tunnel is running and accessible
2. Try clearing your browser cache or using an incognito window
3. Check the browser console for more detailed error messages
          `);
        } else {
          setError('Network error. Make sure you are on the same network or connected via ZeroTier.');
          setDebugInfo(`Error details: Network Error - Cannot reach the router at ${credentials.address}`);
        }
      } else {
        setError(usingCloudflare 
          ? 'Connection error. Make sure your Cloudflare Tunnel is running properly.' 
          : 'Connection error. Make sure you are on the same network or connected via ZeroTier.');
        // Add detailed error information
        setDebugInfo(`Error details: ${error.message || 'Unknown error'}`);
      }
      
      console.error('Connection error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card className="w-full shadow-lg border-t-4 border-blue-500">
      <CardHeader className="space-y-1 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
        <div className="flex items-center justify-center mb-2">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100 flex items-center justify-center">
            {usingCloudflare ? (
              <Cloud className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
            ) : (
              <Server className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
            )}
          </div>
        </div>
        <CardTitle className="text-xl sm:text-2xl font-bold text-center">
          {usingCloudflare ? 'Connect via Cloudflare' : 'Connect to Mikrotik'}
        </CardTitle>
        <CardDescription className="text-center text-sm">
          {usingCloudflare 
            ? 'Enter your router credentials to connect via Cloudflare Tunnel' 
            : 'Enter your router details to manage PPPoE users'}
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={handleConnect}>
        <CardContent className="space-y-4 px-4 sm:px-6">
          {error && (
            <Alert variant="destructive" className="animate-pulse text-xs sm:text-sm py-2 sm:py-3">
              <AlertCircle className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
              <AlertDescription className="break-words">{error}</AlertDescription>
              {debugInfo && (
                <div className="mt-2 text-xs font-mono bg-black/10 p-2 rounded overflow-auto max-h-24 w-full">
                  {debugInfo}
                </div>
              )}
            </Alert>
          )}
          
          {!usingCloudflare && (
            <div className="space-y-2">
              <label htmlFor="address" className="text-sm font-medium flex items-center gap-2">
                <Wifi className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                Router IP Address
              </label>
              <Input
                id="address"
                name="address"
                value={credentials.address}
                onChange={handleChange}
                placeholder="192.168.88.1"
                required
                className="focus-visible:ring-blue-500 h-9 text-sm"
              />
              <p className="text-xs text-muted-foreground pl-6">
                IP address of your Mikrotik router on your local or ZeroTier network
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              Username
            </label>
            <Input
              id="username"
              name="username"
              value={credentials.username}
              onChange={handleChange}
              required
              className="focus-visible:ring-blue-500 h-9 text-sm"
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              value={credentials.password}
              onChange={handleChange}
              required
              className="focus-visible:ring-blue-500 h-9 text-sm"
            />
          </div>
          
          <Alert className="bg-blue-50 border-blue-200 text-xs sm:text-sm py-2 sm:py-3">
            <AlertDescription className="flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-blue-500" />
              <span>
                {usingCloudflare 
                  ? 'Connecting via Cloudflare Tunnel. Make sure your tunnel is properly configured and running.' 
                  : 'Make sure your device is on the same network as your Mikrotik router or connected via ZeroTier with proper routes configured.'}
              </span>
            </AlertDescription>
          </Alert>
        </CardContent>
        
        <CardFooter className="px-4 sm:px-6 pb-4 sm:pb-6 pt-2">
          <Button 
            type="submit" 
            className="w-full flex items-center justify-center gap-2 h-10 sm:h-11 bg-blue-500 hover:bg-blue-600 text-sm sm:text-base" 
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full"></div>
                Connecting...
              </>
            ) : (
              <>
                Connect
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
} 