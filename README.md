# TrailDeck

**A legal case and document tracking platform — a college project in early development.**

TrailDeck is being built to help legal professionals organize client information and case records in one place. The goal is to create a clearer, more secure workflow for managing legal matters, with room to add document handling and AI-assisted search as the project develops.

> **Project status:** This is an early-stage academic project and is not production-ready. Features and setup may change as development continues.

## Current foundation

- **Authentication API:** registration, login, and current-user endpoints using JSON Web Tokens.
- **Role-aware access:** lawyer/client roles and authorization foundations.
- **Client records:** API foundation for managing lawyer-owned client records.
- **Database:** PostgreSQL schema managed with Prisma ORM.
- **Backend tests:** automated API tests with Vitest and Supertest.
- **Frontend foundation:** React application with a login flow and protected-route/session handling.

## Planned direction

- Expand case creation, tracking, and client–case workflows.
- Improve document organization and evidence handling.
- Explore AI-assisted document processing and semantic search.

These are project goals, not claims that every feature is already implemented.

## Tech stack

| Area | Technologies |
|---|---|
| Frontend | React, Vite, Tailwind CSS v4 |
| Backend | Node.js, Express (ES modules) |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | JWT, bcryptjs |
| Testing | Vitest, Supertest |
| Potential integrations | Google Gemini API, Cloudinary |

## Repository structure

```text
traildeck/
├── client/   # React + Vite frontend
├── server/   # Express API, Prisma schema, migrations, and tests
└── README.md
```

## Run locally

### Requirements

- Node.js and npm
- A PostgreSQL database
- Git

### 1. Clone the repository

```bash
git clone https://github.com/kmanaswini6/traildeck.git
cd traildeck
```

### 2. Configure the backend

```bash
cd server
npm install
```

Copy `.env.example` to `.env` and set the values for your local environment. At minimum, configure:

- `DATABASE_URL` — PostgreSQL connection string
- `DIRECT_URL` — direct PostgreSQL connection string used by Prisma migrations
- `JWT_SECRET` — a strong, locally generated secret
- `PORT` — backend port (the example uses `5000`)
- `CLIENT_URL` — frontend origin (the example uses `http://localhost:5173`)

Generate the Prisma client and apply the repository's migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

Start the API from the `server` directory:

```bash
node src/server.js
```

### 3. Configure the frontend

In a separate terminal:

```bash
cd client
npm install
```

Copy `.env.example` to `.env` and set `VITE_API_URL=http://localhost:5000` (or the URL where your API is running). Then start Vite:

```bash
npm run dev
```

### Run backend tests

From the `server` directory:

```bash
npm test
```

## Security notes

- Keep local `.env` files out of version control.
- Use your own strong `JWT_SECRET`; never use example values as real credentials.
- Do not commit database passwords, API keys, cloud credentials, or real user data.
- This project has not been presented as a production-hardened legal records system. Do not use it for confidential or real client information.

## Learning goals

TrailDeck is a hands-on project for learning full-stack development, REST API design, authentication and authorization, relational data modeling, and automated testing.

## Author

**Manaswini Kolantla** — B.Tech Computer Science and Engineering student.
