# Supabase Integration Checklist

Use this checklist to track your progress through the integration.

---

## Phase 1: Prerequisites ☐

- [ ] Docker Desktop installed and running
- [ ] Node.js and npm installed
- [ ] Expo project working locally

---

## Phase 2: Install Dependencies ☐

```bash
npm install @supabase/supabase-js react-native-url-polyfill expo-constants dotenv
npm install -g supabase
```

- [ ] Supabase client installed
- [ ] Polyfills installed
- [ ] Supabase CLI installed globally

---

## Phase 3: Initialize Supabase Locally ☐

```bash
supabase init
supabase start
```

- [ ] Supabase initialized (`supabase/` folder created)
- [ ] Supabase started (Docker containers running)
- [ ] Saved API URL from output
- [ ] Saved Anon Key from output

---

## Phase 4: Configure Environment ☐

```bash
cp .env.example .env
```

- [ ] `.env` file created
- [ ] `EXPO_PUBLIC_SUPABASE_URL` set
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` set
- [ ] `EXPO_PUBLIC_DATA_SERVICE` set to `cloud`
- [ ] `.env` added to `.gitignore`

---

## Phase 5: Configure Expo ☐

### Option A: Use app.config.js (Recommended)
- [ ] Install dotenv: `npm install dotenv`
- [ ] Copy `app.config.example.js` to `app.config.js`
- [ ] Update with your app details
- [ ] Backup or delete `app.json`

### Option B: Use app.json (Static)
- [ ] Add `extra` object to `app.json`
- [ ] Add Supabase config to `extra`

---

## Phase 6: Apply Database Schema ☐

```bash
supabase db reset
```

- [ ] Migration applied successfully
- [ ] Opened Supabase Studio (http://127.0.0.1:54323)
- [ ] Verified tables exist in Studio
- [ ] Checked RLS policies are enabled

---

## Phase 7: Update Your Code ☐

### Replace localService imports with dataService:

Example files to update:
- [ ] `app/(tabs)/workout-plan.tsx`
- [ ] `app/(tabs)/progress.tsx`
- [ ] `app/onboarding.tsx`
- [ ] `app/index.tsx`
- [ ] Any other files using `localService`

**Find and Replace:**
```typescript
// Find:
import { localService } from '@/services/LocalService';

// Replace with:
import { dataService } from '@/services/dataServiceProvider';
```

Then update all `localService.` → `dataService.`

---

## Phase 8: Update App Layout ☐

- [ ] Open `app/_layout.tsx`
- [ ] Add import: `import { dataService, getActiveServiceName } from '@/services/dataServiceProvider';`
- [ ] Add logging in `useEffect` (see `app/_layout.example.tsx`)
- [ ] Save and test

---

## Phase 9: Test Locally ☐

```bash
npm start --clear
```

- [ ] App starts without errors
- [ ] Console shows: "📦 Data Service: CloudService (Supabase)"
- [ ] Console shows: "📡 Supabase Configuration: { url: '...', configured: true }"
- [ ] Can complete onboarding
- [ ] Can create workout plan
- [ ] Can view progress data

---

## Phase 10: Verify Data in Supabase Studio ☐

Open http://127.0.0.1:54323

- [ ] Navigate to "Table Editor"
- [ ] Check `users` table has data
- [ ] Check `workout_plans` table has data
- [ ] Check other tables as needed
- [ ] Test queries in SQL Editor

---

## Phase 11: Production Setup (When Ready) ☐

### Create Supabase Project
- [ ] Go to https://supabase.com
- [ ] Create new project
- [ ] Save production URL
- [ ] Save production Anon Key

### Deploy Schema
```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

- [ ] Linked to production project
- [ ] Schema pushed to production
- [ ] Verified in production Supabase Studio

### Update Environment Variables
- [ ] Update `.env` with production credentials
- [ ] Set in EAS Build secrets (if using EAS)
- [ ] Test production build locally

### Build and Deploy
```bash
eas build --platform ios
eas build --platform android
```

- [ ] iOS build successful
- [ ] Android build successful
- [ ] Submitted to App Store
- [ ] Submitted to Google Play

---

## Troubleshooting Checklist ☐

If things aren't working:

- [ ] Docker is running
- [ ] `supabase status` shows all services running
- [ ] `.env` file is in project root (not in a subfolder)
- [ ] Environment variables start with `EXPO_PUBLIC_`
- [ ] Restarted Expo dev server with `--clear` flag
- [ ] No typos in Supabase URL or Anon Key
- [ ] `dataService` is imported (not `localService`)

---

## Resources

- [ ] Read [SUPABASE_SETUP.md](SUPABASE_SETUP.md)
- [ ] Review [QUICKSTART.md](QUICKSTART.md)
- [ ] Check [app/_layout.example.tsx](app/_layout.example.tsx)
- [ ] Bookmark [Supabase Docs](https://supabase.com/docs)

---

## 🎉 Completion

- [ ] Local development working with Supabase
- [ ] Production deployed with cloud database
- [ ] All tests passing
- [ ] Team onboarded to new setup

**Congratulations! Your Symmetry app is now powered by Supabase! 🚀**
