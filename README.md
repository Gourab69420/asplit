# ASplit — Collaborative Trip Expense Manager

A premium mobile-first PWA for splitting trip expenses with friends and settling up via UPI.

## Features

- Google OAuth sign-in via Supabase
- Create trips and invite members
- Add and split expenses (equal, custom, percentage)
- Real-time settlement calculations
- UPI payment integration with QR code
- Profile management
- Offline-ready PWA

## Tech Stack

- React + Vite
- Framer Motion
- Lucide React icons
- Supabase (Auth + PostgreSQL)

## Setup

1. Clone the repo
```
git clone https://github.com/Gourab69420/asplit.git
cd asplit
npm install
```

2. Copy `.env.example` to `.env.local` and fill in your Supabase credentials
```
cp .env.example .env.local
```

3. Run the SQL schema in your Supabase SQL Editor
```
supabase_schema.sql
```

4. Start the dev server
```
npm run dev
```

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
