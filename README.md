<<<<<<< HEAD
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
2. Run [`supabase/admin_management.sql`](./supabase/admin_management.sql) for the admin account-list, user-session-list, and account-delete RPCs.
3. Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as Edge Function secrets, then deploy the avatar function:

   ```sh
   supabase functions deploy upload-avatar
   ```

   The upload function validates the signed-in user's session, file type, size, and image signature, and assigns a generated filename. Keep the service-role key server-side.

### Admin accounts

We will provide the admin credentials.

### Login and activity status

Login uses the Supabase `pgcrypto` extension to hash and verify passwords. Sessions are stored in `user_sessions` and expire after seven days. The admin dashboard displays session start times, expiration times, and status below the accounts table; it never exposes session tokens. The dashboard displays an account as **Active** when its database status is active and its `last_activity` is less than two days old. Otherwise, it displays **Inactive**; this dashboard label does not disable login.

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
=======

# 🚧 Cone Clash

<img width="450" height="450" alt="Bonjour Traffic GIF" src="https://github.com/user-attachments/assets/96c91d60-fd94-420f-b2e4-2e42a94a0b7e" />

> Hala bira!

🎮 **[Play it live](https://cone-clash.vercel.app/)**

Cone Clash is a local multiplayer 3D party game for 2–3 players on one keyboard. Race to the center of the arena, grab a cone, haul it back to your base, and steal from your rivals before they steal from you.

Built with **Three.js**, **Bootstrap**, and **Supabase**.

---

## How to play

1. **Create a room**: Pick a room name, a username, a color, and (optionally) an avatar.
2. **Add players**: Up to 3 players can join a room. At least 2 are needed to start.
3. **Get ready**: Every player clicks **I'M READY** on the "How to play" screen.
4. When the countdown hits **GO**:
   - Dash from your base to the center and press your **action key** near a cone to pick it up.
   - Carry **one cone at a time** back to your own base and press your action key to drop it off.
   - Stand at a rival's base and press your action key to **steal** one of their cones.
5. **Win a round** by getting 3 cones into your base, or by having the most cones when the 60-second timer runs out.
6. **Win the match** by being the first to 2 round wins.

### Things to know

- Cones have different weights. **Heavy cones speed you up, light cones slow you down.**
- Every few seconds, the cones in the center **shuffle** to new spots.
- A tied round is replayed.

### Controls

| Player | Move | Action |
|---|---|---|
| Player 1 | `W` `A` `S` `D` | `E` |
| Player 2 | Arrow keys | `Enter` |
| Player 3 | `I` `J` `K` `L` | `O` |

---

## Tech stack

| Tool | Used for |
|---|---|
| [Three.js](https://threejs.org/) | 3D arena, players, and cones |
| [Bootstrap 5](https://getbootstrap.com/) | Lobby, HUD, and podium styling |
| [Supabase](https://supabase.com/) | Player records, avatar storage, and cloud match history |
| [canvas-confetti](https://github.com/catdad/canvas-confetti) | Winner celebration |
| [Vite](https://vitejs.dev/) | Dev server and build tool |
| `localStorage` | Live rooms and local match history |

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- A [Supabase](https://supabase.com/) project

### Install

```bash
npm install
```

### Environment variables

Create a `.env` file in the project root with your Supabase credentials. Check `src/supabaseClient.js` for the exact variable names it reads. Vite projects usually use:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

> Never commit your `.env` file. It is already listed in `.gitignore`.

### Supabase setup

The game expects the following in your Supabase project:

**Tables**

- `players`: `id`, `username` (unique), `favorite_color`, `avatar_url`
- `matches`: `id`, `room_name`, `status`, `total_rounds`, `ended_at`
- `match_participants`: `id`, `match_id`, `player_id`, `round_wins`, `cones_collected`, `is_winner`

**Storage**

- A public bucket named `avatars` for player avatar images.

Row Level Security policies must allow the app to read and write these tables and upload to the bucket.

### Run

```bash
npm run dev
```

Then open the local URL that Vite prints (usually `http://localhost:5173`).

### Build for production

```bash
npm run build
npm run preview
```

---

## Testing Credentials

Use the following test account of admin and user to verify the login functionality.

| Role | Username | Password |
|---|---|---|
| Admin | `admin01` | `adminkawow` |
| User | `phloemwow` | `phloemdel` |


> **Note:** Replace the placeholders with the actual test accounts configured in Supabase. These are not predefined accounts. Do not publish real production passwords or sensitive credentials in a public repository.

---

## Deployment

The game is deployed on [Vercel](https://vercel.com/).

1. Push the project to GitHub.
2. In Vercel, click **Add New → Project** and import the repository.
3. Vercel detects Vite automatically. The defaults should be:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
4. Under **Settings → Environment Variables**, add the same Supabase variables from your local `.env` file (for example, `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`).
5. Click **Deploy**. Every push to the main branch redeploys automatically.

> Your `.env` file is not uploaded to GitHub, so Vercel will not see it. If you add or change an environment variable in Vercel, you must **redeploy** for it to take effect.

In your Supabase dashboard, also add your Vercel URL under **Authentication → URL Configuration** if you use auth, so redirects work on the live site.

---

## Project structure

```text
src/
├── main.js              # Entry point: wires everything together
├── menu.js              # Menu setup
├── auth.js              # Authentication
├── supabaseClient.js    # Supabase connection
├── style.css            # Custom styles
│
├── data/                # Data and non-visual helpers
│   ├── constants.js     # Colors, player configs, storage keys, game limits
│   ├── helpers.js       # escapeHtml, makeId, validation, distanceXZ
│   ├── storage.js       # localStorage read/write for rooms and history
│   └── database.js      # Supabase queries and avatar uploads
│
├── game/                # Game logic and 3D objects
│   ├── world.js         # Scene, camera, renderer, lights, arena
│   ├── state.js         # Shared game state (timer, round, current room)
│   ├── players.js       # Player and base creation, player list
│   ├── cones.js         # Cone creation, shuffling, animation
│   ├── input.js         # Keyboard tracking
│   ├── movement.js      # Player movement and carried cones
│   ├── interaction.js   # Pick up, drop off, and steal
│   ├── scores.js        # Score updates and saving to the room
│   ├── rounds.js        # Countdown, starting rounds
│   ├── matchStart.js    # Starting and leaving a match
│   └── matchEnd.js      # Ending rounds, podium, saving results
│
└── ui/                  # Everything drawn on screen
    ├── template.js      # Main HTML template
    ├── lobby.js         # Room list and match history rendering
    ├── lobbyHandlers.js # Create, join, leave, color, start, delete
    ├── colorPicker.js   # Color swatch picker
    ├── readyScreen.js   # "How to play" and ready-up screen
    ├── scoreboard.js    # In-game scoreboard and round badge
    ├── podium.js        # Round and match podium
    ├── confetti.js      # Confetti effects
    └── messages.js      # Lobby and error messages
```

### Design notes

- **Shared state:** Values that many files need to change (like `gameStarted` or `matchRound`) live in one `state` object in `game/state.js`.
- **No circular imports:** When a file needs to call a function that lives in `main.js`, `main.js` passes it in (for example, `setupLobbyHandlers({ renderLobby, startMatch, deleteMatchRecord })`).
- **Game files don't touch the screen directly** where possible. `interaction.js` reports scoring through callbacks, and the `ui/` folder handles drawing.

---

## Known limitations

- Rooms are stored in the browser's `localStorage`, so "multiplayer" means everyone shares one browser and keyboard. Opening the site in another tab on the same browser will sync rooms, but other devices will not see them.
- Three players on one keyboard can hit keyboard ghosting limits on some keyboards.

---

## Ideas for the future

- Online multiplayer with Supabase Realtime
- Sound effects and music
- More arena layouts and power-ups
- Mobile touch controls
>>>>>>> origin/main
