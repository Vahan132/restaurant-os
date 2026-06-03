import { defineConfig } from 'orval';

/**
 * OpenAPI codegen — mirrors the admin app.
 * Input: the committed ./openapi.json (swap to the live `/docs-json` endpoint if you prefer).
 * Output: TanStack Query hooks into src/api/generated, all requests routed through the
 * custom axios mutator at src/api/mutator.ts.
 *
 * Regenerate with `pnpm generate:api`. NEVER hand-edit files under src/api/generated.
 */
export default defineConfig({
  pos: {
    input: {
      target: './openapi.json',
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
          name: 'apiRequest',
        },
        query: {
          useQuery: true,
          useInfinite: false,
          signal: true,
        },
      },
    },
  },
});
