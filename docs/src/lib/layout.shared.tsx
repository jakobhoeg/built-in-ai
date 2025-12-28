import { GithubInfo } from "fumadocs-ui/components/github-info";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "@built-in-ai",
    },
    githubUrl: "https://github.com/jakobhoeg/built-in-ai",
    // links: [
    //   {
    //     type: 'custom',
    //     children: (
    //       <GithubInfo owner="jakobhoeg" repo="built-in-ai" />
    //     ),
    //   },
    // ],
  };
}
