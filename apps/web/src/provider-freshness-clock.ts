export const PROVIDER_FRESHNESS_INTERVAL_MS = 30_000;

export interface ProviderFreshnessClockHost {
  visibilityState: "hidden" | "visible";
  setInterval(handler: () => void, timeout: number): number;
  clearInterval(handle: number): void;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

export function startProviderFreshnessClock(
  host: ProviderFreshnessClockHost,
  onTick: (now: string) => void,
  now: () => string = () => new Date().toISOString(),
): () => void {
  const tick = () => {
    onTick(now());
  };
  const onVisibilityChange = () => {
    if (host.visibilityState === "visible") {
      tick();
    }
  };
  const interval = host.setInterval(tick, PROVIDER_FRESHNESS_INTERVAL_MS);
  host.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    host.clearInterval(interval);
    host.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
