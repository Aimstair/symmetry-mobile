import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

/**
 * OAuth Callback Handler Edge Function
 * 
 * This function handles the OAuth redirect and displays the tokens
 * so users can be redirected back to the Expo app.
 * 
 * In Expo Go development, the WebBrowser can't automatically detect
 * the redirect, so this page helps bridge the gap.
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
  
  // This page will be shown after OAuth redirect
  // It extracts tokens from the URL hash and provides a way back to the app
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Symmetry - Sign In Complete</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0A0A0F 0%, #1a1a2e 50%, #0A0A0F 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 400px;
    }
    .success-icon {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #31D5E3, #22c55e);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
      font-size: 40px;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
      color: #31D5E3;
    }
    p {
      color: #9ca3af;
      margin-bottom: 1.5rem;
      line-height: 1.6;
    }
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
    }
    .button:hover {
      transform: scale(1.05);
    }
    .button:active {
      transform: scale(0.98);
    }
    .loading {
      display: none;
    }
    .loading.show {
      display: block;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(49, 213, 227, 0.3);
      border-top-color: #31D5E3;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .error {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.5);
      padding: 1rem;
      border-radius: 8px;
      color: #ef4444;
      display: none;
    }
    .error.show {
      display: block;
    }
    .hint {
      font-size: 0.875rem;
      color: #6b7280;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">✓</div>
    <h1>Sign In Successful!</h1>
    <p>You've been authenticated. Return to the Symmetry app to continue.</p>
    
    <div id="loading" class="loading">
      <div class="spinner"></div>
      <p>Redirecting to app...</p>
    </div>
    
    <div id="error" class="error">
      <p>Could not redirect automatically. Please close this window and return to the app.</p>
    </div>
    
    <a href="#" id="returnButton" class="button" onclick="returnToApp()">
      Return to Symmetry
    </a>
    
    <p class="hint">If the app doesn't open, close this browser window and tap the Expo Go app.</p>
  </div>

  <script>
    // Extract tokens from URL hash
    function getTokensFromHash() {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      return {
        access_token: params.get('access_token'),
        refresh_token: params.get('refresh_token'),
        expires_at: params.get('expires_at'),
        token_type: params.get('token_type')
      };
    }

    function returnToApp() {
      const tokens = getTokensFromHash();
      
      if (tokens.access_token) {
        // Try Expo Go deep link first
        const expoUrl = 'exp://192.168.68.113:8081/--/auth/callback#' + window.location.hash.substring(1);
        
        // Also try the custom scheme
        const symmetryUrl = 'symmetry://auth/callback#' + window.location.hash.substring(1);
        
        // Try to open Expo Go URL
        document.getElementById('loading').classList.add('show');
        
        // Attempt redirect to Expo
        window.location.href = expoUrl;
        
        // Fallback timeout - if redirect didn't work, show message
        setTimeout(function() {
          document.getElementById('loading').classList.remove('show');
          document.getElementById('error').classList.add('show');
        }, 2000);
      } else {
        document.getElementById('error').classList.add('show');
        document.getElementById('error').querySelector('p').textContent = 
          'No authentication tokens found. Please try signing in again.';
      }
    }

    // Auto-attempt redirect on page load
    window.onload = function() {
      const tokens = getTokensFromHash();
      if (tokens.access_token) {
        // Small delay then auto-redirect
        setTimeout(returnToApp, 500);
      }
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
