import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-barlow",
});

const barlowCond = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-barlow-cond",
});

export const metadata: Metadata = {
  title: "easyATC",
  description: "Seguimiento en vivo de un ejercicio de control aéreo",
};

export const viewport: Viewport = {
  themeColor: "#0b0b0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${barlow.variable} ${barlowCond.variable}`}>
      <body className="min-h-dvh bg-zinc-950 font-sans text-[13px] leading-[1.35] text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
