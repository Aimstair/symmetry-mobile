/**
 * Supabase Configuration Checker
 * 
 * Run this script to verify your Supabase setup is correct.
 * 
 * Usage: npm run check-supabase
 * 
 * Add to package.json scripts:
 * "check-supabase": "ts-node scripts/check-supabase-config.ts"
 */

import * as fs from 'fs';
import * as path from 'path';

console.log('🔍 Checking Supabase Configuration...\n');

let hasErrors = false;

// Check 1: .env file exists
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log('✅ .env file exists');
  
  // Read .env file
  const envContent = fs.readFileSync(envPath, 'utf-8');
  
  // Check for required variables
  const requiredVars = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_DATA_SERVICE',
  ];
  
  requiredVars.forEach(varName => {
    if (envContent.includes(`${varName}=`) && !envContent.includes(`${varName}=\n`)) {
      console.log(`✅ ${varName} is set`);
    } else {
      console.log(`❌ ${varName} is NOT set or is empty`);
      hasErrors = true;
    }
  });
} else {
  console.log('❌ .env file does not exist');
  console.log('   Run: cp .env.example .env');
  hasErrors = true;
}

console.log('');

// Check 2: Supabase directory exists
const supabasePath = path.join(process.cwd(), 'supabase');
if (fs.existsSync(supabasePath)) {
  console.log('✅ supabase/ directory exists');
} else {
  console.log('❌ supabase/ directory does not exist');
  console.log('   Run: supabase init');
  hasErrors = true;
}

// Check 3: Migration file exists
const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20260102000000_initial_schema.sql');
if (fs.existsSync(migrationPath)) {
  console.log('✅ Initial migration file exists');
} else {
  console.log('❌ Initial migration file does not exist');
  hasErrors = true;
}

console.log('');

// Check 4: Required files exist
const requiredFiles = [
  'src/services/CloudService.ts',
  'src/services/dataServiceProvider.ts',
  'src/lib/supabase.ts',
];

requiredFiles.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${filePath} exists`);
  } else {
    console.log(`❌ ${filePath} does NOT exist`);
    hasErrors = true;
  }
});

console.log('');

// Check 5: Dependencies installed
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const requiredDeps = [
    '@supabase/supabase-js',
    'react-native-url-polyfill',
    'expo-constants',
  ];
  
  requiredDeps.forEach(dep => {
    if (dependencies[dep]) {
      console.log(`✅ ${dep} installed (${dependencies[dep]})`);
    } else {
      console.log(`❌ ${dep} NOT installed`);
      console.log(`   Run: npm install ${dep}`);
      hasErrors = true;
    }
  });
}

console.log('');
console.log('═══════════════════════════════════════════════════════════════');

if (hasErrors) {
  console.log('❌ Configuration has errors. Please fix the issues above.');
  console.log('\n📚 See SUPABASE_SETUP.md for detailed instructions.');
  process.exit(1);
} else {
  console.log('✅ All checks passed! Your Supabase setup looks good.');
  console.log('\n🚀 Next steps:');
  console.log('   1. Make sure Docker is running');
  console.log('   2. Run: supabase start');
  console.log('   3. Run: supabase db reset');
  console.log('   4. Run: npm start');
  console.log('\n📚 See QUICKSTART.md for detailed instructions.');
}
