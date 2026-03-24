import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "OmniDesk",
  description: "Your productivity hub",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-dvh max-h-dvh overflow-hidden overscroll-none"
      suppressHydrationWarning
    >
      <body
        className="h-dvh max-h-dvh min-h-0 overflow-hidden overscroll-none antialiased"
        suppressHydrationWarning
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
