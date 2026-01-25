import { GithubInfo } from "fumadocs-ui/components/github-info";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "@browser-ai",
    },
    githubUrl: "https://github.com/jakobhoeg/browser-ai",
    // links: [
    //   {
    //     type: 'custom',
    //     children: (
    //       <GithubInfo owner="jakobhoeg" repo="browser-ai" />
    //     ),
    //   },
    // ],
  };
}
