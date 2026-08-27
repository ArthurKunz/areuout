import type { Metadata, Viewport } from 'next';
import { siteUrl } from '@/lib/site';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  // Ohne metadataBase kann Next relative Bildpfade in Open-Graph-Angaben nicht zu
  // absoluten Adressen auflösen und warnt bei jedem Build. Der Wert kommt aus der
  // Umgebung, damit hier keine Domain fest verdrahtet ist — siehe lib/site.ts.
  metadataBase: new URL(siteUrl()),
  title: 'areuout',
  description: 'Entdecke und erstelle Partys für Studierende',
  // Der Vorgabetext für alles, was keine eigene Vorschau mitbringt. Die Einladungs-
  // seite überschreibt ihn mit dem Namen der Party.
  openGraph: {
    title: 'areuout',
    description: 'Entdecke und erstelle Partys für Studierende',
    type: 'website',
    locale: 'de_DE',
    siteName: 'areuout',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // The browser's own top/bottom bars take this color — it has to match
  // --color-main (#000) or those bars read as a lighter frame around the app.
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Google Translate and similar tools rewrite attributes on these two elements
    // before React hydrates, which React reports as a hydration mismatch.
    <html lang='de' suppressHydrationWarning>
      {/* bg-main auf dem body, nicht nur auf den Screens: sonst ist die Flaeche zwischen
          erstem Byte und erstem Paint die Standardfarbe des Browsers — also Weiss, bei
          einer durchgehend schwarzen App ein sichtbares Aufblitzen. */}
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans bg-main`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}