import { defineConfig } from 'orval';

/**
 * Codegen config — identical pattern to the POS/admin apps.
 *
 * Input:  ./openapi.json   (swap for `${API_BASE}/docs-json` to pull live)
 * Output: react-query hooks into src/api/generated, using the custom
 *         axios mutator at src/api/mutator.ts.
 *
 * Regenerate with `pnpm generate:api`. NEVER hand-edit files under
 * src/api/generated — they are overwritten on every run.
 */
export default defineConfig({
  res: {
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
          name: 'customInstance',
        },
        query: {
          useQuery: true,
          useInfinite: false,
        },
      },
    },
  },
});
