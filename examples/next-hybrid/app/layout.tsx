import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata = {
  title: "AI SDK - browser-ai model example",
  description: "Example of using the AI SDK with Next.js and browser-ai.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <html lang="en" suppressHydrationWarning>
        <body>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster position="top-center" style={{ zIndex: 9999 }} />
          </ThemeProvider>
        </body>
      </html>
    </>
  );
}
