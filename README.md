# Cone Clash

Cone Clash is a browser-based arena game built with Three.js, Vite, and Supabase. Players can use guest mode or sign in with an account. The admin area provides account management and tools for managing match, player, and participant records.

## Requirements

- Node.js 18 or newer
- npm
- A Supabase project with the application's database tables configured

## Local setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create a `.env` file in the project root:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
   ```

   Use the project's publishable key in the browser app. Never put the Supabase service-role key in a `VITE_` variable or browser code.

3. Start the development server:

   ```sh
   npm run dev
   ```

   Open the local URL printed by Vite.

## Supabase setup

The SQL scripts expect the application's base tables to already exist in the `public` schema, including `users`, `user_sessions`, `matches`, `players`, and `match_participants`.

1. Run [`supabase/security.sql`](./supabase/security.sql) in the Supabase SQL Editor. It configures avatar storage, adds the secure authentication and admin game-record RPCs, and restricts direct access to authentication tables. Apply it before using the matching application code.
2. Run [`supabase/admin_management.sql`](./supabase/admin_management.sql) for the admin account-list and account-delete RPCs.
3. Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as Edge Function secrets, then deploy the avatar function:

   ```sh
   supabase functions deploy upload-avatar
   ```

   The upload function validates the signed-in user's session, file type, size, and image signature, and assigns a generated filename. Keep the service-role key server-side.

### Admin accounts

Public registration creates regular user accounts only. Admin accounts must be provisioned or promoted through a trusted, server-side process; do not expose admin registration in the browser.

### Login and activity status

Login uses the Supabase `pgcrypto` extension to hash and verify passwords. Sessions are stored in `user_sessions` and expire after seven days. The admin dashboard displays an account as **Active** when its database status is active and its `last_activity` is less than two days old. Otherwise, it displays **Inactive**; this dashboard label does not disable login.

Avatar uploads require a signed-in account. Guests can still play without uploading an avatar.

## Build

Create a production build:

```sh
npm run build
```

Preview the production build locally:

```sh
npm run preview
```
