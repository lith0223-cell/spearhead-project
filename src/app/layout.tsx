import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { SwRegister } from "@/components/SwRegister";
import { SplashScreen } from "@/components/SplashScreen";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "스피어헤드",
  description: "점진적 과부하 맞춤형 웹앱",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "스피어헤드",
  },
  icons: {
    icon: [
      { url: "/favicon.svg",      type: "image/svg+xml" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
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
    <html lang="ko" className="h-full antialiased" data-mode="dark" data-accent="cyan">
      <head>
        {/* 테마 깜빡임 방지: 첫 페인트 전 localStorage에서 테마 복원 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var a=localStorage.getItem('ph_accent')||'cyan';var m=localStorage.getItem('ph_mode')||'dark';document.documentElement.setAttribute('data-accent',a);document.documentElement.setAttribute('data-mode',m);}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.className} h-dvh flex flex-col overflow-hidden bg-background text-foreground selection:bg-accent selection:text-black`}>
        <ThemeProvider>
          <SplashScreen />
          <SwRegister />
          <div className="flex-1 min-h-0 max-w-md mx-auto w-full relative pt-safe">
            {children}
          </div>
          <BottomNavigation />
        </ThemeProvider>
      </body>
    </html>
  );
}
