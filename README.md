# Cryptid X Decoder

A full-stack web application that decrypts and retrieves authorized Lua scripts from an encrypted GitHub repository.

---

## Architecture

```
cryptid-x/
├── frontend/           Static HTML/CSS/JS UI
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/            Node.js + Express API server
│   ├── server.js
│   ├── routes/
│   │   ├── decode.js   POST /api/decode
│   │   ├── auth.js     POST /api/auth/register, /login
│   │   └── keys.js     GET/POST/DELETE /api/keys
│   └── middleware/
│       ├── auth.js     JWT + API key verification
│       └── validation.js  Input sanitization
├── discord-bot/        Discord.js bot
│   ├── bot.js
│   └── package.json
├── shared/utils/
│   └── decrypt.js      Base32 → XOR decryption (server-side only)
├── .env.example
└── README.md
```

---

## Prerequisites

- **Node.js** v18 or higher
- A **Discord bot token** (for the bot component)
- A web host for the frontend (Netlify, Vercel, GitHub Pages, etc.)
- A Node.js host for the backend (Railway, Render, Fly.io, a VPS, etc.)

---

## Quick Start

### 1. Clone / unzip

```bash
unzip cryptid-x.zip
cd cryptid-x
```

### 2. Configure environment variables

```bash
cp .env.example backend/.env
cp .env.example discord-bot/.env
```

Edit each `.env` file and fill in all values (see **Environment Variables** section below).

### 3. Install backend dependencies

```bash
cd backend
npm install
```

### 4. Start the backend

```bash
npm start
# or for development with auto-restart:
npm run dev
```

The API will listen on `http://localhost:3001` (or `PORT` from `.env`).

### 5. Serve the frontend

For local development, use any static file server:

```bash
cd frontend
npx serve .
# or
python3 -m http.server 3000
```

Open `http://localhost:3000` in your browser.

**Important:** Edit `frontend/app.js` line 7 to point to your backend URL:
```js
const API_BASE = window.CRYPTID_API_BASE || 'http://localhost:3001';
```
For production, replace `http://localhost:3001` with your deployed backend URL.

### 6. Install and start the Discord bot

```bash
cd discord-bot
npm install
# Create an API key first via the web UI (API Keys page), then add it to discord-bot/.env
npm start
```

---

## API Endpoints

### `POST /api/decode`
Decodes a script by ID.

**Request:**
```json
{ "id": "2723928466610" }
```
Also accepts full URLs: `https://encrypt-x.pages.dev/Scripts?Id=2723928466610`

**Response (200):**
```json
{
  "scriptId": "2723928466610",
  "lua": "-- decrypted Lua source...",
  "bytes": 4096
}
```

**Auth:** Optional. Pass `Authorization: Bearer <jwt>` or `X-API-Key: <key>`.

---

### `POST /api/auth/register`
Register a new account.

**Request:** `{ "username": "alice", "password": "hunter2!!" }`  
**Response:** `{ "token": "...", "username": "alice" }`

---

### `POST /api/auth/login`
Login to an existing account.

**Request:** `{ "username": "alice", "password": "hunter2!!" }`  
**Response:** `{ "token": "...", "username": "alice" }`

---

### `GET /api/keys`
List your API keys (requires JWT).

**Headers:** `Authorization: Bearer <token>`  
**Response:** `{ "keys": [{ "id": "...", "label": "...", "preview": "cxd_abc...xyz", "createdAt": 0 }] }`

---

### `POST /api/keys`
Create a new API key (requires JWT).

**Request:** `{ "label": "Discord Bot" }`  
**Response:** `{ "id": "...", "key": "cxd_full_key_shown_once", "label": "...", "createdAt": 0 }`

---

### `DELETE /api/keys/:id`
Delete an API key (requires JWT).

---

### `POST /api/keys/:id/regenerate`
Regenerate a key (requires JWT). Returns the new full key value once.

---

## Discord Bot Commands

| Command | Description |
|---|---|
| `!decode <ID>` | Decode a script by numeric ID |
| `!decode <URL>` | Decode a script from a full URL |
| `!cxhelp` | Show help |

The bot uploads results as a `.txt` attachment with a randomized filename. Raw keys and encrypted data are never sent to Discord chat.

---

## Environment Variables

| Variable | Used by | Description |
|---|---|---|
| `PORT` | Backend | HTTP port (default: 3001) |
| `JWT_SECRET` | Backend | Secret for JWT signing (min. 32 chars, random) |
| `JWT_EXPIRES_IN` | Backend | JWT lifespan (e.g. `24h`, `7d`) |
| `ALLOWED_ORIGIN` | Backend | CORS-allowed frontend origin |
| `DISCORD_TOKEN` | Bot | Discord bot token |
| `CRYPTID_API_URL` | Bot | Backend base URL (no trailing slash) |
| `CRYPTID_API_KEY` | Bot | API key for bot to call backend |
| `BOT_PREFIX` | Bot | Command prefix (default: `!`) |

---

## Deployment

### Backend on Railway / Render / Fly.io

1. Push the `backend/` folder (or the whole repo) to a GitHub repository.
2. Connect to Railway/Render and set the build command to `npm install` and start command to `node server.js`.
3. Add all environment variables from `.env.example`.
4. Note the deployed URL (e.g. `https://cryptid-x-backend.railway.app`).

### Frontend on Netlify / Vercel

1. In `frontend/app.js`, replace `http://localhost:3001` with your backend URL.
2. Deploy the `frontend/` folder as a static site.
3. No build step required — it's plain HTML/CSS/JS.

### Discord Bot on a VPS or Railway

1. Deploy `discord-bot/` to any Node.js host that keeps a persistent process.
2. Set `CRYPTID_API_URL` to your deployed backend URL.
3. Create an API key via the web UI and set `CRYPTID_API_KEY`.

---

## Security Notes

- **Decryption is server-side only.** The frontend never receives raw `Key` or `Script` fields.
- **Rate limiting** is applied per IP: 100 req/15min globally, 20 req/min on `/api/decode`, 10 req/15min on auth routes.
- **Passwords** are hashed with bcrypt (12 rounds).
- **JWTs** expire after 24h by default.
- **The in-memory user/key store** resets on server restart. For production, replace with a real database (PostgreSQL, MongoDB, etc.).
- API keys are generated with UUID v4 prefixed with `cxd_` for easy identification.

---

## Decryption Algorithm

1. Fetch JSON from `https://raw.githubusercontent.com/ScriptObfuscator2/Scripts/main/{SCRIPT_ID}`
2. Base32-decode the `Script` field (RFC-4648: A–Z + 2–7)
3. XOR each decoded byte against cycling bytes of the `Key` field
4. Interpret result as UTF-8 → Lua source code

See `shared/utils/decrypt.js` for the implementation.
