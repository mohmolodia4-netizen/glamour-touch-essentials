import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFeature } from "@/lib/features";
import { useI18n } from "@/lib/i18n";
import { formatDzd, validateCoupon } from "@/lib/store";

export type AppliedCoupon = { code: string; discount: number } | null;

/** "Code promo" box. Re-validates when the subtotal changes. Renders nothing when coupons are off. */
export function CouponInput({
  subtotal,
  value,
  onChange,
}: {
  subtotal: number;
  value: AppliedCoupon;
  onChange: (next: AppliedCoupon) => void;
}) {
  const enabled = useFeature("coupons", false);
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(raw: string) {
    const c = raw.trim().toUpperCase();
    if (!c) return;
    setBusy(true);
    setError(null);
    try {
      const res = await validateCoupon(c, subtotal);
      if (res.valid && res.code) onChange({ code: res.code, discount: Number(res.discount) || 0 });
      else {
        onChange(null);
        setError(res.message ?? t("coupon.invalid"));
      }
    } catch (e) {
      onChange(null);
      setError(e instanceof Error ? e.message : t("coupon.invalid"));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (value) void apply(value.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  useEffect(() => {
    if (!enabled && value) onChange(null);
  }, [enabled, value, onChange]);

  if (!enabled) return null;

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-sm border border-primary/30 bg-accent/40 px-3 py-2 text-sm">
        <span>
          {t("coupon.applied", { code: value.code })} · −{formatDzd(value.discount)}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={t("coupon.remove")}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-1">
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("coupon.label")}
          className="h-11 rounded-sm uppercase"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void apply(code);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-sm"
          disabled={busy || !code.trim()}
          onClick={() => void apply(code)}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : t("coupon.apply")}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
