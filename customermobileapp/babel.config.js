module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // NativeWind v4 needs the nativewind jsxImportSource + preset.
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // No manual reanimated/worklets plugin: babel-preset-expo (SDK 54) injects the
    // react-native-worklets plugin automatically when reanimated is installed.
  };
};
