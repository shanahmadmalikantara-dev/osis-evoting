import type { Metadata, Viewport } from "next";
import { Caveat, Courier_Prime, Lora, Playfair_Display, Special_Elite } from "next/font/google";
import "./globals.css";

// Detective theme: newspaper headlines, typewriter labels, handwritten notes, book serif body.
const body = Lora({ variable: "--font-body", subsets: ["latin"] });
const headline = Playfair_Display({ variable: "--font-headline", subsets: ["latin"], weight: ["700", "900"] });
const handwriting = Caveat({ variable: "--font-handwriting", subsets: ["latin"], weight: ["500", "700"] });
const label = Courier_Prime({ variable: "--font-label", subsets: ["latin"], weight: ["400", "700"] });
const typewriter = Special_Elite({ variable: "--font-typewriter", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "Pemilu MPK MAN 4 Jakarta",
  description: "Pemungutan suara Ketua & Wakil Ketua MPK MAN 4 Jakarta",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#2b1d12",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${body.variable} ${headline.variable} ${handwriting.variable} ${label.variable} ${typewriter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
