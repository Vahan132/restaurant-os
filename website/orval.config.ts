import { defineConfig } from "orval";

/**
 * orval codegen — react-query hooks + a shared axios mutator.
 *
 * Input is the backend's exported `openapi.json`. Re-run with
 * `npm run generate:api` after the spec changes. We only generate the surfaces
 * this app consumes (public / auth / account / users-password) to keep the
 * client focused; flip `filters` off to generate the whole API.
 */
export default defineConfig({
  restaurantOs: {
    input: {
      target: "./openapi.json",
      filters: {
        mode: "include",
        tags: ["public", "auth", "account", "users"],
      },
    },
    output: {
      mode: "tags-split",
      target: "./src/api/generated",
      schemas: "./src/api/generated/model",
      client: "react-query",
      httpClient: "axios",
      clean: true,
      prettier: false,
      override: {
        mutator: {
          path: "./src/api/http-client.ts",
          name: "httpClient",
        },
        query: {
          useQuery: true,
          useMutation: true,
          signal: true,
        },
      },
    },
  },
});
