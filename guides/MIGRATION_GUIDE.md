# Symmetry Fitness - React Native Migration Guide

## 🎯 Migration Strategy Summary

This guide documents the complete migration from React Web (Vite) to React Native (Expo).

---

## ✅ What Has Been Migrated

### 1. **UI Components (shadcn/ui → Native Primitives)**

| Web Component | Native Equivalent | Status | Notes |
|--------------|------------------|---------|-------|
| `<button>` | `<Pressable>` | ✅ Done | Added loading, ripple effects |
| `<div>` | `<View>` | ✅ Done | Maintains flex behavior |
| `<p>`, `<h1>` | `<Text>` | ✅ Done | Typography handled via NativeWind classes |
| Radix Dialog | Bottom Sheet (TBD) | 🔄 Pending | Use `@gorhom/bottom-sheet` |
| Radix Tabs | Custom Tabs | 🔄 Pending | Implement with Pressable |

### 2. **Styling (Tailwind CSS → NativeWind v4)**

- ✅ All color tokens migrated from CSS variables to tailwind.config.js
- ✅ NativeWind v4 configured with Babel plugin
- ✅ `cn()` utility function works identically
- ✅ Theme: Cyber-Fitness Dark Mode preserved exactly

### 3. **State Management (Zustand)**

- ✅ Store logic unchanged
- ✅ localStorage → MMKV persistence
- ✅ All actions remain the same API
- ✅ Types preserved

### 4. **Navigation (React Router → Expo Router)**

| Web Route | Native Route | Notes |
|-----------|-------------|-------|
| `/` | `app/(tabs)/index.tsx` | Dashboard |
| `/workout-plan` | `app/(tabs)/workout-plan.tsx` | Workout Plan |
| `/progress` | `app/(tabs)/progress.tsx` | Progress |
| `/settings` | `app/(tabs)/settings.tsx` | Settings |
| `/active-workout` | `app/active-workout.tsx` | Full-screen modal |
| `/physique-scan` | `app/physique-scan.tsx` | Camera modal |

---

## 🚀 Quick Start Commands

```bash
# Initialize Expo project
npx create-expo-app@latest symmetry-mobile --template blank-typescript
cd symmetry-mobile

# Install core dependencies
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar

# Install NativeWind v4
npm install nativewind@^4.0.1 tailwindcss@3.3.2

# Install essential libraries
npx expo install react-native-mmkv expo-camera expo-image-picker
npm install zustand class-variance-authority clsx tailwind-merge
npm install lucide-react-native victory-native react-native-svg
npm install @shopify/flash-list

# Start development server
npx expo start

# Run on iOS Simulator
npx expo start --ios

# Run on Android Emulator
npx expo start --android
```

---

## 📁 New Project Structure

```
symmetry-mobile/
├── app/                          # Expo Router (file-based routing)
│   ├── _layout.tsx              # Root layout + providers
│   ├── (tabs)/                  # Bottom tab navigation
│   │   ├── _layout.tsx
│   │   ├── index.tsx            # Dashboard
│   │   ├── workout-plan.tsx
│   │   ├── progress.tsx
│   │   └── settings.tsx
│   ├── active-workout.tsx       # Modal screens
│   └── physique-scan.tsx
│
├── src/
│   ├── components/ui/           # Native UI primitives
│   │   ├── button.tsx           # ✅ MIGRATED
│   │   ├── card.tsx             # ✅ MIGRATED
│   │   ├── input.tsx            # 🔄 TODO
│   │   ├── tabs.tsx             # 🔄 TODO
│   │   ├── progress.tsx         # 🔄 TODO
│   │   └── sheet.tsx            # 🔄 TODO (Bottom Sheet)
│   │
│   ├── store/
│   │   └── useAppStore.ts       # ✅ MIGRATED (MMKV persistence)
│   │
│   ├── services/                # ✅ NEW (Data abstraction)
│   │   ├── interfaces.ts
│   │   ├── LocalService.ts
│   │   └── CloudService.ts
│   │
│   ├── lib/
│   │   ├── utils.ts             # ✅ MIGRATED
│   │   ├── storage.ts           # ✅ NEW (MMKV wrapper)
│   │   └── theme.ts
│   │
│   └── types/
│       └── index.ts             # ✅ UNCHANGED
│
├── tailwind.config.js           # ✅ CONFIGURED
├── metro.config.js              # ✅ CONFIGURED
├── app.json                     # ✅ CONFIGURED
├── eas.json                     # ✅ CONFIGURED
└── global.css                   # ✅ CONFIGURED
```

---

## 🎨 Component Migration Pattern

### Before (Web - shadcn/ui):
```tsx
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page() {
  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
        </CardHeader>
      </Card>
      <Button onClick={() => console.log('clicked')}>
        Click Me
      </Button>
    </div>
  );
}
```

### After (Native - Custom Native Components):
```tsx
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page() {
  return (
    <View className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
        </CardHeader>
      </Card>
      <Button onPress={() => console.log('clicked')}>
        Click Me
      </Button>
    </View>
  );
}
```

**Key Changes:**
- `<div>` → `<View>`
- `onClick` → `onPress`
- Everything else IDENTICAL

---

## 📊 Data Layer Architecture (Local → Cloud)

### Phase 1: Local-First (Current)
```tsx
// src/services/LocalService.ts
// Uses MMKV for fast, synchronous storage
const data = await localService.workout.getWorkoutPlans(userId);
```

### Phase 2: Cloud Integration (Future)
```tsx
// src/services/CloudService.ts
// Implement with Supabase/Firebase
const data = await cloudService.workout.getWorkoutPlans(userId);
```

### Phase 3: Swap Implementation
```tsx
// app/_layout.tsx
import { localService } from '@/services/LocalService';
import { cloudService } from '@/services/CloudService';

const dataService = __DEV__ ? localService : cloudService;

// UI components never change - they only know the interface!
```

**Benefits:**
- ✅ Develop offline-first
- ✅ Test without backend
- ✅ Swap implementations without touching UI
- ✅ Easy A/B testing

---

## 🔄 Remaining Components to Migrate

### High Priority:
1. **Input Component** (`<TextInput>`)
2. **Progress Component** (circular + linear)
3. **Sheet Component** (`@gorhom/bottom-sheet`)
4. **Tabs Component** (custom implementation)

### Medium Priority:
5. **Dropdown/Select** (use `react-native-picker-select`)
6. **Toast** (use `react-native-toast-message`)
7. **Slider** (use `@react-native-community/slider`)

### Low Priority (Use Libraries):
8. **Charts** → `victory-native` or `react-native-gifted-charts`
9. **Calendar** → `react-native-calendars`
10. **Carousel** → `react-native-reanimated-carousel`

---

## 📸 Camera Integration (Physique Scan)

```tsx
// app/physique-scan.tsx
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function PhysiqueScan() {
  const [permission, requestPermission] = useCameraPermissions();
  
  if (!permission?.granted) {
    return (
      <View>
        <Button onPress={requestPermission}>Grant Permission</Button>
      </View>
    );
  }

  return (
    <CameraView style={{ flex: 1 }} facing="back">
      {/* Overlay UI */}
    </CameraView>
  );
}
```

---

## 📱 Production Deployment

### Step 1: Configure EAS Build
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure
```

### Step 2: Build for iOS
```bash
# Development build (Simulator)
eas build --profile development --platform ios

# Production build (App Store)
eas build --profile production --platform ios
```

### Step 3: Build for Android
```bash
# Development build (APK)
eas build --profile development --platform android

# Production build (AAB for Play Store)
eas build --profile production --platform android
```

### Step 4: Submit to Stores
```bash
# Submit to App Store
eas submit --platform ios

# Submit to Play Store
eas submit --platform android
```

---

## 🔐 Environment Variables

Create `.env` file:
```bash
# API Configuration (when ready for cloud)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Analytics (optional)
EXPO_PUBLIC_ANALYTICS_ID=your-analytics-id

# App Configuration
EXPO_PUBLIC_APP_VERSION=1.0.0
```

Access in code:
```tsx
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL;
```

---

## ✅ Migration Checklist

### Foundation
- [x] Expo project initialized
- [x] NativeWind v4 configured
- [x] Tailwind theme migrated
- [x] Metro config setup
- [x] TypeScript configured

### Core Components
- [x] Button component
- [x] Card component
- [ ] Input component
- [ ] Progress component
- [ ] Sheet/Modal component
- [ ] Tabs component

### Navigation
- [x] Expo Router setup
- [x] Bottom tab layout
- [x] Modal routes configured
- [ ] Deep linking setup

### State & Data
- [x] Zustand store migrated
- [x] MMKV persistence setup
- [x] Service layer abstracted
- [ ] Cloud service implemented

### Features
- [x] Dashboard page
- [ ] Workout Plan page
- [ ] Active Workout page
- [ ] Progress page
- [ ] Settings page
- [ ] Camera integration
- [ ] Charts implementation

### Production
- [ ] App icon & splash screen
- [ ] App.json configured
- [ ] EAS Build setup
- [ ] iOS build tested
- [ ] Android build tested
- [ ] App Store submission
- [ ] Play Store submission

---

## 🎯 Next Steps

1. **Complete Core UI Components** (Input, Progress, Sheet, Tabs)
2. **Migrate Remaining Pages** (Workout Plan, Progress, Settings)
3. **Implement Camera Feature** (Physique Scan)
4. **Integrate Charts Library** (Victory Native)
5. **Test on Physical Devices** (iOS & Android)
6. **Setup EAS Build Pipeline**
7. **Implement Cloud Service** (Supabase/Firebase)
8. **Submit to App Stores**

---

## 📚 Resources

- [Expo Router Docs](https://docs.expo.dev/router/introduction/)
- [NativeWind v4 Docs](https://www.nativewind.dev/)
- [MMKV Documentation](https://github.com/mrousavy/react-native-mmkv)
- [Victory Native Charts](https://commerce.nearform.com/open-source/victory-native/)
- [EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [Expo Camera Docs](https://docs.expo.dev/versions/latest/sdk/camera/)

---

## 🐛 Common Issues & Solutions

### Issue: NativeWind classes not working
**Solution:** Ensure `global.css` is imported in `_layout.tsx` and metro config includes `withNativeWind`.

### Issue: MMKV not persisting data
**Solution:** Check that `storageAdapter` is passed to Zustand's `createJSONStorage()`.

### Issue: SafeArea not working on iPhone
**Solution:** Use `SafeAreaView` from `react-native-safe-area-context` with `edges` prop.

### Issue: Navigation not working
**Solution:** Ensure all routes are in `app/` directory and follow Expo Router naming conventions.

---

**Migration Status:** 30% Complete  
**Estimated Time to Production:** 4-6 weeks  
**Priority:** High - Core components & navigation first
