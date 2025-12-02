"use client";

import { useState } from "react";
import { ConnectForm } from "@/components/mikrotik/connect-form";
import { PPPoEUserList } from "@/components/mikrotik/pppoe-user-list";
import {
  MikrotikCredentials,
  loadCredentials,
  hasStoredCredentials,
  clearCredentials,
} from "@/lib/mikrotik";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function Home() {
  const [credentials, setCredentials] = useState<MikrotikCredentials | null>(null);
  const [initialValues] = useState<Partial<MikrotikCredentials>>(() => {
    if (typeof window !== "undefined" && hasStoredCredentials()) {
      return loadCredentials();
    }
    return {};
  });

  const handleConnect = (creds: MikrotikCredentials) => {
    setCredentials(creds);
  };

  const handleDisconnect = () => {
    setCredentials(null);
    clearCredentials();
  };

  return (
    <main className="container mx-auto px-4 py-6 sm:py-8 lg:py-12 max-w-6xl flex flex-col min-h-screen">
      <div className="flex justify-end mb-4">
        <ThemeToggle />
      </div>
      <header className="mb-6 sm:mb-8 md:mb-10 text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Remote Router Control
        </p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
          MikroTik PPPoE Manager
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
          Securely connect via local network, ZeroTier, or Cloudflare Tunnel and manage your PPPoE
          subscribers with a streamlined, mobile-first interface.
        </p>
      </header>

      <section className="flex-grow">
        {credentials ? (
          <PPPoEUserList credentials={credentials} onDisconnect={handleDisconnect} />
        ) : (
          <div className="max-w-md mx-auto">
            <ConnectForm onConnect={handleConnect} initialValues={initialValues} />
          </div>
        )}
      </section>

      <footer className="mt-10 text-center text-xs sm:text-sm text-muted-foreground py-6 border-t">
        <p>
          Built with Next.js 16, TanStack Query, and shadcn/ui — optimized for on-the-go management.
        </p>
      </footer>
    </main>
  );
}
