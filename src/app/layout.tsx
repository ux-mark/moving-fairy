import type { Metadata, Viewport } from "next";
import { Source_Sans_3 } from "next/font/google";
import { ToastProvider } from "@thefairies/design-system/components";
import '@thefairies/design-system/styles/tokens.css';
import '@thefairies/design-system/styles/animations.css';
import './moving-fairy-tokens.css';
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Moving Fairy",
  description:
    "Your relocation fairy — helping you decide what to keep, ship, sell, or leave behind.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sourceSans.variable}>
      <body suppressHydrationWarning>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
