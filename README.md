# Glamour Touch

Glamour Touch is a bilingual, mobile-first e-commerce storefront for women’s handbags and accessories in Algeria. It supports guest cash-on-delivery orders, color variants, a persistent multi-product cart, home and Stopdesk delivery, an authenticated French-language administration dashboard, and automated order notifications.

The application uses TanStack Start for the web app and Supabase/Lovable Cloud for authentication, PostgreSQL data, Row Level Security, image storage, database RPCs, and the order-notification Edge Function.

## Features

### Storefront

- Home page with an editable hero, featured best sellers, category grid, and new arrivals.
- Product catalog at `/boutique`, including category filtering.
- Shareable product pages at `/product/:id` with:
  - image gallery and thumbnail navigation;
  - color swatches backed by product variants;
  - variant-specific images and stock;
  - a configurable default variant image;
  - price, optional old price, description, and stock status;
  - direct cash-on-delivery checkout;
  - optional quantity-discount messaging;
  - optional related products from the same category.
- Safe image fallbacks when a product or category has no uploaded image.
- Responsive layouts with mobile overflow protection.

### French and Arabic

- French is the default storefront language.
- The header includes a `FR / عربي` language switcher.
- The selected language is persisted in `localStorage`.
- Arabic uses right-to-left layout and the Cairo font.
- Storefront navigation, footer, catalog, product pages, forms, cart, checkout, success messages, and reusable controls are translated.
- Product names, category names, wilayas, communes, and DA prices remain exactly as entered.
- The admin dashboard always stays in French and left-to-right.

### Product images and variants

- Product images are optional and support multiple uploads.
- Products can have color variants with a name, color value, image, stock quantity, display order, and default-image flag.
- If no default is selected, the first variant by display order becomes the fallback.
- Storefront cover selection follows: default variant image, first variant image, product image, additional product image, then a clean branded placeholder.
- Direct orders can contain multiple lines for the same product with different colors and quantities.

### Shopping cart

- Guest cart stored in `localStorage`; no customer account is required.
- Supports multiple different products and color variants in one order.
- Cart drawer in the header with item count, quantity controls, removal, and subtotal.
- Quick add-to-cart controls on product cards:
  - products without variants add immediately;
  - products with variants open an inline color picker first.
- Dedicated `/checkout` route for multi-product cash-on-delivery orders.
- Cart contents are cleared after a successful cart order.

### Checkout and delivery

Both direct product checkout and cart checkout collect:

- full name;
- phone number;
- wilaya;
- delivery method;
- commune;
- home address or Stopdesk location;
- quantity and color selections where applicable.

Delivery behavior:

- **À domicile:** communes come from the commune directory and a free-text address is required.
- **Stopdesk:** only communes with available Stopdesk points are shown, followed by a specific office selector.
- Shipping is calculated from the selected wilaya and delivery method.
- Totals update before submission and remain denominated in Algerian dinars (`DA`).
- Orders are validated and priced again in PostgreSQL RPCs; client totals are not trusted.
- Product and variant stock is validated and decremented atomically.

### Quantity discounts

- Products may define an optional minimum quantity and percentage discount.
- The discount is calculated per product across all of that product’s color lines.
- The discounted unit price is rounded to whole DA.
- Display calculations are mirrored in the direct order form, cart drawer, and cart checkout.
- Final pricing is enforced server-side by both active checkout RPCs.
- The entire behavior is controlled by the `qty_discount` feature flag.

### Order success features

- Both checkout flows show an order reference after success.
- Optional **Confirmer sur WhatsApp** button opens a prefilled WhatsApp message containing the order reference, customer, product lines, total, wilaya, and commune.
- Optional **Complétez votre look** section displays admin-selected published products in a configured order, excluding products in the completed order.
- Post-order suggestions remain hidden when either `post_order_upsell` or the cart feature is disabled.

### Runtime branding and content

Administrators can update without code changes:

- site name and tagline;
- primary brand color;
- logo;
- hero title, subtitle, image, and button text;
- phone and WhatsApp number;
- Instagram, Facebook, and TikTok links;
- Meta Pixel and TikTok Pixel IDs.

The primary color is exposed as the runtime CSS variable `--brand-primary` and feeds the semantic accent, button, badge, focus-ring, and sidebar colors. The hero uses subtle staggered entrance motion and a slow image zoom, with reduced-motion support.

## Feature flags

The singleton `app_settings.features` JSON object is editable from the **Fonctionnalités** card in the admin dashboard.

Implemented gates:

| Key | Default | Current behavior |
| --- | --- | --- |
| `cart` | On | Cart icon, product add-to-cart controls, cart checkout, and post-order upsells |
| `similar_products` | Off | Related-product section on product pages |
| `qty_discount` | Off | Quantity discount fields, hints, display pricing, and server-side discounting |
| `post_order_upsell` | Off | Admin-selected products on order success screens |
| `whatsapp_confirm` | Off | WhatsApp confirmation button on order success screens |

The settings UI also stores `whatsapp_order`, `wishlist`, `bundles`, and `order_alerts`. These keys are reserved in the current codebase and do not yet control a separate storefront or admin feature.

## Analytics

Pixel scripts are loaded only when their IDs are configured in site settings.

### Meta Pixel

- `PageView` when the pixel initializes.
- `ViewContent` on product pages.
- `InitiateCheckout` when the direct product order form is first engaged.
- `Purchase` after a successful direct product order.

### TikTok Pixel

- Page tracking when the pixel initializes.
- `CompletePayment` after a successful direct product order.
- `PlaceAnOrder` after a successful direct product order.

The current cart checkout does not emit the direct-order Meta or TikTok conversion events.

## Admin dashboard

The `/admin` route uses email/password authentication and role checks from `user_roles`. If no administrator exists, the first authenticated account can claim the initial admin role through `claim_first_admin()`.

The dashboard is always French/LTR and contains four tabs:

### Commandes

- List orders and their item/color breakdowns.
- Search by customer, phone, product, wilaya, or commune.
- Filter by order status.
- Update an individual order to En attente, Confirmée, Expédiée, Livrée, or Annulée.
- Select individual orders or all currently filtered orders.
- Apply a bulk status change from a sticky action bar.
- Copy phone numbers, open WhatsApp, or delete an order.
- Trigger Google Sheets synchronization after status updates.

### Produits

- Create, edit, and delete products.
- Manage name, description, current and old price, category, stock, published/draft status, and featured status.
- Upload and remove optional product images.
- Create, edit, and remove color variants with per-variant stock and images.
- Select one default variant image.
- Configure optional quantity discounts when that feature is enabled.

### Catégories

- Create, edit, and delete categories.
- Manage name, slug, display order, and image.

### Paramètres

- **Design & Contenu:** site name, tagline, primary color, and logo.
- **Page d’accueil:** hero title, subtitle, image, and button label.
- Contact and social links.
- Meta Pixel and TikTok Pixel IDs.
- Telegram bot configuration, including comma-separated chat IDs.
- Google Sheets webhook URL.
- Feature switches.
- Searchable, reorderable post-order cross-sell product selection with immediate saving.

## Database

All application tables use Row Level Security. Public access is limited to published catalog data and shipping lookup data. Orders are created through security-definer RPCs; authenticated administrators manage protected data through role-based policies.

### Tables

| Table | Purpose |
| --- | --- |
| `app_settings` | Singleton branding, hero content, contact links, pixel IDs, feature flags, and notification configuration |
| `categories` | Storefront categories, slugs, images, publication status, and ordering |
| `products` | Product content, pricing, images, stock, publication/featured state, and quantity-discount rules |
| `product_variants` | Color-specific images, stock, ordering, and default-image selection |
| `orders` | Customer, delivery, totals, status, Stopdesk code, and Google Sheets synchronization state |
| `order_items` | Product/color/quantity/unit-price lines for direct and cart orders |
| `shipping_rates` | Home and Stopdesk fees by wilaya |
| `communes` | Wilaya/commune/postal-code directory used by home delivery |
| `stopdesks` | Wilaya/commune office names, codes, and addresses |
| `cross_sell_products` | Admin-selected and ordered post-purchase product suggestions |
| `user_roles` | Separate `admin` and `user` role assignments |

The `product-images` storage bucket holds product, category, logo, hero, and variant uploads. The application stores long-lived signed URLs for uploaded images.

### Database functions and RPCs

| Function | Purpose |
| --- | --- |
| `has_role(_user_id, _role)` | Checks role membership for RLS and admin access |
| `claim_first_admin()` | Allows the first authenticated user to claim the initial admin role |
| `get_public_settings()` | Exposes the non-sensitive storefront settings needed by public pages |
| `discounted_unit(...)` | Calculates a rounded quantity-discounted unit price |
| `qty_discount_on()` | Reads the server-side quantity-discount feature flag |
| `place_order_items(...)` | Creates a direct product order with one or more color/quantity lines and atomic stock updates |
| `place_cart_order(...)` | Creates a multi-product cart order, validates each line, calculates shipping and discounts, and updates stock atomically |
| `place_order(...)` | Legacy single-line order overloads retained in the database |
| `set_updated_at()` | Maintains `updated_at` timestamps through table triggers |

The repository also includes `supabase/schema/full_schema_baseline.sql`, an idempotent, non-destructive schema baseline for recreating the core database structure without copying application data.

## Notifications and external integrations

### `send-order-notifications` Edge Function

The deployed Edge Function receives an order ID and reloads the order and its lines from the database.

- Sends a formatted new-order message to one or more comma-separated Telegram chat IDs.
- Includes cart lines or direct-order color lines in the Telegram message.
- Sends order and status payloads to the configured Google Sheets webhook.
- Maps internal statuses to the French labels En attente, Confirmée, Expédiée, Livrée, and Annulée.
- Uses `addOrder`, `updateStatus`, `archiveOrder`, or `cancelOrder` according to the current status.
- Stores `sheet_sent_at` to avoid appending the same order more than once.
- Treats notification failures separately from order creation so a customer order can still succeed.
- Sends the Stopdesk code to the Sheets integration for Stopdesk orders.

### `/api/public/migrate-helper`

This TanStack server route exposes protected migration diagnostics over `GET` and `POST`. Every request requires the configured access header. Its `ping` action reports whether the required server environment is available. It is not used by the storefront checkout flow.

## Tech stack

- React 19
- TanStack Start and TanStack Router
- TanStack Query
- TypeScript
- Vite
- Tailwind CSS 4
- shadcn-style UI components built on Radix UI
- Supabase/Lovable Cloud: PostgreSQL, Auth, Storage, RLS, RPCs, and Edge Functions
- Sonner notifications
- React Hook Form and Zod dependencies
- Lucide icons

## Project routes

| Route | Description |
| --- | --- |
| `/` | Storefront home page |
| `/boutique` | Product catalog and category filtering |
| `/product/:id` | Product details and direct checkout |
| `/checkout` | Multi-product cart checkout |
| `/admin` | Authenticated administration dashboard |
| `/api/public/migrate-helper` | Access-key-protected migration diagnostics endpoint |

## Deployment notes

- The current project is connected to Lovable Cloud, which provides its Supabase-compatible backend.
- Public browser access requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The generated client can also use the corresponding server-side public values during rendering.
- The `send-order-notifications` Edge Function requires its platform-provided database URL and service-role credential. Telegram and Google Sheets values are read from the protected `app_settings` row, not exposed through `get_public_settings()`.
- `/api/public/migrate-helper` requires `MIGRATE_HELPER_ACCESS_KEY`, `SUPABASE_DB_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in the server runtime.
- Never expose service-role credentials, Telegram tokens, database URLs, migration access keys, or other private values in client code or committed files.
- Database changes live under `supabase/migrations`. The consolidated schema reference is `supabase/schema/full_schema_baseline.sql`.
- The storefront itself performs public reads and checkout RPC calls with the publishable client; administrator writes remain protected by authentication and RLS.

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/124b5075-7bec-4d52-9e6a-f27f343a2a6a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```