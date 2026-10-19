**Firebase / Firestore setup (local dev)**

- 1) Add client env vars to `.env` (copy from `.env.example`):

  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`

  These are used by the frontend (`src/lib/firebase.ts`). After editing `.env`, restart the dev server.

- 2) To seed example data in Firestore (requires service account):

  - Install dev dependency: `npm install --save-dev firebase-admin`
  - Place a service account JSON file somewhere in the repo (keep it secret), or use an environment variable `GOOGLE_APPLICATION_CREDENTIALS`.
  - Set `SERVICE_ACCOUNT_PATH` in environment or use `GOOGLE_APPLICATION_CREDENTIALS`.
  - Run:

```bash
npm run seed:firestore
```

  This will create sample `products`, an `orders` document and `order_items`.

- 3) Optional: use Firestore emulator for local development. Set `FIRESTORE_EMULATOR_HOST=localhost:8080` and run the emulator. Update `src/lib/firebase.ts` if needed.

- Data model notes (fields expected by controllers):

  - `products` documents:
    - `name` (string)
    - `price` (number)
    - `category` (string)
    - `requires_packaging` (boolean)
    - `stock` (number)

  - `orders` documents:
    - `order_type` (string: 'dine_in' | 'takeaway')
    - `table_number` (number|null)
    - `status` (string)
    - `subtotal` (number)
    - `packaging_fee` (number)
    - `total` (number)
    - `amount_paid` (number)
    - `balance` (number)
    - `created_at` (string iso)

  - `order_items` documents:
    - `order_id` (string)
    - `product_id` (string)
    - `product_name` (string)
    - `category` (string)
    - `quantity` (number)
    - `unit_price` (number)
    - `packaging_surcharge` (number)
    - `item_total` (number)
    - `is_takeaway` (boolean)
    - `paid` (boolean)

  - `payments` documents:
    - `order_id` (string)
    - `amount` (number)
    - `payment_method` (string)
    - `receipt_photo_url` (string|null)
    - `item_ids` (array)
    - `created_at` (string iso)

- If you want, puedo:
  - Añadir `.env` real con tus valores (si me das los valores aquí —no recomendable en chat—), o
  - Configurar para usar el emulador y evitar subir credenciales, o
  - Ejecutar el seed aquí si me proporcionas la ruta del `serviceAccountKey.json` disponible en el workspace.

Interactive helper to create `.env`

You can run a small interactive script that asks for each variable from `.env.example` and writes `.env`:

```bash
npm run setup:env
```

This will prompt for each `VITE_` variable and create `.env` in the project root. `.env` is already ignored by `.gitignore`.

If you prefer automated seeding into Firestore after creating the `.env` and providing a `SERVICE_ACCOUNT_PATH`, run:

```bash
npm install --save-dev firebase-admin
npm run seed:firestore
```


