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

// Create auth header
export const createAuthHeader = (username: string, password: string) => {
  return `Basic ${btoa(`${username}:${password}`)}`;
};

// Helper to handle CORS issues in development
const getApiUrl = (address: string, endpoint: string) => {
  // Check if we're in development mode
  if (process.env.NODE_ENV === 'development') {
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
  
  try {
    await axios({
      method: 'GET',
      url: getApiUrl(address, 'system/resource'),
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      timeout: 5000
    });
    return true;
  } catch (error) {
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
    localStorage.setItem('mikrotik_address', credentials.address);
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
  }
};

// Fetch all PPPoE users
export const fetchPPPoEUsers = async (credentials: MikrotikCredentials) => {
  const { address, username, password } = credentials;
  const authHeader = createAuthHeader(username, password);
  
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
        
        // Debug log for disabled state
        console.log(`Processing user ${user.name}, disabled state:`, user.disabled);
        
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

// Update an existing PPPoE user
export const updatePPPoEUser = async (
  credentials: MikrotikCredentials,
  id: string,
  updates: Partial<Omit<MikrotikPPPoEUser, 'id'>>
) => {
  const { address, username, password } = credentials;
  const authHeader = createAuthHeader(username, password);
  
  try {
    // Ensure we're only sending valid fields
    const validUpdates: Record<string, any> = {};
    
    // Only include fields that are defined and non-null
    if (updates.name !== undefined && updates.name !== null) validUpdates.name = updates.name;
    if (updates.password !== undefined && updates.password !== null) validUpdates.password = updates.password;
    if (updates.service !== undefined && updates.service !== null) validUpdates.service = updates.service;
    if (updates.profile !== undefined && updates.profile !== null) validUpdates.profile = updates.profile;
    if (updates.disabled !== undefined && updates.disabled !== null) {
      // Ensure disabled is a boolean
      validUpdates.disabled = updates.disabled === true || String(updates.disabled) === 'true';
      console.log(`Setting disabled state for ${id} to:`, validUpdates.disabled);
    }
    if (updates['caller-id'] !== undefined && updates['caller-id'] !== null) validUpdates['caller-id'] = updates['caller-id'];
    if (updates.comment !== undefined) validUpdates.comment = updates.comment || ''; // Allow empty string
    if (updates['limit-bytes-in'] !== undefined && updates['limit-bytes-in'] !== null) validUpdates['limit-bytes-in'] = updates['limit-bytes-in'];
    if (updates['limit-bytes-out'] !== undefined && updates['limit-bytes-out'] !== null) validUpdates['limit-bytes-out'] = updates['limit-bytes-out'];
    
    console.log('Updating PPPoE user:', id);
    console.log('Update data:', validUpdates);
    
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
      
      console.log('Sanitized comment:', validUpdates.comment);
    }
    
    // Check if the ID is our custom format or the MikroTik API's .id format
    // If it doesn't start with '*', it's likely our custom format and we need to fetch the real ID
    if (!id.startsWith('*')) {
      console.log('Custom ID format detected, fetching the actual MikroTik ID...');
      
      // If we have a name in the updates, use that to find the user
      // Otherwise, we need to fetch all users and find the one with our custom ID
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
      
      // Use the actual MikroTik ID
      id = response.data[0]['.id'];
      console.log('Found actual MikroTik ID:', id);
    }
    
    // Try direct API call first
    try {
      const response = await axios({
        method: 'PATCH',
        url: getApiUrl(address, `ppp/secret/${id}`),
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        data: validUpdates,
        timeout: 15000 // Increase timeout
      });
      
      console.log('Update response status:', response.status);
      return true;
    } catch (directError: any) {
      console.error('Direct API call failed:', directError.message);
      
      // If the error is related to the comment field, try updating without it
      if ('comment' in validUpdates && directError.response?.status === 400) {
        console.log('Trying update without comment field...');
        
        // Create a copy without the comment field
        const updatesWithoutComment = { ...validUpdates };
        delete updatesWithoutComment.comment;
        
        // Only proceed if there are other fields to update
        if (Object.keys(updatesWithoutComment).length > 0) {
          const response = await axios({
            method: 'PATCH',
            url: getApiUrl(address, `ppp/secret/${id}`),
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            data: updatesWithoutComment
          });
          
          console.log('Update without comment succeeded, now trying to update just the comment...');
          
          // Now try to update just the comment in a separate request
          try {
            await axios({
              method: 'PATCH',
              url: getApiUrl(address, `ppp/secret/${id}`),
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
              },
              data: { comment: validUpdates.comment }
            });
            
            console.log('Comment update succeeded!');
            return true;
          } catch (commentError) {
            console.error('Comment update failed, but other fields were updated');
            return true; // Return success since the main update worked
          }
        }
      }
      
      // If we got here, rethrow the original error
      throw directError;
    }
  } catch (error: any) {
    console.error('Failed to update PPPoE user:', error);
    
    // Enhanced error logging
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    // Throw a more informative error
    throw new Error(
      error.response?.data?.message || 
      error.response?.statusText || 
      error.message || 
      'Unknown error updating PPPoE user'
    );
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
        } catch (error) {
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