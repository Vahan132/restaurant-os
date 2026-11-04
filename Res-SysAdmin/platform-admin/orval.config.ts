import { defineConfig } from "orval";

/**
 * Codegen config. Generates react-query hooks + TypeScript models from openapi.json
 * into src/api/generated. The generated client routes every request through the
 * custom axios mutator in src/lib/api-client.ts (auth, envelope unwrap, error
 * normalization, 401 refresh-and-retry).
 *
 * Generated files are NEVER hand-edited. Run `npm run generate:api` to refresh.
 */
export default defineConfig({
  platformAdmin: {
    input: {
      target: "./openapi.json",
    },
    output: {
      mode: "tags-split",
      target: "./src/api/generated/endpoints",
      schemas: "./src/api/generated/model",
      client: "react-query",
      httpClient: "axios",
      clean: true,
      prettier: false,
      indexFiles: true,
      override: {
        mutator: {
          path: "./src/lib/api-client.ts",
          name: "customInstance",
        },
        query: {
          useQuery: true,
          signal: true,
        },
      },
    },
  },
});
