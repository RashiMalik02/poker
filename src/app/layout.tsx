import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const display = Poppins({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "♠ Royal — Online Poker",
  description: "No-Limit Texas Hold'em with your friends",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <body className="font-display min-h-screen">{children}</body>
    </html>
  );
}
