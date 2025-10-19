import { NextRequest, NextResponse } from "next/server";
import Exa from "exa-js";

export async function POST(req: NextRequest) {
  try {
    console.log("[API /web-search] Received POST request");

    const body = await req.json();
    console.log("[API /web-search] Request body:", body);

    const { query } = body;

    if (!query || typeof query !== "string") {
      console.error("[API /web-search] Invalid query:", query);
      return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }

    console.log("[API /web-search] Query:", query);

    // API key stays on server, never exposed to client
    const apiKey = process.env.EXA_API_KEY;

    if (!apiKey) {
      console.error("[API /web-search] EXA_API_KEY not found in environment");
      return NextResponse.json(
        {
          error:
            "Web search is not configured. Please add EXA_API_KEY to your environment variables.",
        },
        { status: 500 },
      );
    }

    console.log("[API /web-search] Calling Exa API...");
    const exa = new Exa(apiKey);
    const result = await exa.searchAndContents(query, {
      text: true,
      type: "auto",
      numResults: 5,
    });

    console.log("[API /web-search] Exa API result:", {
      resultCount: result.results?.length,
      hasResults: !!result.results,
    });

    // Format results
    const formattedResults = result.results.map((r: any) => ({
      title: r.title,
      url: r.url,
      text: r.text?.substring(0, 500) || "No content available",
    }));

    const response = {
      query,
      results: formattedResults,
    };

    console.log("[API /web-search] Sending response:", {
      query: response.query,
      resultCount: response.results.length,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API /web-search] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Search failed",
      },
      { status: 500 },
    );
  }
}
