import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AntiScrapeProtection } from "@/components/security/AntiScrapeProtection";
import {
  fontInter,
  fontPlayfair,
  fontNotoSansJp,
  fontNotoSerifJp,
} from "@/fonts/index";

export const metadata: Metadata = {
  title: {
    template: "%s | Thi Bút",
    default: "Thi Bút | Personalized Asian Calligraphy Artwork & Apparel",
  },
  description:
    "Thi Bút is an online creative studio for transforming names, words, and meaningful phrases into culturally inspired Vietnamese, Japanese, Chinese, and Korean brush-style artwork and personalized products.",
  metadataBase: new URL("https://thibut.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Thi Bút | Personalized Asian Calligraphy",
    description:
      "Create your name or words in beautiful, authentic Asian brush calligraphy.",
    url: "https://thibut.com",
    siteName: "Thi Bút",
    locale: "en_US",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      className={`${fontInter.variable} ${fontPlayfair.variable} ${fontNotoSansJp.variable} ${fontNotoSerifJp.variable} h-full antialiased`}
    >
      <head>
        <script
          nonce={nonce}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://thibut.com/#organization",
                  name: "Thi Bút",
                  url: "https://thibut.com",
                  logo: "https://thibut.com/logo.png",
                  description:
                    "An online creative studio for culturally inspired Asian brush-style artwork and personalized products.",
                },
                {
                  "@type": "WebSite",
                  "@id": "https://thibut.com/#website",
                  url: "https://thibut.com",
                  name: "Thi Bút",
                  publisher: {
                    "@id": "https://thibut.com/#organization",
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col selection:bg-secondary/30">
        <AntiScrapeProtection />
        <Header />
        <div className="flex-1 flex flex-col">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
