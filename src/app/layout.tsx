import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { SwRegister } from "@/components/SwRegister";

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
