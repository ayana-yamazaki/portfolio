type IdleWorkOptions = {
  timeoutMs?: number;
  fallbackDelayMs?: number;
};

export const scheduleIdleWork = (
  work: () => void,
  {
    timeoutMs = 800,
    fallbackDelayMs = 32,
  }: IdleWorkOptions = {},
) => {
  if ('requestIdleCallback' in window) {
    const idleId = window.requestIdleCallback(work, { timeout: timeoutMs });
    return () => window.cancelIdleCallback(idleId);
  }

  const timeoutId = window.setTimeout(work, fallbackDelayMs);
  return () => window.clearTimeout(timeoutId);
};
