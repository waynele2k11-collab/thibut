import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import {
  fontVnDancingScript,
  fontVnCaveat,
  fontJpYujiSyuku,
  fontJpYujiMai,
  fontKrEastSeaDokdo,
  fontKrNanumBrush,
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
  title: "Thi Bút | Words Become Art",
  description: "An AI personalization studio and creator marketplace for culturally inspired typography, calligraphy, artwork, and merchandise.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fontVnDancingScript.variable} ${fontVnCaveat.variable} ${fontJpYujiSyuku.variable} ${fontJpYujiMai.variable} ${fontKrEastSeaDokdo.variable} ${fontKrNanumBrush.variable} ${fontCnMaShanZheng.variable} ${fontCnZhiMangXing.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col selection:bg-secondary/30">
        <Header />
        <div className="flex-1 flex flex-col">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
