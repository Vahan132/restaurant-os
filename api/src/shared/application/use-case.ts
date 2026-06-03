/**
 * UseCase contract for application services.
 *
 * Each use case has a single responsibility and is invoked by the presentation
 * layer. Use `void` for Input or Output when not needed.
 */
export interface UseCase<Input, Output> {
  execute(input: Input): Promise<Output> | Output;
}
