This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Remote Access with Cloudflare Tunnel

This application supports using Cloudflare Tunnel to securely access your MikroTik router from anywhere, even when deployed on Vercel or other cloud platforms.

### Setup Instructions

1. **Set up Cloudflare Tunnel**:
   - Install `cloudflared` on a device in your local network
   - Create a tunnel pointing to your MikroTik router's web interface
   - Configure your tunnel with a domain like `your-router.yourdomain.com`
   - For detailed instructions, see [Cloudflare Tunnel Setup Guide](docs/CLOUDFLARE-TUNNEL-SETUP.md)

2. **Configure the Application**:
   - In your Vercel deployment, set the environment variable:
     ```
     NEXT_PUBLIC_USE_CLOUDFLARE_TUNNEL=true
     ```
   - Update the URL in `lib/mikrotik.ts` to match your Cloudflare Tunnel domain

3. **Local Development**:
   - Create a `.env.local` file based on `.env.local.example`
   - Set `NEXT_PUBLIC_USE_CLOUDFLARE_TUNNEL=false` for direct local access
   - Or set `NEXT_PUBLIC_USE_CLOUDFLARE_TUNNEL=true` to test with your tunnel

### Benefits

- Securely access your MikroTik router from anywhere
- No need to expose your router directly to the internet
- Works with cloud deployments like Vercel
- Maintains end-to-end encryption
- Simplified connection form (only username and password required)
- Built-in API proxy to avoid CORS issues in both development and production

### How It Works

The application uses a server-side API proxy to communicate with your MikroTik router through the Cloudflare Tunnel. This approach:

1. Avoids CORS (Cross-Origin Resource Sharing) issues that would normally occur when your browser tries to directly access the Cloudflare Tunnel from a different domain
2. Maintains security by proxying requests through your Next.js API routes
3. Works seamlessly in both development and production environments

For more details on how this works and troubleshooting information, see the [Cloudflare Tunnel Setup Guide](docs/CLOUDFLARE-TUNNEL-SETUP.md).
