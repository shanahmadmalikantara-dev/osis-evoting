import type { Metadata, Viewport } from "next";
import { Gochi_Hand, Inter, Pixelify_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const body = Inter({ variable: "--font-body", subsets: ["latin"] });
const pixel = Pixelify_Sans({ variable: "--font-pixel", subsets: ["latin"], weight: ["700"] });
const handwriting = Gochi_Hand({ variable: "--font-handwriting", subsets: ["latin"], weight: "400" });
const label = Space_Mono({ variable: "--font-label", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Pemilu OSIS MAN 4 Jakarta",
  description: "Pemungutan suara Ketua & Wakil Ketua OSIS MAN 4 Jakarta",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f4f3ee",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${body.variable} ${pixel.variable} ${handwriting.variable} ${label.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
