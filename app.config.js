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
    scheme: 'symmetry',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/icon.png',
      resizeMode: 'contain',
      backgroundColor: '#000000',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.symmetry.fitness',
      buildNumber: "1",
      newArchEnabled: true,
      infoPlist: {
        NSCameraUsageDescription: "We need camera access for physique scanning and progress photos.",
        NSPhotoLibraryUsageDescription: "We need photo library access to save your progress photos.",
        UIBackgroundModes: ["audio"]
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0A0A0F',
      },
      package: 'com.symmetry.fitness',
      versionCode: 3,
      newArchEnabled: true,
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ],
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: "metro",
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
      'expo-apple-authentication',
      
      // Camera Plugin (Ported from app.json)
      [
        "expo-camera",
        {
          "cameraPermission": "Allow Symmetry to access your camera for physique scans."
        }
      ],
      
      // Image Picker Plugin (Ported from app.json)
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow Symmetry to access your photos for progress tracking."
        }
      ],

      // Build Properties (FIXES THE GOOGLE PLAY API 35 ERROR)
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            buildToolsVersion: "35.0.0"
          },
          ios: {
            deploymentTarget: "15.1"
          }
        }
      ],

      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.googleusercontent.apps.YOUR_IOS_CLIENT_ID" // Optional for now if focusing on Android
        }
      ]
    ],
    // EAS Build configuration
    // You can also use eas.json for this
  },
};
