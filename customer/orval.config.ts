import { defineConfig } from 'orval';

/**
 * Generates TanStack Query hooks + TS types for the PUBLIC endpoints only.
 * Source of truth: ./openapi.json (the backend can also serve it at /docs-json).
 * Generated files live in src/api/generated and must NEVER be hand-edited.
 */
export default defineConfig({
  public: {
    input: {
      target: './openapi.json',
      // Only the public, no-auth storefront surface.
      filters: {
        // Only the public, no-auth storefront surface.
        tags: ['public'],
        // Prune model files down to the public schemas only.
        schemas: [/^Public/, /OrderRequest/],
      },
    },
    output: {
      mode: 'tags-split',
      target: './src/api/generated',
      schemas: './src/api/generated/model',
      client: 'react-query',
      httpClient: 'axios',
      clean: true,
      prettier: true,
      override: {
        mutator: {
          path: './src/api/mutator.ts',
          name: 'customInstance',
        },
        query: {
          useQuery: true,
        },
      },
    },
  },
});
