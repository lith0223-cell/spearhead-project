import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomNavigation } from "@/components/layout/BottomNavigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "프로젝트 헬스",
  description: "점진적 과부하 맞춤형 웹앱",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "프로젝트 헬스",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1115",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased dark">
      <body className={`${inter.className} min-h-full flex flex-col bg-background text-foreground selection:bg-accent selection:text-black`}>
        <div className="flex-1 max-w-md mx-auto w-full relative pb-16 pt-safe">
          {children}
        </div>
        <BottomNavigation />
      </body>
    </html>
  );
}
