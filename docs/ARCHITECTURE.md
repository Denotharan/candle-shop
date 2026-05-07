# Serein Architecture

Serein is a small boutique candle shop application built as two local development services: a Vite/React frontend and a FastAPI backend. The current architecture favors simplicity and fast iteration over production concerns: application state is held in React, authentication tokens are stored in browser localStorage, and backend data is persisted to a local JSON file.

## System Overview

```text
Browser
  |
  | Vite dev server, React app
  v
frontend/  http://127.0.0.1:5173
  |
  | JSON over HTTP, Bearer token auth
  v
backend/   http://127.0.0.1:8000
  |
  | File reads/writes
  v
backend/data.json
```

## Runtime Components

### Frontend

Location: `frontend/`

The frontend is a Vite React app. The main application lives in `frontend/src/main.jsx`, with shared CSS in `frontend/src/styles.css` and static assets in `frontend/public/`.

Key responsibilities:

- Render the Serein storefront, product detail pages, cart, login/register screens, admin dashboard, and checkout success view.
- Manage client-side navigation with `window.history.pushState` and `popstate`.
- Fetch product, auth, cart, and checkout data from the FastAPI API.
- Store the session token and user payload in localStorage.
- Apply light/dark theme state using the `dark` class on the root HTML element.

The app uses React state in the top-level `App` component for:

- `path` and `query`: current client-side route state.
- `products`: product catalog loaded from `/products`.
- `cart`: authenticated user's cart loaded from `/cart`.
- `user`: current authenticated user, hydrated from localStorage and verified through `/auth/me`.
- `messages`: transient UI feedback.
- `themeTick`: a small trigger used to re-render theme-dependent UI.

Styling is mostly inline Tailwind utility classes delivered through the Tailwind CDN configured in `frontend/index.html`. `styles.css` provides global font families and the shared `.btn-primary` class.

### Backend

Location: `backend/`

The backend is a single FastAPI app in `backend/main.py`. It exposes product catalog, authentication, cart, and checkout endpoints, and stores all mutable data in `backend/data.json`.

Key responsibilities:

- Seed default product data when `data.json` does not exist.
- Read and write the JSON data store.
- Issue opaque session tokens for registered users and the built-in admin account.
- Protect cart and checkout routes with Bearer token authentication.
- Protect product creation with admin authorization.
- Serve OpenAPI documentation at `/docs`.

The backend uses Pydantic models for request validation:

- `Credentials`: login payload.
- `RegisterRequest`: registration payload.
- `ScentProfile`: product scent-note structure.
- `ProductIn`: admin product creation payload.

## Data Model

The local JSON store has four top-level collections:

```json
{
  "products": [],
  "users": [],
  "sessions": {},
  "carts": {}
}
```

### Products

Products are catalog entries with an integer `id`, display fields, inventory data, an optional image URL or data URL, and a nested scent profile:

- `id`
- `name`
- `description`
- `price`
- `scent_family`
- `burn_time`
- `stock_quantity`
- `image_url`
- `scent_profile.top`
- `scent_profile.middle`
- `scent_profile.base`

### Users and Sessions

Registered users are stored directly in `users`, including plaintext passwords in the current development implementation. Sessions map opaque token strings to user ids. The built-in admin user is not stored in `users`; it is recognized by hardcoded credentials:

- Username: `admin`
- Password: `admin`

Admin sessions map their token to the special user id `admin`.

### Carts

Carts are stored by user id. Each cart maps product ids, serialized as strings, to quantities:

```json
{
  "user-id": {
    "1": 2,
    "3": 1
  }
}
```

Checkout currently clears the user's cart and returns a confirmation status. It does not create an order record.

## API Surface

Base URL in development: `http://127.0.0.1:8000`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | No | Health check. |
| `GET` | `/products` | No | List products. Optional `family` query filters by scent family. |
| `POST` | `/products` | Admin | Create a product. |
| `POST` | `/auth/login` | No | Login with credentials and receive a token. |
| `POST` | `/auth/register` | No | Create a customer account and receive a token. |
| `GET` | `/auth/me` | User | Resolve the current user from a Bearer token. |
| `GET` | `/cart` | User | Get the current user's cart. |
| `POST` | `/cart/items/{product_id}` | User | Add one quantity of a product to the cart. |
| `DELETE` | `/cart/items/{product_id}` | User | Remove a product from the cart. |
| `POST` | `/checkout` | User | Clear the cart and return confirmation. |

## Main User Flows

### Storefront Browsing

1. The React app starts and calls `GET /products`.
2. Product cards render on the home page.
3. A scent family filter updates the URL query string and filters products client-side.
4. Product detail pages are selected by `/product/{id}` in the client-side router.

### Authentication

1. A customer submits login or registration.
2. The frontend calls `/auth/login` or `/auth/register`.
3. The backend creates a session token and returns `{ token, user }`.
4. The frontend stores both values in localStorage.
5. On reload, the frontend calls `/auth/me` to validate the stored token.

### Cart and Checkout

1. The user clicks Add to Bag.
2. If unauthenticated, the frontend redirects to `/login`.
3. If authenticated, the frontend calls `POST /cart/items/{product_id}`.
4. The backend updates `data.json` and returns the updated cart.
5. Checkout calls `POST /checkout`, which clears the cart and returns `{ "status": "confirmed" }`.

### Admin Product Creation

1. Admin logs in with the built-in admin credentials.
2. The frontend routes admin users to `/admin`.
3. The admin form builds a `ProductIn` payload.
4. The frontend calls `POST /products` with the Bearer token.
5. The backend verifies admin access, appends the product to `data.json`, and returns the created product.

## Configuration

### Frontend

The frontend API base URL is controlled by:

```text
VITE_API_URL
```

If unset, it defaults to:

```text
http://127.0.0.1:8000
```

### Backend

The backend currently uses constants in `backend/main.py` for:

- Data file path: `backend/data.json`
- Admin username: `admin`
- Admin password: `admin`
- CORS origins for local Vite ports `5173` and `5174`

`backend/.env` exists, but the current backend code does not load it.

## Local Development

Run the backend:

```powershell
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Run the frontend:

```powershell
cd frontend
npm install
npm run dev -- --port 5173
```

Open:

- Frontend: `http://127.0.0.1:5173/`
- Backend docs: `http://127.0.0.1:8000/docs`

## Current Constraints

- The backend stores data in a single JSON file. Concurrent writes can overwrite each other.
- Passwords are stored in plaintext and should not be used in production.
- Admin credentials are hardcoded.
- Sessions are stored in `data.json` and do not expire.
- Checkout does not reserve stock, reduce inventory, collect payment, or create order history.
- The frontend is mostly a single large React file, which is easy to scan now but will become harder to maintain as features grow.
- Tailwind is loaded from the CDN, so production builds depend on external CDN behavior unless the styling pipeline is moved into the build.
- Uploaded product images are converted to data URLs and stored in the JSON file, which can make `data.json` very large.

## Suggested Evolution

Good next architectural steps, in order of impact:

1. Move credentials, CORS origins, and data path into environment-based settings.
2. Hash passwords and replace localStorage auth with a more secure session strategy.
3. Replace `data.json` with SQLite or PostgreSQL once data integrity matters.
4. Split `frontend/src/main.jsx` into route, component, API client, and state modules.
5. Add order records and inventory decrementing during checkout.
6. Add tests around auth, cart mutation, product creation, and checkout.
7. Move Tailwind into the frontend build pipeline instead of using the CDN.

