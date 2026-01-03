# Package Installation Instructions

## Required Packages for Supabase Integration

Run the following command to install all required packages:

```bash
npm install @supabase/supabase-js react-native-url-polyfill dotenv
```

### Package Details

1. **@supabase/supabase-js** (v2.x)
   - Supabase client for JavaScript/TypeScript
   - Provides database queries, authentication, storage, etc.

2. **react-native-url-polyfill** (latest)
   - Required polyfill for React Native
   - Supabase needs URL support that isn't available in React Native by default

3. **dotenv** (latest)
   - Loads environment variables from `.env` file
   - Required for `app.config.js` to read environment variables

4. **expo-constants** (already installed ✅)
   - Already in your package.json
   - Used to access environment variables in your app

## Install Supabase CLI (Global)

The Supabase CLI is needed for local development:

```bash
npm install -g supabase
```

Or with Homebrew (macOS):
```bash
brew install supabase/tap/supabase
```

## Verify Installation

After installing, verify with:

```bash
# Check Supabase CLI version
supabase --version

# Check if packages are installed
npm list @supabase/supabase-js react-native-url-polyfill dotenv expo-constants
```

## package.json Scripts (Optional)

You can add helpful scripts to your `package.json`:

```json
{
  "scripts": {
    "supabase:start": "supabase start",
    "supabase:stop": "supabase stop",
    "supabase:reset": "supabase db reset",
    "supabase:studio": "echo 'Open http://127.0.0.1:54323 in your browser'"
  }
}
```

Then run with:
```bash
npm run supabase:start
npm run supabase:reset
```

## Expected package.json After Installation

Your dependencies section should include:

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.x.x",
    "expo-constants": "~17.0.3",
    "react-native-url-polyfill": "^2.x.x",
    // ... your other dependencies
  },
  "devDependencies": {
    "dotenv": "^16.x.x",
    // ... your other dev dependencies
  }
}
```

## Troubleshooting

### "Cannot find module '@supabase/supabase-js'"
- Run: `npm install @supabase/supabase-js`
- Clear cache: `npm start --clear`

### "URL is not defined"
- Run: `npm install react-native-url-polyfill`
- Make sure it's imported in `src/lib/supabase.ts`: `import 'react-native-url-polyfill/auto';`

### "process.env.EXPO_PUBLIC_SUPABASE_URL is undefined"
- Install dotenv: `npm install dotenv`
- Add to top of `app.config.js`: `import 'dotenv/config';`
- Make sure `.env` file exists

## Next Steps

After installing packages:

1. ✅ Packages installed
2. [ ] Initialize Supabase: `supabase init`
3. [ ] Start Supabase: `supabase start`
4. [ ] Configure `.env` file
5. [ ] Apply migrations: `supabase db reset`
6. [ ] Start your app: `npm start`

See [QUICKSTART.md](QUICKSTART.md) for detailed instructions.
