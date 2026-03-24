# OmniDesk

A monolithic Next.js productivity hub. The first module is **Timesheet Manager** for tracking daily work tasks and exporting monthly reports in XLSX format matching your work template.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Prisma + Neon PostgreSQL
- **Auth**: Better Auth (self-hosted, stores in same DB)
- **UI**: Tailwind CSS, shadcn/ui (Radix)
- **XLSX**: ExcelJS

## Setup

### 1. Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL="postgresql://neondb_owner:PASSWORD@ep-yellow-morning-a1elj109-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
BETTER_AUTH_SECRET="run: npx @better-auth/cli secret"
BETTER_AUTH_URL="http://localhost:3000"
```

### 2. Generate Auth Secret

```bash
npx @better-auth/cli secret
```

Copy the output and set `BETTER_AUTH_SECRET` in `.env`.

### 3. Run Migrations

```bash
npm run db:migrate
```

### 4. Start the App

```bash
npm run dev
```

Open http://localhost:3000

## Usage

1. Sign up or sign in (email/password)
2. Go to **Timesheet Manager**
3. Click **Add Task** to log daily work (date, project, bullet points, status)
4. When you need a report, use **Export XLSX** or **Export CSV** to download that month’s timesheet (column layout matches a typical daily-status template; values are plain data, not spreadsheet formulas)

## Project Structure

```
OmniDesk/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API routes
│   │   ├── (dashboard)/  # Protected layout
│   │   ├── sign-in/
│   │   └── sign-up/
│   ├── components/       # React components
│   └── lib/              # Auth, DB, utilities
├── prisma/
│   └── schema.prisma
└── package.json
```

## Adding New Tools

Add new pages under `src/app/(dashboard)/` and nav links in `src/components/DashboardLayout.tsx`.
