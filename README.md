# Glamour Touch Essentials

👜Glamour Touch— Luxury Handbags & Accessories Store (Build Prompt)

Build an elegant e-commerce store for women's luxury handbags, fashion accessories, wallets, jewelry, and watches called "Glamour Touch", using Lovable Cloud (managed Supabase) as backend and TanStack Start as framework.

🎨 Brand & Visual Identity

Palette: Sage Green, Ivory White, Light Beige, Dark Gray — luxury, elegant, feminine, premium feel, mobile-first.

🛍️ Storefront (Guest-Only, No Login for Customers)

Homepage: Hero banner, Best Sellers, category grid, New Arrivals. Product pages at /product/$id (shareable links for ads). Simple product image carousel.

🛒 Checkout (Cash on Delivery, on product page — NO cart)

FIELDS & EXACT BEHAVIOR (must match precisely):

Full Name (Input, Required)

Phone Number (Input, Required)

Wilaya (Searchable Dropdown, Required) — from the 58-wilaya shipping matrix below.

Delivery Method Selector (Radio Buttons / Toggle Bar):

Option A: "التوصيل للمنزل (À Domicile)"

Option B: "الاستلام من المكتب (Stopdesk / Bureau)"

Dynamic behavior:

"À Domicile": Commune dropdown = all home-delivery communes for selected wilaya. Address = free-text input (Required). Stopdesk field hidden.

"Stopdesk": Commune dropdown = ONLY communes with an active Stop Desk point for selected wilaya. Address becomes a Dropdown Select with the available Stop Desk addresses for that commune.

Real-time total = Product Price + Delivery Fee (based on Wilaya + delivery method).

Submit button: "Confirmer la Commande" (تأكيد الطلب).

Fires Meta Pixel events: ViewContent, InitiateCheckout, Purchase.

📍 SHIPPING DATA

I will attach two files directly in the Lovable chat after this prompt:

Communes dataset (wilaya code, wilaya name, commune name, postal code) — for the "À Domicile" dropdown.

Stopdesk dataset (wilaya code, wilaya name, point name/code, address) — for the "Stopdesk" dropdown.

Import both into the database as seed data (communes table + stopdesks table, linked by wilaya code), same as the Kidzyy project. Read them from the attached files — do not ask me to paste rows here.

Use this 58-wilaya pricing matrix for shipping_rates (domicile + stopdesk fees in DZD):

[ {"code": 1, "name": "Adrar", "domicile": 1100, "stopdesk": 750}, {"code": 2, "name": "Chlef", "domicile": 680, "stopdesk": 400}, {"code": 3, "name": "Laghouat", "domicile": 800, "stopdesk": 500}, {"code": 4, "name": "Oum El Bouaghi", "domicile": 680, "stopdesk": 400}, {"code": 5, "name": "Batna", "domicile": 700, "stopdesk": 400}, {"code": 6, "name": "Béjaïa", "domicile": 700, "stopdesk": 400}, {"code": 7, "name": "Biskra", "domicile": 800, "stopdesk": 500}, {"code": 8, "name": "Béchar", "domicile": 1000, "stopdesk": 700}, {"code": 9, "name": "Blida", "domicile": 500, "stopdesk": 350}, {"code": 10, "name": "Bouira", "domicile": 600, "stopdesk": 400}, {"code": 11, "name": "Tamanrasset", "domicile": 1500, "stopdesk": 1050}, {"code": 12, "name": "Tébessa", "domicile": 720, "stopdesk": 450}, {"code": 13, "name": "Tlemcen", "domicile": 700, "stopdesk": 400}, {"code": 14, "name": "Tiaret", "domicile": 700, "stopdesk": 400}, {"code": 15, "name": "Tizi Ouzou", "domicile": 600, "stopdesk": 400}, {"code": 16, "name": "Alger", "domicile": 400, "stopdesk": 300}, {"code": 17, "name": "Djelfa", "domicile": 800, "stopdesk": 500}, {"code": 18, "name": "Jijel", "domicile": 700, "stopdesk": 400}, {"code": 19, "name": "Sétif", "domicile": 680, "stopdesk": 400}, {"code": 20, "name": "Saïda", "domicile": 730, "stopdesk": 450}, {"code": 21, "name": "Skikda", "domicile": 700, "stopdesk": 400}, {"code": 22, "name": "Sidi Bel Abbès", "domicile": 700, "stopdesk": 400}, {"code": 23, "name": "Annaba", "domicile": 700, "stopdesk": 450}, {"code": 24, "name": "Guelma", "domicile": 700, "stopdesk": 400}, {"code": 25, "name": "Constantine", "domicile": 680, "stopdesk": 400}, {"code": 26, "name": "Médéa", "domicile": 600, "stopdesk": 400}, {"code": 27, "name": "Mostaganem", "domicile": 700, "stopdesk": 400}, {"code": 28, "name": "M'Sila", "domicile": 700, "stopdesk": 400}, {"code": 29, "name": "Mascara", "domicile": 700, "stopdesk": 400}, {"code": 30, "name": "Ouargla", "domicile": 900, "stopdesk": 550}, {"code": 31, "name": "Oran", "domicile": 580, "stopdesk": 400}, {"code": 32, "name": "El Bayadh", "domicile": 970, "stopdesk": 700}, {"code": 33, "name": "Illizi", "domicile": 1500, "stopdesk": 1050}, {"code": 34, "name": "Bordj Bou Arreridj", "domicile": 680, "stopdesk": 400}, {"code": 35, "name": "Boumerdès", "domicile": 530, "stopdesk": 350}, {"code": 36, "name": "El Tarf", "domicile": 730, "stopdesk": 450}, {"code": 37, "name": "Tindouf", "domicile": 1100, "stopdesk": 750}, {"code": 38, "name": "Tissemsilt", "domicile": 700, "stopdesk": 400}, {"code": 39, "name": "El Oued", "domicile": 900, "stopdesk": 550}, {"code": 40, "name": "Khenchela", "domicile": 700, "stopdesk": 400}, {"code": 41, "name": "Souk Ahras", "domicile": 730, "stopdesk": 450}, {"code": 42, "name": "Tipaza", "domicile": 530, "stopdesk": 350}, {"code": 43, "name": "Mila", "domicile": 700, "stopdesk": 400}, {"code": 44, "name": "Aïn Defla", "domicile": 700, "stopdesk": 400}, {"code": 45, "name": "Naâma", "domicile": 930, "stopdesk": 550}, {"code": 46, "name": "Aïn Témouchent", "domicile": 700, "stopdesk": 400}, {"code": 47, "name": "Ghardaïa", "domicile": 850, "stopdesk": 500}, {"code": 48, "name": "Relizane", "domicile": 700, "stopdesk": 400}, {"code": 49, "name": "Timimoun", "domicile": 1100, "stopdesk": 750}, {"code": 51, "name": "Ouled Djellal", "domicile": 800, "stopdesk": 500}, {"code": 52, "name": "Beni Abbes", "domicile": 1000, "stopdesk": 750}, {"code": 53, "name": "In Salah", "domicile": 1400, "stopdesk": 950}, {"code": 55, "name": "Touggourt", "domicile": 930, "stopdesk": 550}, {"code": 56, "name": "Djanet", "domicile": 2100, "stopdesk": 1500}, {"code": 57, "name": "El M'Ghair", "domicile": 930, "stopdesk": 550}, {"code": 58, "name": "El Meniaa", "domicile": 850, "stopdesk": 500} ]

🗄️ Backend Architecture (CRITICAL — read carefully)

⚠️ This store must deploy to any host (Vercel, Netlify, Lovable hosting) with zero manual secret setup on that host. Therefore:

Do NOT use TanStack Start server functions (createServerFn) or any server.ts file importing a service-role Supabase client for writes (orders) or reads of sensitive settings (Telegram tokens). That pattern requires SUPABASE_SERVICE_ROLE_KEY set manually on every host and breaks deployments.

INSTEAD:

Order creation: a Postgres RPC function place_order(...) (SECURITY DEFINER), called from the client via supabase.rpc('place_order', {...}) using only the public anon key. Validates input, checks stock, computes shipping, inserts order, decrements stock, returns order id.

Telegram notifications: a Supabase Edge Function (e.g. send-order-notifications) using the service role key stored as a Supabase project secret (not a host env var). Client calls the edge function with order_id only; edge function re-fetches order and sends the Telegram message.

Any other privileged operation goes through RLS policies or additional SECURITY DEFINER RPC / Edge Functions — never a service-role client in deployed frontend server code.

Tables (RLS on all):

categories: name, slug, image_url, status | public read published; admin ALL

products: name, description, price, old_price, image_url, image_urls[], category_id, stock_quantity, status, featured | public read published; admin ALL

orders: product_id/name/price, quantity, full_name, phone, commune, wilaya_id/name, delivery_type, shipping_fee, total, status, adresse | anon INSERT via place_order RPC only; admin SELECT/UPDATE/DELETE

shipping_rates: 58 wilayas, domicile + stopdesk fees | public read; admin manage

app_settings: site name, phone/WhatsApp, Instagram/Facebook/TikTok URLs, Meta Pixel ID, Telegram bot token + chat id | admin only

Security-definer functions: has_role(_user_id, _role); place_order(...) as above.

🔐 Admin Dashboard (Supabase Auth email/password, /admin)

Tabs: Commandes, Produits, Catégories, Réglages.

Commandes: view/search/filter by status, copy phone, WhatsApp link.

Produits: CRUD, multi-image upload to Supabase Storage, live previews, stock/price/status/featured.

Catégories: CRUD + image upload.

Réglages — two cards:

"Site & Marketing": store name, WhatsApp, Instagram/Facebook/TikTok URLs, Meta Pixel ID — one "Enregistrer" button.

"Notifications Telegram": Bot Token, Chat ID, "Enregistrer" button, "Tester la connexion" button (calls the Edge Function). Values stored in app_settings, admin-only access.

⚠️ Critical Rules

Guest checkout only — never show login to visitors.

RLS on every table; anon can only INSERT orders via place_order RPC.

Telegram + any privileged operation runs only inside a Supabase Edge Function — never in a TanStack server function or host-dependent env var.

No hardcoded admin credentials; roles in user_roles.

Verify no client.server.ts or server-only file imports SUPABASE_SERVICE_ROLE_KEY anywhere — checkout and notifications must work identically on Lovable, Vercel, or Netlify with only the public Supabase URL and anon key.

This project was built with [Lovable](https://lovable.dev).

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
