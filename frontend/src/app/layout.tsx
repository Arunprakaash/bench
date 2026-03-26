import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bench",
  description: "Testing & evaluation platform for LiveKit voice agents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={geist.className}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
