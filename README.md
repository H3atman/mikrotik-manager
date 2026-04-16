## MikroTik Manager
Next.js 16 app for PPPoE subscriber management on MikroTik routers.

## UI Stack
- `shadcn/ui` preset: `radix-lyra`
- base color: `neutral`
- theme accent: `orange`
- icon library: `@tabler/icons-react` (no `lucide-react` usage)
- font: `JetBrains Mono` via `next/font/google`
- Tailwind CSS v4 with CSS variables in `src/app/globals.css`

## Run
```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validate
```bash
npm run lint
npm run build
```
