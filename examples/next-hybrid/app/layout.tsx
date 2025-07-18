import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/ui/mode-toggle";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata = {
  title: "AI SDK - built-in-ai model example",
  description: "Example of using the AI SDK with Next.js and built-in-ai.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <html lang="en" suppressHydrationWarning>
        <head />
        <body>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster position="top-center" />
          </ThemeProvider>
        </body>
      </html>
    </>
  );
}
