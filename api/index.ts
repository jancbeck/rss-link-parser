import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function (req: VercelRequest, res: VercelResponse) {
  try {
    const params = new URL(req.url || "/", "http://localhost").searchParams;
    // Get parameters from query
    const targetUrl = params.get("url");
    const proxyUrl = params.get("proxyUrl") ?? "";

    if (!targetUrl) {
      res.writeHead(400);
      res.end("Missing URL parameter");
      return;
    }

    // Fetch the target URL
    const response = await fetch(targetUrl);
    const text = await response.text();

    // Extract URLs using regex
    const urlRegex = /https?:\/\/[^\s<>"']+/g;
    const urls = [...new Set(text.match(urlRegex) || [])];

    // Extract title from existing RSS if available
    const feedMatch = text.match(
      /<channel>\s*<title>([^<]+)<\/title>\s*<link>([^<]+)<\/link>\s*<description>([^<]+)<\/description>/
    );

    const title = feedMatch?.[1] ?? `Links from ${targetUrl}`;
    const originalUrl = feedMatch?.[2] ?? targetUrl;
    const description = feedMatch?.[3] ?? `Links extracted from ${targetUrl}`;

    // Generate RSS feed
    // Function to fetch title from URL
    async function fetchTitleFromUrl(url: string) {
      const obj = {
        url,
        title: url,
        guid: url,
      };
      try {
        let response: Response | null = null;
        const proxiedUrl = `${proxyUrl}${url}`;

        if (proxyUrl !== "") {
          obj.url = proxiedUrl;
        }
        response = await fetch(url);
        if (response.ok) {
          const text = await response.text();
          const titleRegex = /<title[^>]*>([^<]+)<\/title>/i;
          const titleMatch = titleRegex.exec(text);
          obj.title = titleMatch?.[1] ?? url;
        }
        return obj;
      } catch {
        return obj;
      }
    }

    // Fetch titles for all URLs
    const urlsWithTitles = await Promise.all(
      urls
        .filter((url) => !url.includes(originalUrl))
        .map(async (url) => await fetchTitleFromUrl(url))
        .filter(Boolean)
    );

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
    <channel>
      <title>${title}</title>
      <description>${description}</description>
      <link>${originalUrl}</link>
      ${urlsWithTitles
        .map(
          ({ url, title, guid }) => `
      <item>
      <title>${title}</title>
      <link>${url}</link>
      <guid>${guid}</guid>
      </item>`
        )
        .join("")}
    </channel>
    </rss>`;

    // Send response
    res.writeHead(200, {
      "Content-Type": "application/rss+xml",
      "Cache-Control": "max-age=3600",
    });
    res.end(rss);
  } catch (error) {
    res.writeHead(500);
    res.end(`Error: ${(error as Error).message}`);
  }
}
