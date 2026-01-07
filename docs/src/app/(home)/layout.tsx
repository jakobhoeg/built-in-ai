import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Built-in AI Provider",
  description:
    "Build local, in-browser AI applications with better DX. AI SDK model providers providing built-in state management, tool calling, structured output, streaming and more.",
  keywords: [
    "AI SDK",
    "Vercel AI",
    "Built-in AI",
    "browser AI",
    "local AI",
    "Chrome AI",
    "WebLLM",
    "Transformers.js",
    "language model",
    "machine learning",
  ],
  authors: [{ name: "Jakob Hoeg", url: "https://jakobhoeg.dev" }],
  creator: "Jakob Hoeg",
  metadataBase: new URL("https://built-in-ai.dev"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://built-in-ai.dev",
    title: "Built-in AI Provider",
    description: "Build local, in-browser AI applications with better DX.",
    siteName: "Built-in AI",
    images: [
      {
        url: "/opengraph-image.jpeg",
        width: 1280,
        height: 720,
        alt: "Built-in AI Provider",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Built-in AI Provider",
    description: "Build local, in-browser AI applications with better DX.",
    creator: "@hoeg_jakob",
    images: ["/opengraph-image.jpeg"],
  },
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <HomeLayout className="max-w-screen overflow-x-hidden" {...baseOptions()}>
      {children}
    </HomeLayout>
  );
}
