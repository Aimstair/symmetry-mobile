# Supabase Setup Guide for Symmetry App

This guide will walk you through setting up Supabase for local development and production deployment.

---

## Prerequisites

1. **Docker Desktop** - Required for running Supabase locally
   - Download: https://www.docker.com/products/docker-desktop
   - Make sure Docker is running before proceeding

2. **Supabase CLI** - For managing your database
   ```bash
   npm install -g supabase
   ```

3. **Node.js & npm** - Already installed (you're using Expo)

---

## Step 1: Install React Native Dependencies

Install the required packages for Supabase in your React Native project:

```bash
npm install @supabase/supabase-js
npm install react-native-url-polyfill
npm install expo-constants
```

### Optional: Install dotenv for environment variables
```bash
npm install dotenv
```

---

## Step 2: Initialize Supabase Locally

Navigate to your project root and initialize Supabase:

```bash
# Initialize Supabase project (creates supabase/ folder)
supabase init

# Start local Supabase instance (requires Docker)
supabase start
```

**Important:** The `supabase start` command will output:
- API URL (typically `http://127.0.0.1:54321`)
- Anon Key (a long JWT token)
- Service Role Key (keep this secret!)

**Save these values!** You'll need them in the next step.

Example output:
```
API URL: http://127.0.0.1:54321
GraphQL URL: http://127.0.0.1:54321/graphql/v1
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
Anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Service role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Step 3: Configure Environment Variables

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` and add your local Supabase credentials:**
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key-from-supabase-start>
   EXPO_PUBLIC_DATA_SERVICE=cloud
   ```

3. **Add `.env` to `.gitignore` (if not already there):**
   ```bash
   echo ".env" >> .gitignore
   ```

---

## Step 4: Apply Database Schema

The migration file has already been created at:
`supabase/migrations/20260102000000_initial_schema.sql`

Apply it to your local database:

```bash
# Apply all pending migrations
supabase db reset
```

This will:
- Create all tables (users, workout_plans, body_measurements, etc.)
- Set up foreign key relationships
- Enable Row Level Security (RLS)
- Create indexes for performance

**Verify in Supabase Studio:**
- Open http://127.0.0.1:54323 in your browser
- Navigate to "Table Editor" to see your tables

---

## Step 5: Configure app.json (Expo Config)

Add the environment variables to your `app.json` or `app.config.js`:

### Option A: Using app.json (static)
```json
{
  "expo": {
    "extra": {
      "supabaseUrl": "http://127.0.0.1:54321",
      "supabaseAnonKey": "your-anon-key"
    }
  }
}
```

### Option B: Using app.config.js (dynamic - recommended)
Create `app.config.js` in your project root:

```javascript
import 'dotenv/config';

export default {
  expo: {
    // ... your existing config
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      dataService: process.env.EXPO_PUBLIC_DATA_SERVICE || 'local',
    },
  },
};
```

---

## Step 6: Update Your App Initialization

You need to modify where you initialize your data service to use CloudService instead of LocalService.

### Find Your App Entry Point

Look for where you set up your data service. This is typically in one of:
- `app/_layout.tsx`
- `App.tsx`
- A custom provider/context file

### Example Integration

Here's how to switch between LocalService and CloudService based on environment:

```typescript
import { localService } from '@/services/LocalService';
import { cloudService } from '@/services/CloudService';
import { isSupabaseConfigured } from '@/lib/supabase';
import Constants from 'expo-constants';

// Determine which service to use
const dataServiceMode = Constants.expoConfig?.extra?.dataService || 'local';

export const dataService = 
  dataServiceMode === 'cloud' && isSupabaseConfigured()
    ? cloudService
    : localService;

// Log which service is active (helpful for debugging)
if (__DEV__) {
  console.log('📦 Data Service:', dataServiceMode === 'cloud' ? 'CloudService (Supabase)' : 'LocalService (AsyncStorage)');
}
```

---

## Step 7: Test Your Setup

1. **Start your Expo app:**
   ```bash
   npm start
   ```

2. **Check the console** - You should see:
   ```
   📡 Supabase Configuration: { url: 'http://127.0.0.1:54321', configured: true }
   📦 Data Service: CloudService (Supabase)
   ```

3. **Test basic operations** in your app:
   - Create a user during onboarding
   - Create a workout plan
   - Add a body measurement

4. **Verify in Supabase Studio:**
   - Open http://127.0.0.1:54323
   - Check the "Table Editor" to see your data

---

## Step 8: Production Setup

When you're ready to deploy to production:

### 8.1 Create a Supabase Project

1. Go to https://supabase.com
2. Click "New Project"
3. Choose an organization and name
4. Set a strong database password
5. Select a region (choose closest to your users)

### 8.2 Deploy Your Schema

```bash
# Link to your remote project
supabase link --project-ref <your-project-ref>

# Push your local migrations to production
supabase db push
```

### 8.3 Update Environment Variables

Update your `.env` file for production:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-production-anon-key>
EXPO_PUBLIC_DATA_SERVICE=cloud
```

### 8.4 Build for Production

```bash
# For iOS
eas build --platform ios

# For Android
eas build --platform android
```

**Important:** Make sure your production environment variables are set in:
- EAS Build Secrets: `eas secret:create`
- Or in your build configuration

---

## Useful Supabase CLI Commands

```bash
# Start local Supabase
supabase start

# Stop local Supabase
supabase stop

# Reset database (reapply all migrations)
supabase db reset

# View migration status
supabase migration list

# Create a new migration
supabase migration new <migration_name>

# Generate TypeScript types from your database
supabase gen types typescript --local > src/types/supabase.ts

# View logs
supabase logs

# Open Supabase Studio in browser
# Just navigate to http://127.0.0.1:54323
```

---

## Troubleshooting

### Issue: "Connection refused" or "Cannot connect to Supabase"
- **Solution:** Make sure Docker is running and `supabase start` completed successfully

### Issue: "Auth error" or "JWT invalid"
- **Solution:** Check that your ANON_KEY matches the one from `supabase start`

### Issue: "RLS policy violation"
- **Solution:** Make sure you're authenticated. For testing, you can temporarily disable RLS:
  ```sql
  ALTER TABLE your_table DISABLE ROW LEVEL SECURITY;
  ```

### Issue: Environment variables not loading
- **Solution:** 
  - Make sure `.env` file is in your project root
  - Restart your Expo dev server: `npm start --clear`
  - Check that `dotenv/config` is imported in `app.config.js`

---

## Next Steps

1. **Set up Authentication:** 
   - Supabase provides built-in auth (email/password, OAuth, etc.)
   - See: https://supabase.com/docs/guides/auth

2. **Add Storage for Images:**
   - For physique scan images
   - See: https://supabase.com/docs/guides/storage

3. **Set up Real-time Subscriptions:**
   - Get live updates when data changes
   - See: https://supabase.com/docs/guides/realtime

4. **Add Database Functions:**
   - Complex calculations (e.g., symmetry scores)
   - Can be written in SQL or PostgreSQL functions

---

## Resources

- **Supabase Docs:** https://supabase.com/docs
- **Supabase CLI Reference:** https://supabase.com/docs/reference/cli
- **React Native Guide:** https://supabase.com/docs/guides/getting-started/quickstarts/react-native
- **Row Level Security:** https://supabase.com/docs/guides/auth/row-level-security

---

## Summary

You now have:
- ✅ Local Supabase instance running via Docker
- ✅ Database schema with all tables and RLS policies
- ✅ CloudService implementation with full CRUD operations
- ✅ Environment-based configuration (local vs production)
- ✅ Type-safe queries with TypeScript

Your UI code remains unchanged - it only knows about the IDataService interface!
