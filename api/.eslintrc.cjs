/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: ['.eslintrc.cjs', 'dist/**', 'node_modules/**'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
  overrides: [
    {
      /**
       * DDD dependency rule (codified):
       * the domain layer MUST be pure — no NestJS, no Prisma, no framework imports.
       * Dependencies always point inward (presentation -> application -> domain).
       */
      files: ['src/**/domain/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@nestjs/*',
                  '@prisma/*',
                  'prisma',
                  '@nestjs/common',
                  'rxjs',
                  'express',
                  'class-validator',
                  'class-transformer',
                ],
                message:
                  'The domain layer must stay framework-free. Move framework code to application/infrastructure.',
              },
            ],
          },
        ],
      },
    },
  ],
};
