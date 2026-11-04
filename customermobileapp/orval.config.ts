import { defineConfig } from 'orval';

/**
 * orval config — mirrors the existing frontends (admin / POS / KDS / QR).
 *
 * Mirrored shape:
 *   - client: 'react-query'         → generates @tanstack/react-query hooks
 *   - mutator: custom axios instance (src/api/axios-instance.ts → `customInstance`)
 *     so every hook goes through our envelope-unwrap + error-normalize + auth seam.
 *   - input: ./openapi.json         → the locally-synced spec (see scripts/sync-spec.mjs)
 *   - output: src/api/generated/    → split (tags-split) so each controller is its own file
 *
 * NOTE: The real frontends were not available to inspect in this environment; this
 * mirrors the conventional orval+react-query+mutator setup the prompt describes. If the
 * actual config differs (naming/casing), reconcile here — generated output is disposable.
 */
export default defineConfig({
  consumer: {
    input: {
      target: './openapi.json',
    },
    output: {
      mode: 'tags-split',
      target: 'src/api/generated',
      schemas: 'src/api/generated/model',
      client: 'react-query',
      // Prettier the generated output if available; harmless if not installed.
      prettier: false,
      override: {
        mutator: {
          path: './src/api/axios-instance.ts',
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
