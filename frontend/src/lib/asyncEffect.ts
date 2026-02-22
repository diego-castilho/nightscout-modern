// ============================================================================
// lib/asyncEffect.ts — Cancellable async useEffect utility
// ============================================================================
// Standardises the common `let cancelled = false` pattern so every caller
// uses the same token shape and cleanup function signature.
//
// Usage:
//   useEffect(() => asyncEffect(async (sig) => {
//     const data = await fetchSomething();
//     if (sig.cancelled) return;
//     setState(data);
//   }), [deps]);
//
// Complex cases that use Promise.all or need a separate async inner function
// with multiple `if (cancelled) return` guards are more readable with the
// native pattern and should not be migrated.
// ============================================================================

export function asyncEffect(
  factory: (sig: { cancelled: boolean }) => Promise<void>,
): () => void {
  const sig = { cancelled: false };
  factory(sig).catch(() => {});
  return () => { sig.cancelled = true; };
}
