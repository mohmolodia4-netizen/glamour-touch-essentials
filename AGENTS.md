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
