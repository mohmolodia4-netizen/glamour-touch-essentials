declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[] };
    _fbq?: unknown;
  }
}

let initialized: string | null = null;

export function initPixel(pixelId: string | null | undefined) {
  if (typeof window === "undefined" || !pixelId || initialized === pixelId) return;
  initialized = pixelId;

  if (!window.fbq) {
    const fbq: any = function (...args: unknown[]) {
      fbq.callMethod ? fbq.callMethod.apply(fbq, args) : fbq.queue.push(args);
    };
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    window.fbq = fbq;
    window._fbq = fbq;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }

  window.fbq?.("init", pixelId);
  window.fbq?.("track", "PageView");
}

export function trackPixel(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.fbq?.("track", event, params);
}
