/**
 * Expo App Configuration (Dynamic)
 * 
 * This file replaces app.json and allows dynamic configuration
 * based on environment variables.
 * 
 * To use this:
 * 1. Rename app.json to app.json.backup (or delete it)
 * 2. Use this app.config.js instead
 * 3. Run: npm install dotenv
 */

import 'dotenv/config';

export default {
  expo: {
    name: 'Symmetry',
    slug: 'symmetry-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#0a0a0f',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.symmetry.fitness',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0a0a0f',
      },
      package: 'com.symmetry.fitness',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    
    // Environment variables accessible via Constants.expoConfig.extra
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      dataService: process.env.EXPO_PUBLIC_DATA_SERVICE || 'local',
      eas: {
        projectId: process.env.EAS_PROJECT_ID,
      },
    },
    
    // Plugins
    plugins: [
      'expo-router',
    ],
    
    // EAS Build configuration
    // You can also use eas.json for this
  },
};
