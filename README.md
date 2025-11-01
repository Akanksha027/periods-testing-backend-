# Period Tracker Backend

A Next.js backend API for the Period Tracker mobile app, using Supabase for authentication and Prisma as the ORM.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Fill in your Supabase credentials

3. Set up Prisma:
```bash
npm run prisma:generate
npm run prisma:push
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the API documentation.

## API Endpoints

### Authentication
All endpoints require a valid Supabase JWT token in the Authorization header:
```
Authorization: Bearer <your-token>
```

### Endpoints

- `GET /api/user` - Get or create user profile
- `PATCH /api/user` - Update user profile
- `GET /api/periods` - Get all periods for user
- `POST /api/periods` - Create new period entry
- `PATCH /api/periods/[id]` - Update period entry
- `DELETE /api/periods/[id]` - Delete period entry
- `GET /api/symptoms` - Get symptoms (supports date range filtering)
- `POST /api/symptoms` - Log new symptom
- `GET /api/moods` - Get moods (supports date range filtering)
- `POST /api/moods` - Log new mood
- `GET /api/notes` - Get notes (supports date range filtering)
- `POST /api/notes` - Create new note
- `GET /api/settings` - Get user settings
- `PATCH /api/settings` - Update user settings
- `GET /api/predictions` - Get cycle predictions based on history

## Database Schema

The app uses Prisma with PostgreSQL (Supabase). The schema includes:
- Users
- Periods
- Symptoms
- Moods
- Notes
- User Settings

See `prisma/schema.prisma` for the complete schema.

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Prisma** - ORM for PostgreSQL
- **Supabase** - Authentication and PostgreSQL database
- **Zod** - Runtime validation
- **Tailwind CSS** - Styling

