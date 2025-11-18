# Nike Shoes Store (React + Vite)

A modern Nike-themed storefront built with React and Vite. Includes product listing, search & filters, wishlist, cart with sidebar, quickview modal, and authentication UI (Sign In/Sign Up). Checkout is wired for Razorpay on the client.

## 🚀 Stack
- React 19 + Vite 7
- CSS (custom) + Font Awesome icons
- Optional: Supabase Auth (email/password)

## 📁 Project Structure
```
nike_shoes_hcj/
├─ nike-react/           # React app root
│  ├─ public/img/        # Static images
│  └─ src/
│     ├─ App.jsx         # Main app, auth views, cart/wishlist/quickview
│     ├─ style.css       # Global styles (site + auth + modals)
│     ├─ data.js         # Products
│     └─ main.jsx        # Entry
└─ README.md             # This file
```

## ✨ Features
- Home hero and sections (New Arrivals, Best Collection, About)
- Search, price/category sort, and filters
- Wishlist with sidebar modal
- Cart with sidebar modal and quantity controls
- Product Quickview modal
- Auth UI: Sign In / Sign Up (React components)
- Checkout button prepared for Razorpay

## 🔐 Authentication (Supabase)
Auth is implemented via Supabase client if configured. Provide these env vars in `nike-react/.env`:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

If not configured, ensure the app code handles fallback as needed.

## 💳 Checkout (Razorpay)
The Checkout button opens Razorpay on the client. Update your key in `App.jsx` (or refactor to use an env var):

```
// Example env if you refactor
VITE_RAZORPAY_KEY=rzp_test_xxxxxxxxx
```

Production setups should create orders server-side and verify signatures.

## 🧑‍💻 Local Development

1) Move to the React app and install dependencies
```
cd nike-react
npm install
```

2) Start the dev server
```
npm run dev
```

3) Build and preview
```
npm run build
npm run preview
```

## 📸 Screenshots
Add your screenshots (e.g., auth, cart, wishlist) to this section.

## 📦 Scripts (package.json)
- `dev` – start Vite dev server
- `build` – production build
- `preview` – preview the production build
- `lint` – run ESLint

## 🛠️ Notes
- Fixed header is used; content sections account for the top offset.
- Modals (cart/wishlist/quickview) are mounted conditionally by React and styled as flex overlays.

## 📄 License
Open-source for learning and personal projects. Attribute if you reuse.
