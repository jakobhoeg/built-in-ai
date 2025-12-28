import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <HomeLayout className="max-w-screen overflow-x-hidden" {...baseOptions()}>
      {children}
    </HomeLayout>
  );
}
