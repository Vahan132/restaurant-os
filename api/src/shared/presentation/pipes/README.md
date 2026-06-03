# pipes/

Custom pipes go here.

Global request validation is configured centrally in `src/main.ts` via Nest's
`ValidationPipe`:

```ts
new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
```

so no per-route validation pipe is needed for the common case. Add module- or
field-specific transformation pipes here only when the global pipe is not enough.
