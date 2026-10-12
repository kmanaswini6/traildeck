# TrailDeck System Directives

- Stack:
  - Frontend: React + Vite + Tailwind CSS (under `/client`)
  - Backend: Node.js + Express with ES Modules (under `/server`)
  - Database: PostgreSQL (Neon) + Prisma ORM + pgvector
  - AI: Gemini API (@google/genai)
  - Storage: Cloudinary (raw/authenticated)
  - Auth: JWT + bcryptjs

- Rules:
  1. Do NOT add or swap any dependencies without confirmation.
  2. The server must use ES modules ("type": "module" in package.json).
  3. Never hardcode API keys or database URLs. Always use .env files.
  4. Follow the standard error schema: { "error": { "code": string, "message": string, "details": [] } }