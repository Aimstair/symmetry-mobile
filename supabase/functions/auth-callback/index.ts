import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

/**
 * OAuth Callback Handler Edge Function
 * 
 * This function handles the OAuth redirect from Supabase Auth.
 * 
 * IMPORTANT: Supabase sends tokens in the URL hash fragment (#access_token=...)
 * Hash fragments are NOT sent to the server - they only exist client-side.
 * 
 * This page uses JavaScript to:
 * 1. Extract tokens from the hash fragment
 * 2. Redirect back to the Expo app with tokens in the URL
 * 
 * The app_redirect query parameter tells us where to redirect:
 * - For Expo Go: exp://[host]:8081/--/auth/callback
 * - For production: symmetry://auth/callback
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  
  // Get the app redirect URL from query params (passed by the app)
  const appRedirect = url.searchParams.get('app_redirect') || ''
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Symmetry - Sign In Complete</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0A0A0F 0%, #1a1a2e 50%, #0A0A0F 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .container { text-align: center; padding: 2rem; max-width: 400px; }
    .success-icon {
      width: 80px; height: 80px;
      background: linear-gradient(135deg, #31D5E3, #22c55e);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 1.5rem;
      font-size: 40px;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #31D5E3; }
    p { color: #9ca3af; margin-bottom: 1.5rem; line-height: 1.6; }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #31D5E3, #22c55e);
      color: black;
      font-weight: 600;
      padding: 1rem 2rem;
      border-radius: 12px;
      text-decoration: none;
      margin-bottom: 1rem;
      transition: transform 0.2s;
      border: none;
      cursor: pointer;
      font-size: 1rem;
    }
    .button:hover { transform: scale(1.05); }
    .button:active { transform: scale(0.98); }
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid rgba(49, 213, 227, 0.3);
      border-top-color: #31D5E3;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.5);
      padding: 1rem;
      border-radius: 8px;
      color: #ef4444;
      display: none;
    }
    .error.show { display: block; }
    .hint { font-size: 0.875rem; color: #6b7280; margin-top: 1rem; }
    .hidden { display: none; }
    .debug { font-size: 0.75rem; color: #4b5563; margin-top: 1rem; word-break: break-all; }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">✓</div>
    <h1 id="title">Sign In Successful!</h1>
    <p id="message">Redirecting you back to Symmetry...</p>
    
    <div id="loading">
      <div class="spinner"></div>
    </div>
    
    <div id="manual" class="hidden">
      <button class="button" onclick="returnToApp()">
        Return to Symmetry
      </button>
      <p class="hint">Tap the button above or close this window and return to the Expo Go app.</p>
    </div>
    
    <div id="error" class="error"></div>
  </div>

  <script>
    // Config from server - app redirect URL passed from the mobile app
    const APP_REDIRECT = '${appRedirect}';
    
    // Extract tokens from URL hash (Supabase puts tokens here)
    function getTokensFromHash() {
      const hash = window.location.hash.substring(1);
      if (!hash) return null;
      
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      
      if (!accessToken) return null;
      
      return {
        access_token: accessToken,
        refresh_token: refreshToken || '',
        expires_at: params.get('expires_at') || '',
        token_type: params.get('token_type') || 'bearer'
      };
    }
    
    function showError(msg) {
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('manual').classList.add('hidden');
      document.getElementById('error').textContent = msg;
      document.getElementById('error').classList.add('show');
      document.getElementById('title').textContent = 'Sign In Issue';
      document.getElementById('message').textContent = 'There was a problem completing sign in.';
    }
    
    function showManualReturn() {
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('manual').classList.remove('hidden');
      document.getElementById('message').textContent = 'Automatic redirect did not work. Please tap the button below.';
    }
    
    function buildRedirectUrl(tokens) {
      // Build the redirect URL with tokens as query parameters
      // Using query params instead of hash so they work with deep links
      const params = new URLSearchParams();
      params.set('access_token', tokens.access_token);
      params.set('refresh_token', tokens.refresh_token);
      if (tokens.expires_at) params.set('expires_at', tokens.expires_at);
      if (tokens.token_type) params.set('token_type', tokens.token_type);
      
      // Use the app redirect URL passed from the mobile app
      if (APP_REDIRECT) {
        return APP_REDIRECT + '?' + params.toString();
      }
      
      // Fallback: try to construct Expo Go URL
      // This uses the current page's hostname as a hint
      const hostname = window.location.hostname;
      // Remove .nip.io suffix if present to get base IP
      const baseHost = hostname.replace('.nip.io', '');
      
      // Try Expo Go URL
      return 'exp://' + baseHost + ':8081/--/auth/callback?' + params.toString();
    }
    
    function returnToApp() {
      const tokens = getTokensFromHash();
      
      if (!tokens) {
        showError('No authentication tokens found. Please try signing in again.');
        return;
      }
      
      const redirectUrl = buildRedirectUrl(tokens);
      console.log('Redirecting to:', redirectUrl);
      
      // Attempt the redirect
      window.location.href = redirectUrl;
      
      // If we're still here after 1.5s, show manual button
      setTimeout(showManualReturn, 1500);
    }
    
    // On page load
    window.onload = function() {
      // Debug: Show what URL we received
      console.log('Full URL:', window.location.href);
      console.log('Hash:', window.location.hash);
      console.log('Search:', window.location.search);
      
      const tokens = getTokensFromHash();
      
      if (!tokens) {
        // Check if this is just a page load without tokens (user navigated here directly)
        if (!window.location.hash) {
          // Also check URL search params for tokens (some flows put them there)
          const searchParams = new URLSearchParams(window.location.search);
          const accessTokenFromSearch = searchParams.get('access_token');
          
          if (accessTokenFromSearch) {
            // Tokens are in query string, not hash
            const tokensFromSearch = {
              access_token: accessTokenFromSearch,
              refresh_token: searchParams.get('refresh_token') || '',
              expires_at: searchParams.get('expires_at') || '',
              token_type: searchParams.get('token_type') || 'bearer'
            };
            const redirectUrl = buildRedirectUrl(tokensFromSearch);
            console.log('Found tokens in search params, redirecting to:', redirectUrl);
            window.location.href = redirectUrl;
            setTimeout(showManualReturn, 1500);
            return;
          }
          
          // Show debug info
          document.getElementById('title').textContent = 'Waiting for Authentication';
          document.getElementById('message').innerHTML = 
            'Please complete the sign-in process...<br><small style="color:#666;font-size:0.7rem;word-break:break-all;">Debug: ' + 
            window.location.href.substring(0, 200) + '</small>';
          document.getElementById('loading').classList.add('hidden');
        } else {
          showError('No valid tokens found in the URL. Hash: ' + window.location.hash.substring(0, 50));
        }
        return;
      }
      
      // Small delay then auto-redirect
      setTimeout(returnToApp, 300);
    };
  </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
})
