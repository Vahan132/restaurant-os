export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-brand"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
