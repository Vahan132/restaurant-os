import { defineConfig } from 'orval';

/**
 * Codegen source. Defaults to the local spec file; override with ORVAL_INPUT
 * to point at the live Nest swagger JSON, e.g.:
 *   ORVAL_INPUT=http://localhost:3001/docs-json pnpm generate:api
 *
 * Generated files are never hand-edited. orval picks the hook type by HTTP
 * verb (GET -> useQuery, POST/PUT/PATCH/DELETE -> useMutation) and uses our
 * axios-based custom mutator at src/api/mutator.ts.
 */
const ORVAL_INPUT = process.env.ORVAL_INPUT ?? './openapi.json';

export default defineConfig({
  restaurantOs: {
    input: {
      target: ORVAL_INPUT,
      // The live Nest swagger can emit a path placeholder without declaring it
      // as a parameter (e.g. /branches/{id}/my-access). Skip orval's strict
      // validation and repair missing path params via the transformer so
      // codegen succeeds. Remove both once the backend declares them.
      unsafeDisableValidation: true,
      override: {
        transformer: './orval-transformer.cjs',
      },
    },
    output: {
      mode: 'tags-split',
      target: 'src/api/generated',
      schemas: 'src/api/generated/model',
      client: 'react-query',
      httpClient: 'axios',
      clean: true,
      override: {
        mutator: {
          path: 'src/api/mutator.ts',
          name: 'customInstance',
        },
      },
    },
  },
});
