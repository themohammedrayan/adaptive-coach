module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  // react-native-gifted-charts (and its gifted-charts-core dependency) ship
  // untranspiled ESM, so they need to go through Jest's transform like the
  // rest of the RN/Expo ecosystem already does per jest-expo's default.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|react-native-gifted-charts|gifted-charts-core))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
};
