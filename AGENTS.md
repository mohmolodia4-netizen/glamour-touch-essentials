<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Storefront branding is served by `get_public_settings()` and mapped into `--brand-primary` at the root; this keeps all semantic primary controls in sync with admin settings without duplicating colors in individual pages.
- Homepage hero overrides are served by `get_public_settings()` with null fallbacks to the existing brand copy and bundled image, so unset editor fields preserve the storefront.
- Each feature is registered in `FEATURES`, has its own admin sidebar page using `FeatureActivationCard` and the `feature-admin` save helpers, and stores non-secret settings under `app_settings.feature_config[featureKey]`; this keeps feature lifecycle and configuration isolated.
- Admin analytics come from aggregate SQL functions (SECURITY INVOKER + `has_role` check, executable by authenticated only) rather than browser-side reductions over order rows; this keeps payloads small and admin-only under RLS.
- Delivery availability (`shipping_rates.active`, `stopdesks.active`) and free shipping (`free_shipping_threshold()`) are enforced inside the order RPCs, and storefront queries filter inactive rows; displayed totals mirror the server so a tampered client cannot change the fee.
- Coupons are applied by 10-arg wrapper overloads of the order RPCs (calling the unchanged 9-arg versions in the same transaction) via internal coupon_apply(); clients only pass _coupon_code when a code is applied, so the original order path stays byte-identical.
- PWA: the manifest is served dynamically by the `/manifest.webmanifest` server route from public settings, and the service worker (hand-written `public/sw.js`, same-origin static assets only, no navigation/API caching; vite-plugin-pwa removed because it broke Vercel builds) is registered solely via `src/lib/pwa-register.ts`, which refuses dev/preview/iframe; this keeps previews and backend calls uncached.
