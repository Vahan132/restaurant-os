// Flat config using Expo's shared ESLint config.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'src/api/generated/*', 'openapi.json'],
  },
]);
