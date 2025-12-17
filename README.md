# Backend (Express + Prisma + MySQL)

## Setup
- Install dependencies: `npm install`
- Configure environment: `cp .env.example .env` and update `DATABASE_URL`/`PORT` (database name defaults to `spu_db`)
- Generate Prisma client: `npx prisma generate`
- Create schema in DB: `npx prisma migrate dev --name init` (or `npx prisma db push` for existing DB)
- Seed Punjab districts and posts: `npx prisma db seed` (runs automatically after `prisma migrate dev` once dependencies are installed)

## Email/OTP
- Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` in `.env`.
- Send OTP: `POST /otp/send { email }`
- Verify OTP: `POST /otp/verify { email, code }`

## Run
- Start API: `npm run dev`
- Health check: GET `http://localhost:3000/health`
