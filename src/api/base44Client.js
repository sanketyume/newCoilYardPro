import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "68f794f8e33750a5f5b8c09b", 
  requiresAuth: true // Ensure authentication is required for all operations
});
