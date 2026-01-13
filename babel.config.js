module.exports = function (api) {
  api.cache(true);
  
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      'react-native-worklets-core/plugin',
      // ✅ MEMORY HYGIENE: Strip console.log in production builds
      // Console logs accumulating in the bridge cause massive slowdowns over time
      // Keeps error and warn for debugging production issues
      ...(isProduction ? [['transform-remove-console', { exclude: ['error', 'warn'] }]] : []),
      // ⚠️ MUST be last plugin
      'react-native-reanimated/plugin',
    ],
  };
};