import axios from 'axios';

export interface MikrotikCredentials {
  address: string;
  username: string;
  password: string;
}

export interface MikrotikInterface {
  id: string;
  name: string;
  type: string;
  disabled: boolean;
  'mac-address'?: string;
  running?: boolean;
}

// PPPoE User Interface
export interface MikrotikPPPoEUser {
  id: string;
  name: string;
  password: string;
  service: string;
  profile: string;
  disabled: boolean;
  'caller-id'?: string;
  comment?: string;
  'limit-bytes-in'?: string;
  'limit-bytes-out'?: string;
  // Store expiry date in comment with format [EXPIRY:YYYY-MM-DD]
  expiryDate?: string;
  // Store post-expiry profile in comment with format [POST-EXPIRY:profile_name]
  postExpiryProfile?: string;
}

// Queue Statistics Interface
export interface MikrotikQueueStats {
  name: string;
  'bytes': string;
  'upload-bytes': string;
  'download-bytes': string;
  'formatted-upload': string;  // Added for human-readable upload
  'formatted-download': string;  // Added for human-readable download
  'rate': string;
  'packet-rate': string;
  'packets': string;
  'dropped': string;
  'queued-packets': string;
  'queued-bytes': string;
}

// Active Connection Interface
export interface MikrotikActiveConnection {
  name: string;
  uptime: string;
  address: string;
  'session-id': string;
}

// Create auth header
export const createAuthHeader = (username: string, password: string) => {
  // In browser environments use btoa, in Node.js environments use Buffer
  try {
    // Browser environment
    if (typeof window !== 'undefined' && typeof btoa === 'function') {
      return `Basic ${btoa(`${username}:${password}`)}`;
    } 
    // Node.js environment (API routes)
    else {
      return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }
  } catch (error) {
    console.error('Error creating auth header:', error);
    // Fallback method
    const base64Credentials = Buffer.from(`${username}:${password}`).toString('base64');
    return `Basic ${base64Credentials}`;
  }
};

// Helper to handle CORS issues in development
const getApiUrl = (address: string, endpoint: string) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isUsingTunnel = process.env.NEXT_PUBLIC_USE_CLOUDFLARE_TUNNEL === 'true';
  
  // If we're using the Cloudflare Tunnel
  if (isUsingTunnel) {
    // Use the Cloudflare Tunnel URL
    const tunnelUrl = `https://rg-networks.rvcodes.com/rest/${endpoint}`;
    
    // Always use the proxy to avoid CORS issues in both development and production
    return `/api/mikrotik-proxy?url=${encodeURIComponent(tunnelUrl)}`;
  }
  
  // Check if we're in development mode
  if (isDevelopment) {
    // Use a CORS proxy for development
    return `/api/mikrotik-proxy?url=${encodeURIComponent(`http://${address}/rest/${endpoint}`)}`;
  }
  
  // In production, we assume proper CORS headers are configured
  return `http://${address}/rest/${endpoint}`;
};

// Test connection to router
export const testConnection = async (credentials: MikrotikCredentials) => {
  const { address, username, password } = credentials;
  const authHeader = createAuthHeader(username, password);
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  try {
    // If using Cloudflare Tunnel, we don't need the address from credentials
    const isUsingTunnel = process.env.NEXT_PUBLIC_USE_CLOUDFLARE_TUNNEL === 'true';
    
    let url;
    if (isUsingTunnel) {
      // Always use the proxy to avoid CORS issues in both development and production
      url = `/api/mikrotik-proxy?url=${encodeURIComponent(`https://rg-networks.rvcodes.com/rest/system/resource`)}`;
      
      // Only log in development mode
      if (isDevelopment) {
        console.log('Using tunnel with username:', username);
      }
    } else {
      // Not using tunnel, use the normal getApiUrl function
      url = getApiUrl(address, 'system/resource');
    }
    
    // Only log in development mode
    if (isDevelopment) {
      console.log('Connection test URL:', url);
    }
    
    await axios({
      method: 'GET',
      url,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      timeout: 10000  // Increased timeout for production environment
    });
    
    // If using Cloudflare Tunnel, save the tunnel URL instead of the address
    if (isUsingTunnel) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('mikrotik_using_tunnel', 'true');
      }
    }
    
    return true;
  } catch (error) {
    // Keep error logging in all environments for troubleshooting
    console.error('Connection test failed:', error);
    return false;
  }
};

// Fetch all interfaces
export const fetchInterfaces = async (credentials: MikrotikCredentials) => {
  const { address, username, password } = credentials;
  const authHeader = createAuthHeader(username, password);
  
  try {
    const response = await axios({
      method: 'GET',
      url: getApiUrl(address, 'interface'),
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      }
    });
    
    // Validate and process the response data
    if (!Array.isArray(response.data)) {
      console.error('Invalid response format, expected array:', response.data);
      return [];
    }
    
    // Ensure each interface has the required properties
    const processedData = response.data.map((iface, index) => {
      // Generate a unique ID if missing
      if (!iface.id) {
        iface.id = `interface-${index}`;
      }
      
      // Ensure other required properties exist
      return {
        id: iface.id,
        name: iface.name || `Interface ${index}`,
        type: iface.type || 'unknown',
        disabled: typeof iface.disabled === 'boolean' ? iface.disabled : false,
        'mac-address': iface['mac-address'] || undefined,
        running: typeof iface.running === 'boolean' ? iface.running : undefined
      } as MikrotikInterface;
    });
    
    return processedData;
  } catch (error) {
    console.error('Failed to fetch interfaces:', error);
    throw error;
  }
};

// Toggle interface enabled/disabled state
export const toggleInterface = async (
  credentials: MikrotikCredentials,
  id: string,
  disabled: boolean
) => {
  const { address, username, password } = credentials;
  const authHeader = createAuthHeader(username, password);
  
  try {
    await axios({
      method: 'PATCH',
      url: getApiUrl(address, `interface/${id}`),
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      data: { disabled: !disabled }
    });
    
    return true;
  } catch (error) {
    console.error('Failed to toggle interface:', error);
    throw error;
  }
};

// Save credentials to localStorage (except password)
export const saveCredentials = (credentials: Omit<MikrotikCredentials, 'password'>) => {
  if (typeof window !== 'undefined') {
    // If using Cloudflare Tunnel, we don't need to store the actual address
    if (process.env.NEXT_PUBLIC_USE_CLOUDFLARE_TUNNEL === 'true') {
      localStorage.setItem('mikrotik_address', 'cloudflare-tunnel');
    } else {
      localStorage.setItem('mikrotik_address', credentials.address);
    }
    
    localStorage.setItem('mikrotik_username', credentials.username);
    localStorage.setItem('mikrotik_connected', 'true');
  }
};

// Load credentials from localStorage
export const loadCredentials = (): Partial<MikrotikCredentials> => {
  if (typeof window !== 'undefined') {
    return {
      address: localStorage.getItem('mikrotik_address') || '',
      username: localStorage.getItem('mikrotik_username') || '',
    };
  }
  return {};
};

// Check if we have stored credentials
export const hasStoredCredentials = (): boolean => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('mikrotik_connected') === 'true';
  }
  return false;
};

// Clear stored credentials
export const clearCredentials = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('mikrotik_connected');
    localStorage.removeItem('mikrotik_using_tunnel');
  }
};

// Fetch all PPPoE users
export const fetchPPPoEUsers = async (credentials: MikrotikCredentials) => {
  const { address, username, password } = credentials;
  const authHeader = createAuthHeader(username, password);
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  try {
    const response = await axios({
      method: 'GET',
      url: getApiUrl(address, 'ppp/secret'),
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      }
    });
    
    // Validate and process the response data
    if (!Array.isArray(response.data)) {
      console.error('Invalid response format, expected array:', response.data);
      return [];
    }
    
    // Filter for PPPoE users only and ensure each user has the required properties
    const processedData = response.data
      .filter(user => user.service === 'pppoe' || !user.service)
      .map((user, index) => {
        // Generate a unique ID if missing
        if (!user.id) {
          user.id = `pppoe-user-${index}`;
        }
        
        // Debug log for disabled state only in development mode
        if (isDevelopment) {
          console.log(`Processing user ${user.name}, disabled state:`, user.disabled);
        }
        
        // Ensure other required properties exist
        return {
          id: user.id,
          name: user.name || `User ${index}`,
          password: user.password || '',
          service: user.service || 'pppoe',
          profile: user.profile || 'default',
          disabled: user.disabled === 'true' || user.disabled === true || false,
          'caller-id': user['caller-id'] || undefined,
          comment: user.comment || undefined,
          'limit-bytes-in': user['limit-bytes-in'] || undefined,
          'limit-bytes-out': user['limit-bytes-out'] || undefined
        } as MikrotikPPPoEUser;
      });
    
    return processedData;
  } catch (error) {
    console.error('Failed to fetch PPPoE users:', error);
    throw error;
  }
};

// Add a new PPPoE user
export const addPPPoEUser = async (
  credentials: MikrotikCredentials,
  user: Omit<MikrotikPPPoEUser, 'id'>
) => {
  const { address, username, password } = credentials;
  const authHeader = createAuthHeader(username, password);
  
  try {
    await axios({
      method: 'PUT',
      url: getApiUrl(address, 'ppp/secret'),
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      data: {
        ...user,
        service: user.service || 'pppoe'
      }
    });
    
    return true;
  } catch (error) {
    console.error('Failed to add PPPoE user:', error);
    throw error;
  }
};

// Helper function to prepare valid updates for a PPPoE user
const prepareUserUpdates = (updates: Partial<Omit<MikrotikPPPoEUser, 'id'>>, isDevelopment: boolean): Record<string, string | boolean> => {
  const validUpdates: Record<string, string | boolean> = {};
  
  // Only include fields that are defined and non-null
  if (updates.name !== undefined && updates.name !== null) validUpdates.name = updates.name;
  if (updates.password !== undefined && updates.password !== null) validUpdates.password = updates.password;
  if (updates.service !== undefined && updates.service !== null) validUpdates.service = updates.service;
  if (updates.profile !== undefined && updates.profile !== null) validUpdates.profile = updates.profile;
  if (updates.disabled !== undefined && updates.disabled !== null) {
    // Ensure disabled is a boolean
    validUpdates.disabled = updates.disabled === true || String(updates.disabled) === 'true';
    if (isDevelopment) {
      console.log(`Setting disabled state to:`, validUpdates.disabled);
    }
  }
  if (updates['caller-id'] !== undefined && updates['caller-id'] !== null) validUpdates['caller-id'] = updates['caller-id'];
  if (updates.comment !== undefined) validUpdates.comment = updates.comment || ''; // Allow empty string
  if (updates['limit-bytes-in'] !== undefined && updates['limit-bytes-in'] !== null) validUpdates['limit-bytes-in'] = updates['limit-bytes-in'];
  if (updates['limit-bytes-out'] !== undefined && updates['limit-bytes-out'] !== null) validUpdates['limit-bytes-out'] = updates['limit-bytes-out'];
  
  // Special handling for comment field
  if ('comment' in validUpdates) {
    // Ensure comment is a string
    validUpdates.comment = String(validUpdates.comment);
    
    // Limit comment length
    if (validUpdates.comment.length > 255) {
      validUpdates.comment = validUpdates.comment.substring(0, 255);
      console.warn('Comment truncated to 255 characters');
    }
    
    // Escape special characters
    validUpdates.comment = validUpdates.comment
      .replace(/"/g, '')
      .replace(/'/g, '')
      .replace(/\\/g, '');
  }
  
  return validUpdates;
};

// Helper function to get the MikroTik ID from our custom ID
const getMikrotikId = async (
  credentials: MikrotikCredentials,
  id: string,
  updates: Partial<Omit<MikrotikPPPoEUser, 'id'>>,
  isDevelopment: boolean
): Promise<{ mikrotikId: string, userName: string | undefined }> => {
  const { address, username, password } = credentials;
  const authHeader = createAuthHeader(username, password);
  
  // If it already starts with '*', it's already a MikroTik ID
  if (id.startsWith('*')) {
    return { mikrotikId: id, userName: updates.name };
  }
  
  if (isDevelopment) {
    console.log('Converting custom ID to MikroTik ID format...');
  }
  
  // If we have a name in the updates, use that to find the user
  let userName = updates.name;
  
  if (!userName) {
    // We need to fetch all users to find the one with our custom ID
    const users = await fetchPPPoEUsers(credentials);
    const user = users.find(u => u.id === id);
    
    if (!user) {
      throw new Error(`User with ID ${id} not found`);
    }
    
    userName = user.name;
  }
  
  // Fetch the user by name to get the actual MikroTik ID
  const response = await axios({
    method: 'GET',
    url: getApiUrl(address, `ppp/secret?name=${encodeURIComponent(userName)}`),
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    }
  });
  
  if (!Array.isArray(response.data) || response.data.length === 0) {
    throw new Error(`User with name ${userName} not found`);
  }
  
  // Return the actual MikroTik ID
  return { mikrotikId: response.data[0]['.id'], userName };
};

// Helper function to disconnect a user's active session
const disconnectUserSession = async (
  credentials: MikrotikCredentials,
  userName: string,
  isDevelopment: boolean
): Promise<void> => {
  if (!userName) return;
  
  const { address, username, password } = credentials;
  const authHeader = createAuthHeader(username, password);
  
  try {
    // First try to find active sessions by name
    const activeResponse = await axios({
      method: 'GET',
      url: getApiUrl(address, `ppp/active?name=${encodeURIComponent(userName)}`),
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      }
    });
    
    if (Array.isArray(activeResponse.data) && activeResponse.data.length > 0) {
      // User is active, disconnect them
      const activeId = activeResponse.data[0]['.id'];
      await axios({
        method: 'DELETE',
        url: getApiUrl(address, `ppp/active/${activeId}`),
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        }
      });
      
      if (isDevelopment) {
        console.log(`Disconnected active session for user: ${userName}`);
      }
    } else if (isDevelopment) {
      console.log(`No active session found for user: ${userName}`);
    }
  } catch (error) {
    console.error(`Error disconnecting user ${userName}:`, error);
    // We don't throw here - continue even if disconnect fails
  }
};

// Update an existing PPPoE user
export const updatePPPoEUser = async (
  credentials: MikrotikCredentials,
  id: string,
  updates: Partial<Omit<MikrotikPPPoEUser, 'id'>>
) => {
  const { address, username, password } = credentials;
  const authHeader = createAuthHeader(username, password);
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  try {
    // Prepare valid updates
    const validUpdates = prepareUserUpdates(updates, isDevelopment);
    
    // Get the MikroTik ID and current user data
    const { mikrotikId, userName } = await getMikrotikId(credentials, id, updates, isDevelopment);
    
    // Get current user data to check if profile is actually changing
    const currentUserData = await fetchPPPoEUsers(credentials);
    const currentUser = currentUserData.find(u => u.id === id || u.name === updates.name);
    const profileIsChanging = currentUser && updates.profile && currentUser.profile !== updates.profile;
    
    if (isDevelopment) {
      console.log('Current user data:', currentUser);
      console.log('Profile is changing:', profileIsChanging);
      console.log('Current profile:', currentUser?.profile);
      console.log('New profile:', updates.profile);
    }
    
    // Try to update the user
    try {
      await axios({
        method: 'PATCH',
        url: getApiUrl(address, `ppp/secret/${mikrotikId}`),
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        data: validUpdates,
        timeout: 15000 // Increase timeout
      });
      
      // Only disconnect if profile was actually changed
      if (profileIsChanging && userName) {
        if (isDevelopment) {
          console.log('Profile changed, disconnecting user:', userName);
        }
        await disconnectUserSession(credentials, userName, isDevelopment);
      } else if (isDevelopment) {
        console.log('No profile change or no active session to disconnect');
      }
      
      return true;
    } catch (error: unknown) {
      const err = error as Error & {
        response?: {
          status: number;
          data: unknown;
        };
      };
      
      // If the error is related to the comment field, try updating without it
      if ('comment' in validUpdates && err.response?.status === 400) {
        if (isDevelopment) {
          console.log('Comment field caused an error, trying update without comment...');
        }
        
        // Create a copy without the comment field
        const updatesWithoutComment = { ...validUpdates };
        delete updatesWithoutComment.comment;
        
        // Only proceed if there are other fields to update
        if (Object.keys(updatesWithoutComment).length > 0) {
          // First update without the comment
          await axios({
            method: 'PATCH',
            url: getApiUrl(address, `ppp/secret/${mikrotikId}`),
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            data: updatesWithoutComment
          });
          
          // Then try to update just the comment
          try {
            await axios({
              method: 'PATCH',
              url: getApiUrl(address, `ppp/secret/${mikrotikId}`),
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
              },
              data: { comment: validUpdates.comment }
            });
          } catch {
            if (isDevelopment) {
              console.log('Comment update failed, but other fields were updated');
            }
            // Continue since the main update worked
          }
          
          // If profile was changed, disconnect active sessions
          if (profileIsChanging && userName) {
            await disconnectUserSession(credentials, userName, isDevelopment);
          }
          
          return true;
        }
      }
      
      // If we got here, rethrow the original error
      throw err;
    }
  } catch (error: unknown) {
    const err = error as Error & {
      response?: {
        status: number;
        data: unknown;
      };
    };
    console.error('Failed to update PPPoE user:', err);
    throw err;
  }
};

// Delete a PPPoE user
export const deletePPPoEUser = async (
  credentials: MikrotikCredentials,
  id: string
) => {
  const { address, username, password } = credentials;
  const authHeader = createAuthHeader(username, password);
  
  try {
    await axios({
      method: 'DELETE',
      url: getApiUrl(address, `ppp/secret/${id}`),
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      }
    });
    
    return true;
  } catch (error) {
    console.error('Failed to delete PPPoE user:', error);
    throw error;
  }
};

// Fetch PPPoE profiles
export const fetchPPPoEProfiles = async (credentials: MikrotikCredentials) => {
  const { address, username, password } = credentials;
  const authHeader = createAuthHeader(username, password);
  
  try {
    const response = await axios({
      method: 'GET',
      url: getApiUrl(address, 'ppp/profile'),
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      }
    });
    
    // Validate and process the response data
    if (!Array.isArray(response.data)) {
      console.error('Invalid response format, expected array:', response.data);
      return [];
    }
    
    return response.data.map(profile => profile.name);
  } catch (error) {
    console.error('Failed to fetch PPPoE profiles:', error);
    return ['default']; // Return at least the default profile
  }
};

// Format comment with expiry information
export const formatCommentWithExpiry = (
  originalComment: string | undefined,
  expiryDateTime: string | undefined,
  postExpiryProfile: string | undefined
): string => {
  // Using simple comma-separated format: YYYY-MM-DD,HH:MM,ProfileName
  
  // Initialize with empty values
  let datePart = '';
  let timePart = '';
  
  // Process expiry date/time if provided
  if (expiryDateTime) {
    // Validate date format (YYYY-MM-DDThh:mm)
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(expiryDateTime)) {
      // Split date and time
      datePart = expiryDateTime.split('T')[0];
      timePart = expiryDateTime.split('T')[1];
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(expiryDateTime)) {
      // Date-only format
      datePart = expiryDateTime;
      // Default time if not provided
      timePart = '23:59';
    }
  }
  
  // Sanitize the profile name if provided
  const sanitizedProfile = postExpiryProfile ? 
    postExpiryProfile.replace(/[^\w\-]/g, '_') : '';
  
  // Return the comma-separated format
  return `${datePart},${timePart},${sanitizedProfile}`;
};

// Parse expiry date from comment
export const parseExpiryDate = (comment?: string): string | undefined => {
  if (!comment) return undefined;
  
  // New format: YYYY-MM-DD,HH:MM,ProfileName
  const parts = comment.split(',');
  if (parts.length >= 1 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
    return parts[0];
  }
  
  // Fall back to standard format (EXPIRY=YYYY-MM-DD)
  const standardFormatMatch = comment.match(/EXPIRY=(\d{4}-\d{2}-\d{2})/);
  if (standardFormatMatch) return standardFormatMatch[1];
  
  // Fall back to the old format
  const oldFormatMatch = comment.match(/\[EXPIRY:(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2})?\]/);
  return oldFormatMatch ? oldFormatMatch[1] : undefined;
};

// Parse expiry time from comment
export const parseExpiryTime = (comment?: string): string | undefined => {
  if (!comment) return undefined;
  
  // New format: YYYY-MM-DD,HH:MM,ProfileName
  const parts = comment.split(',');
  if (parts.length >= 2 && /^\d{2}:\d{2}$/.test(parts[1])) {
    return parts[1];
  }
  
  // Standard format (TIME=HH:MM)
  const standardFormatMatch = comment.match(/TIME=(\d{2}:\d{2})/);
  if (standardFormatMatch) return standardFormatMatch[1];
  
  // Fall back to older formats for backward compatibility
  const oldFormatWithT = comment.match(/EXPIRY=\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/);
  if (oldFormatWithT) return oldFormatWithT[1];
  
  const oldFormatBrackets = comment.match(/\[EXPIRY:\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})\]/);
  return oldFormatBrackets ? oldFormatBrackets[1] : undefined;
};

// Parse post-expiry profile from comment
export const parsePostExpiryProfile = (comment?: string): string | undefined => {
  if (!comment) return undefined;
  
  // New format: YYYY-MM-DD,HH:MM,ProfileName
  const parts = comment.split(',');
  if (parts.length >= 3 && parts[2].trim() !== '') {
    return parts[2];
  }
  
  // Standard format (POST-EXPIRY=ProfileName)
  const standardFormatMatch = comment.match(/POST-EXPIRY=([^\s]+)/);
  if (standardFormatMatch) return standardFormatMatch[1];
  
  // Fall back to the old format
  const oldFormatMatch = comment.match(/\[POST-EXPIRY:([^\]]+)\]/);
  return oldFormatMatch ? oldFormatMatch[1] : undefined;
};

// Check if a user is expired
export const isUserExpired = (expiryDateTime?: string, expiryTime?: string): boolean => {
  if (!expiryDateTime) return false;
  
  const now = new Date();
  
  // Create expiry date from ISO format YYYY-MM-DD
  let expiry: Date;
  if (expiryTime) {
    // Handle date and separate time format (YYYY-MM-DD and HH:MM)
    const [hours, minutes] = expiryTime.split(':').map(Number);
    expiry = new Date(expiryDateTime);  // This will correctly parse the ISO format
    expiry.setHours(hours, minutes, 0, 0);
  } else {
    // Date-only format (YYYY-MM-DD) - set to end of day
    expiry = new Date(expiryDateTime);  // This will correctly parse the ISO format
    expiry.setHours(23, 59, 59, 999);
  }
  
  return now > expiry;
};

// Calculate days until expiry
export const daysUntilExpiry = (expiryDateTime?: string, expiryTime?: string): number | null => {
  if (!expiryDateTime) return null;
  
  // Create expiry date from ISO format YYYY-MM-DD
  let expiry: Date;
  if (expiryTime) {
    // Handle date and separate time format (YYYY-MM-DD and HH:MM)
    const [hours, minutes] = expiryTime.split(':').map(Number);
    expiry = new Date(expiryDateTime);  // This will correctly parse the ISO format
    expiry.setHours(hours, minutes, 0, 0);
  } else {
    // Date-only format (YYYY-MM-DD) - set to end of day
    expiry = new Date(expiryDateTime);  // This will correctly parse the ISO format
    expiry.setHours(23, 59, 59, 999);
  }
  
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

// Process users for expiry
export const processExpiredUsers = async (credentials: MikrotikCredentials): Promise<number> => {
  const users = await fetchPPPoEUsers(credentials);
  let processedCount = 0;
  
  for (const user of users) {
    const expiryDate = parseExpiryDate(user.comment);
    const expiryTime = parseExpiryTime(user.comment);
    const postExpiryProfile = parsePostExpiryProfile(user.comment);
    
    // Check if we have the required information
    if (expiryDate && postExpiryProfile && isUserExpired(expiryDate, expiryTime) && user.profile !== postExpiryProfile) {
      try {
        console.log(`Processing expired user: ${user.name}`);
        console.log(`Expiry date: ${expiryDate} (ISO format: YYYY-MM-DD), Expiry time: ${expiryTime || '23:59'}, Post-expiry profile: ${postExpiryProfile}`);
        
        // Get the actual MikroTik ID for this user
        const { address, username, password } = credentials;
        const authHeader = createAuthHeader(username, password);
        
        const response = await axios({
          method: 'GET',
          url: getApiUrl(address, `ppp/secret?name=${encodeURIComponent(user.name)}`),
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          }
        });
        
        if (!Array.isArray(response.data) || response.data.length === 0) {
          console.error(`User with name ${user.name} not found`);
          continue;
        }
        
        // Use the actual MikroTik ID
        const mikrotikId = response.data[0]['.id'];
        console.log(`Found actual MikroTik ID for ${user.name}: ${mikrotikId}`);
        
        // Update user profile to post-expiry profile
        await updatePPPoEUser(credentials, mikrotikId, {
          profile: postExpiryProfile
        });
        
        // Disconnect active session to apply new profile
        try {
          await axios({
            method: 'DELETE',
            url: getApiUrl(credentials.address, `ppp/active/${user.name}`),
            headers: {
              'Authorization': createAuthHeader(credentials.username, credentials.password),
              'Content-Type': 'application/json',
            }
          });
          console.log(`Disconnected active session for user: ${user.name}`);
        } catch {
          // Ignore errors when disconnecting - user might not be connected
          console.log(`User ${user.name} not connected or error disconnecting`);
        }
        
        processedCount++;
      } catch (error) {
        console.error(`Failed to process expired user ${user.name}:`, error);
      }
    }
  }
  
  return processedCount;
};

// Helper function to format bytes into human readable format
export const formatBytes = (bytes: string | number): string => {
  const bytesNum = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  
  if (isNaN(bytesNum)) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytesNum === 0) return '0 B';
  
  const i = Math.floor(Math.log(bytesNum) / Math.log(1024));
  if (i === 0) return `${bytesNum} ${sizes[i]}`;
  
  return `${(bytesNum / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

// Fetch queue statistics for a specific user
export const fetchQueueStats = async (
  credentials: MikrotikCredentials,
  userName: string
): Promise<MikrotikQueueStats | null> => {
  const { address, username, password } = credentials;
  const authHeader = createAuthHeader(username, password);
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  try {
    // Format the target name with angle brackets
    const target = `<pppoe-${userName}>`;
    
    // Get queue statistics with the correct URL format
    const response = await axios({
      method: 'GET',
      url: getApiUrl(address, `queue/simple?target=${encodeURIComponent(target)}`),
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      }
    });

    if (isDevelopment) {
      console.log('Queue target:', target);
      console.log('Queue response:', response.data);
    }
    
    if (Array.isArray(response.data) && response.data.length > 0) {
      const stats = response.data[0];
      
      // Parse the bytes data which comes in format "upload/download"
      let uploadBytes = '0';
      let downloadBytes = '0';
      
      if (stats.bytes && typeof stats.bytes === 'string') {
        const parts = stats.bytes.split('/');
        if (parts.length === 2) {
          uploadBytes = parts[0];
          downloadBytes = parts[1];
        }
      }
      
      // Add the parsed data to the stats object with formatted values
      const enhancedStats = {
        ...stats,
        'upload-bytes': uploadBytes,
        'download-bytes': downloadBytes,
        'formatted-upload': formatBytes(uploadBytes),
        'formatted-download': formatBytes(downloadBytes),
      } as MikrotikQueueStats;
      
      if (isDevelopment) {
        console.log('Queue statistics found:', enhancedStats);
      }
      
      return enhancedStats;
    }
    
    // If no results found with angle brackets, try without them as fallback
    const fallbackTarget = `pppoe-${userName}`;
    const fallbackResponse = await axios({
      method: 'GET',
      url: getApiUrl(address, `queue/simple?target=${encodeURIComponent(fallbackTarget)}`),
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      }
    });

    if (Array.isArray(fallbackResponse.data) && fallbackResponse.data.length > 0) {
      const stats = fallbackResponse.data[0];
      
      // Parse the bytes data which comes in format "upload/download"
      let uploadBytes = '0';
      let downloadBytes = '0';
      
      if (stats.bytes && typeof stats.bytes === 'string') {
        const parts = stats.bytes.split('/');
        if (parts.length === 2) {
          uploadBytes = parts[0];
          downloadBytes = parts[1];
        }
      }
      
      // Add the parsed data to the stats object with formatted values
      const enhancedStats = {
        ...stats,
        'upload-bytes': uploadBytes,
        'download-bytes': downloadBytes,
        'formatted-upload': formatBytes(uploadBytes),
        'formatted-download': formatBytes(downloadBytes),
      } as MikrotikQueueStats;
      
      if (isDevelopment) {
        console.log('Queue statistics found (without angle brackets):', enhancedStats);
      }
      
      return enhancedStats;
    }
    
    if (isDevelopment) {
      console.log(`No queue statistics found for user ${userName}`);
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch queue statistics:', error);
    return null;
  }
};

// Fetch active connection information for a specific user
export const fetchActiveConnection = async (
  credentials: MikrotikCredentials,
  userName: string
): Promise<MikrotikActiveConnection | null> => {
  const { address, username, password } = credentials;
  const authHeader = createAuthHeader(username, password);
  
  try {
    const response = await axios({
      method: 'GET',
      url: getApiUrl(address, `ppp/active?name=${encodeURIComponent(userName)}`),
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      }
    });
    
    if (Array.isArray(response.data) && response.data.length > 0) {
      return response.data[0] as MikrotikActiveConnection;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to fetch active connection:', error);
    return null;
  }
}; 