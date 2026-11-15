import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileNav } from "@/components/layout/MobileNav";
import { AntiScrapeProtection } from "@/components/security/AntiScrapeProtection";
import {
  fontVnAlexBrush,
  fontVnDancingScript,
  fontVnCaveat,
  fontJpYujiBoku,
  fontJpYujiSyuku,
  fontJpYujiMai,
  fontKrNanumBrush,
  fontKrEastSeaDokdo,
  fontCnLongCang,
  fontCnMaShanZheng,
  fontCnZhiMangXing,
} from "@/fonts";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Thi Bút",
    default: "Thi Bút | Personalized Asian Calligraphy Artwork & Apparel",
  },
  description: "Thi Bút is an online creative studio for transforming names, words, and meaningful phrases into culturally inspired Vietnamese, Japanese, Chinese, and Korean brush-style artwork and personalized products.",
  metadataBase: new URL("https://thibut.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Thi Bút | Personalized Asian Calligraphy",
    description: "Create your name or words in beautiful, authentic Asian brush calligraphy.",
    url: "https://thibut.com",
    siteName: "Thi Bút",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fontVnAlexBrush.variable} ${fontVnDancingScript.variable} ${fontVnCaveat.variable} ${fontJpYujiBoku.variable} ${fontJpYujiSyuku.variable} ${fontJpYujiMai.variable} ${fontKrNanumBrush.variable} ${fontKrEastSeaDokdo.variable} ${fontCnLongCang.variable} ${fontCnMaShanZheng.variable} ${fontCnZhiMangXing.variable} h-full antialiased`}
    >
      <head>
        <link rel="stylesheet" href="https://use.typekit.net/vau3apr.css" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://thibut.com/#organization",
                  "name": "Thi Bút",
                  "url": "https://thibut.com",
                  "logo": "https://thibut.com/logo.png",
                  "description": "An online creative studio for culturally inspired Asian brush-style artwork and personalized products."
                },
                {
                  "@type": "WebSite",
                  "@id": "https://thibut.com/#website",
                  "url": "https://thibut.com",
                  "name": "Thi Bút",
                  "publisher": {
                    "@id": "https://thibut.com/#organization"
                  }
                }
              ]
            })
          }}
        />
      </head>
      <body className="min-h-full flex flex-col selection:bg-secondary/30 pb-16 md:pb-0">
        <AntiScrapeProtection />
        <Header />
        <div className="flex-1 flex flex-col">
          {children}
        </div>
        <Footer />
        <MobileNav />
      </body>
    </html>
  );
}
