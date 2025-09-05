# Vercel Deployment Instructions

## 🚀 Deploy to Vercel

The application is configured for Vercel deployment. Follow these steps:

### 1. Set up Vercel Postgres Database

1. Go to your Vercel project dashboard: `https://vercel.com/stevehurd/the-10s`
2. Navigate to the **Storage** tab
3. Click **Create Database**
4. Select **Postgres**
5. Choose a region (preferably same as your deployment)
6. Create the database

### 2. Configure Environment Variables

Vercel will automatically add these database environment variables:
- `DATABASE_URL`
- `POSTGRES_URL` 
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

You also need to manually add:
- `SPORTSDATA_API_KEY` = your SportsData.IO API key

### 3. Set up Database Schema

After the database is created, run the database setup:

**Option A: Using Vercel CLI**
```bash
vercel env pull .env.local
npm run db:push
```

**Option B: Using the setup script**
```bash
npm run db:setup
```

### 4. Initialize Data (Optional)

You can sync team data from SportsData.IO API by visiting:
```
https://your-app-url.vercel.app/api/admin/sync-teams
```

## 🔧 Troubleshooting

**Application Error: Server-side exception**
- This usually means DATABASE_URL is not set or the database schema hasn't been created
- Make sure you've completed steps 1-3 above

**Build Errors**
- The application uses `force-dynamic` to prevent build-time database queries
- All TypeScript and Next.js 15 compatibility issues have been resolved

## 📊 Database Schema

The application uses PostgreSQL with these main tables:
- `users` - Pool participants
- `teams` - NFL and College teams
- `drafts` - User draft picks
- `seasons` - Pool seasons
- `games` - Game results for scoring