# Quick Start: Supabase Integration

## 1. Install Dependencies

```bash
# Core Supabase client
npm install @supabase/supabase-js

# Required polyfills for React Native
npm install react-native-url-polyfill

# For accessing environment variables
npm install expo-constants

# For .env file support
npm install dotenv
```

## 2. Install Supabase CLI (Global)

```bash
npm install -g supabase
```

## 3. Initialize Local Supabase

```bash
# Make sure Docker Desktop is running first!
supabase init
supabase start
```

## 4. Configure Environment

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your Supabase credentials from 'supabase start' output
```

Example `.env`:
```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EXPO_PUBLIC_DATA_SERVICE=cloud
```

## 5. Apply Database Schema

```bash
supabase db reset
```

## 6. Update Your Code

### Option A: Use the data service provider (Recommended)

Replace all imports of `localService` with `dataService`:

```typescript
// OLD:
import { localService } from '@/services/LocalService';
const plans = await localService.workout.getWorkoutPlans(userId);

// NEW:
import { dataService } from '@/services/dataServiceProvider';
const plans = await dataService.workout.getWorkoutPlans(userId);
```

### Option B: Manual switching

In your app initialization:

```typescript
import { localService } from '@/services/LocalService';
import { cloudService } from '@/services/CloudService';
import Constants from 'expo-constants';

const dataServiceMode = Constants.expoConfig?.extra?.dataService || 'local';
export const dataService = dataServiceMode === 'cloud' ? cloudService : localService;
```

## 7. Start Your App

```bash
npm start
```

Check the console for:
```
📡 Supabase Configuration: { url: 'http://127.0.0.1:54321', configured: true }
📦 Data Service: CloudService (Supabase)
```

## 8. Test in Supabase Studio

Open http://127.0.0.1:54323 to view your data in real-time.

---

## Troubleshooting

### "Docker not running"
- Start Docker Desktop
- Wait for it to fully start
- Run `supabase start` again

### "Environment variables not loading"
- Make sure `.env` is in project root
- Restart Expo: `npm start --clear`
- Check that you're using `app.config.js` (not `app.json`)

### "Cannot connect to Supabase"
- Check that `supabase start` completed successfully
- Verify URL and Anon Key in `.env`
- Make sure you're setting `EXPO_PUBLIC_DATA_SERVICE=cloud`

---

## Production Deployment

When deploying to production:

1. Create a Supabase project at https://supabase.com
2. Update `.env`:
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
   ```
3. Push your schema to production:
   ```bash
   supabase link --project-ref your-project-ref
   supabase db push
   ```
4. Build your app:
   ```bash
   eas build --platform ios
   eas build --platform android
   ```

**That's it!** Your UI code doesn't need to change at all. 🎉
