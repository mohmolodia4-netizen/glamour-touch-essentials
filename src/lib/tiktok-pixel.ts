declare global {
  interface Window {
    ttq?: any;
    TiktokAnalyticsObject?: string;
  }
}

let initialized: string | null = null;

export function initTiktokPixel(pixelId: string | null | undefined) {
  if (typeof window === "undefined" || !pixelId || initialized === pixelId) return;
  initialized = pixelId;

  if (!window.ttq) {
    const w = window as any;
    const d = document;
    const t = "ttq";
    w.TiktokAnalyticsObject = t;
    const ttq: any = (w[t] = w[t] || []);
    ttq.methods = [
      "page",
      "track",
      "identify",
      "instances",
      "debug",
      "on",
      "off",
      "once",
      "ready",
      "alias",
      "group",
      "enableCookie",
      "disableCookie",
      "holdConsent",
      "revokeConsent",
      "grantConsent",
    ];
    ttq.setAndDefer = function (obj: any, method: string) {
      obj[method] = function (...args: unknown[]) {
        obj.push([method, ...args]);
      };
    };
    for (const method of ttq.methods) ttq.setAndDefer(ttq, method);
    ttq.instance = function (id: string) {
      const inst = ttq._i?.[id] || [];
      for (const method of ttq.methods) ttq.setAndDefer(inst, method);
      return inst;
    };
    ttq.load = function (id: string, options?: Record<string, unknown>) {
      const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i = ttq._i || {};
      ttq._i[id] = [];
      ttq._i[id]._u = url;
      ttq._t = ttq._t || {};
      ttq._t[id] = +new Date();
      ttq._o = ttq._o || {};
      ttq._o[id] = options || {};
      const script = d.createElement("script");
      script.type = "text/javascript";
      script.async = true;
      script.src = `${url}?sdkid=${id}&lib=${t}`;
      d.head.appendChild(script);
    };
  }

  window.ttq.load(pixelId);
  window.ttq.page();
}

export function trackTiktok(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const send = () => {
    if (window.ttq?.track) {
      window.ttq.track(event, params, { event_id: `${event}-${Date.now()}` });
      return true;
    }
    return false;
  };
  if (send()) return;
  // Pixel script may still be loading — retry briefly.
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (send() || attempts > 20) clearInterval(timer);
  }, 250);
}
