# Cone Clash

Short Description: A flash multiplayer game, maximum of three per lobby.  Players must prepare and use their reflexes and speed when a countdown hits zero, they must dash to the center from their base where the set of cones, only 5, are placed. There’s a “one cone at a time” rule, you must grab one cone and put it to your base, grab as many as you can until the cone at the center is gone or before the timer reaches zero. You can steal from other players in order to achieve your goal but protect your cones as well. The player with the most cones in their base is the winner. 

Game Mechanics: 

- Countdown/Timer:  A 3 seconds countdown before the game starts. A 45 seconds timer is set for the player to steal or protect cones once the cones are cleared at the         center.
- Speed: With 5 cones at the center each cone has a randomized weight which either slows down(Light cones) or speeds up (Heavy cones) the player.
- Steal & protect:  Once the 5 cones at the center are cleared, the player has the chance to either add up or lessen their cones. The decision lies in their hands if they     will steal or protect their cones.
- Leaderboard: The system analyzes the final numbers, sorting the three players based on the total number of cones successfully sitting inside their base line. Official       ranking will present a podium overlay covering the screen. The player with the highest score is placed in the center.

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
