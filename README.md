# 🃏 Bust & Chill

A real-time multiplayer Blackjack game built with Next.js, Socket.IO, and Prisma.

![Bust & Chill](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-black?style=for-the-badge&logo=socket.io)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=for-the-badge&logo=prisma)

## Features

- 🎮 **Multiplayer Blackjack** - Play with 2-5 players
- ⚡ **Real-time Updates** - Instant game state synchronization via WebSockets
- 🔐 **Authentication** - Secure registration with email verification
- 📧 **Custom Emails** - MJML templates for beautiful emails
- 🏆 **Leaderboard** - Track game history and scores
- 🌙 **Dark Mode** - Toggle between light and dark themes
- 📱 **Responsive** - Works on desktop and mobile

## Prerequisites

- **Node.js** 18+ 
- **PostgreSQL** (local or Docker)
- **MailHog** (optional, for email testing)

## Quick Start

### 1. Clone and Install

```bash
cd bust-and-chill
npm install
```

### 2. Setup Environment

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bustandchill?schema=public"

# JWT Secret (change this!)
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# SMTP Configuration (MailHog)
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="noreply@bustandchill.local"
```

### 3. Setup Database

#### Option A: Using Docker (Recommended)

```bash
# Start PostgreSQL with Docker
docker run --name bustandchill-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bustandchill -p 5432:5432 -d postgres:15

# Wait a few seconds, then run migrations
npm run db:push
npm run db:generate
```

#### Option B: Using Local PostgreSQL

1. Create a database named `bustandchill`
2. Update `DATABASE_URL` in `.env` with your credentials
3. Run migrations:

```bash
npm run db:push
npm run db:generate
```

### 4. Setup Email (Optional)

For email verification testing, use MailHog:

```bash
# Using Docker
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog

# Access MailHog UI at http://localhost:8025
```

If MailHog is not available, verification URLs will be logged to the console.

### 5. Start the Server

```bash
npm run dev
```

The app will be available at **http://localhost:3000**

## Testing Multiplayer

To test multiplayer locally:

1. Open **http://localhost:3000** in Chrome
2. Open **http://localhost:3000** in Firefox (or Chrome Incognito)
3. Register different accounts in each browser
4. Verify emails (check MailHog at http://localhost:8025 or console logs)
5. Login in both browsers
6. In Browser 1: Create a game and copy the Game ID
7. In Browser 2: Join with the Game ID
8. Start the game and play!

## Game Rules

### Blackjack Basics

- Each player is dealt 2 cards
- Goal: Get as close to 21 as possible without going over
- **Hit**: Draw another card
- **Stand**: Keep your current hand
- Face cards (J, Q, K) = 10 points
- Aces = 1 or 11 points (automatic)
- Going over 21 = Bust (you lose)

### Turn System

- Players take turns in seat order
- 30-second timer per turn
- If timer expires, auto-stand
- Game ends when all players have finished

### Scoring

- Winner = Highest hand value ≤ 21
- Ties are possible (multiple winners)
- Busted players score 0 points

## Project Structure

```
bust-and-chill/
├── prisma/
│   └── schema.prisma      # Database schema
├── src/
│   ├── app/               # Next.js App Router pages
│   │   ├── api/           # API routes
│   │   ├── dashboard/     # Dashboard page
│   │   ├── game/[uuid]/   # Game page
│   │   ├── login/         # Login page
│   │   ├── register/      # Register page
│   │   └── verify-email/  # Email verification
│   ├── components/        # React components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities (db, auth, email)
│   └── server/            # Socket.IO & game engine
├── server.ts              # Custom server with Socket.IO
└── package.json
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with Socket.IO |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:push` | Push schema to database |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Prisma Studio |

## Tech Stack

- **Frontend**: Next.js 16, React 19, TailwindCSS, daisyUI
- **Backend**: Next.js API Routes, Socket.IO
- **Database**: PostgreSQL, Prisma ORM
- **Auth**: JWT (httpOnly cookies)
- **Email**: Nodemailer, MJML templates
- **Real-time**: Socket.IO WebSockets

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_SECRET` | Secret for JWT signing | Required |
| `NEXT_PUBLIC_APP_URL` | App URL for emails | http://localhost:3000 |
| `SMTP_HOST` | SMTP server host | localhost |
| `SMTP_PORT` | SMTP server port | 1025 |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASS` | SMTP password | - |
| `SMTP_FROM` | Email sender address | noreply@bustandchill.local |

## Troubleshooting

### "Cannot connect to database"

- Ensure PostgreSQL is running
- Check `DATABASE_URL` in `.env`
- Run `npm run db:push` to create tables

### "Email verification not working"

- Start MailHog: `docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog`
- Check console logs for verification URL
- Ensure `SMTP_HOST` and `SMTP_PORT` are correct

### "Socket.IO not connecting"

- Ensure you're using `npm run dev` (custom server)
- Check browser console for connection errors
- Verify `NEXT_PUBLIC_APP_URL` matches your server URL

### "Game not updating in real-time"

- Check Socket.IO connection status in dashboard
- Ensure both browsers are logged in and connected
- Check server console for socket errors

## License

MIT License - Feel free to use this project for learning and fun!

---

Made with ❤️ and 🃏
