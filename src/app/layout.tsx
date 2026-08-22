import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegistration } from "@/components/rezzo/ServiceWorkerRegistration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'REZZO — AI-Powered Resolution Platform | Nigeria',
  description: 'Tell REZZO what you need and get matched with verified Nigerian professionals. From home repairs to business registration — guaranteed quality, transparent pricing, payment protection.',
  keywords: ['REZZO', 'Nigeria', 'professional services', 'AI matching', 'verified professionals', 'home repair', 'AC repair', 'plumbing', 'business registration', 'resolution platform'],
  authors: [{ name: 'REZZO Team' }],
  icons: {
    icon: '/logo.svg',
    apple: '/icons/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'REZZO',
  },
  openGraph: {
    title: 'REZZO — Get Things Done, The Smart Way',
    description: 'Nigeria\'s AI-powered resolution platform. Matched with verified professionals. Payment protection on every case.',
    siteName: 'REZZO',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'REZZO — AI-Powered Resolution Platform',
    description: 'Tell REZZO what you need. Get matched with verified Nigerian professionals.',
  },
};

// themeColor/colorScheme live in a separate `viewport` export as of
// Next.js 14+ — putting them in `metadata` (the pre-14 shape) triggers a
// build warning instead of doing anything.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#102A43',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="top-center" richColors closeButton />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
