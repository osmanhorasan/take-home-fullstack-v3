import type { Metadata } from "next";
import { Header } from "@/components/header";
import { TRPCProvider } from "@/trpc/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clip campaigns",
  description: "Paid clipping campaign take-home",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TRPCProvider>
          <Header />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </TRPCProvider>
      </body>
    </html>
  );
}
