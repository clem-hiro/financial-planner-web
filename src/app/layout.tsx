import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/ui/theme/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BYOFA",
  description:
    "Wealth planner — net worth, cash flow, goals, and thoughtful projections.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

const themeBootScript = `
(() => {
  try {
    const key = "byofa-theme";
    const stored = localStorage.getItem(key);
    const mode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    const resolved = mode === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode;
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.dataset.theme = resolved;
    root.dataset.themeMode = mode;
    root.style.colorScheme = resolved;
  } catch {
    document.documentElement.dataset.themeMode = "system";
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="flex min-h-full flex-col font-sans">
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
