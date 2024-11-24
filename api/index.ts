import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function (req: VercelRequest, res: VercelResponse) {
  try {
    const params = new URL(req.url || "/", "http://localhost").searchParams;
    // Get parameters from query
    const targetUrl = params.get("url");

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
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>${title}</title>
      <description>${description}</description>
      <link>${originalUrl}</link>
      ${urls
        .filter((url) => !url.includes(originalUrl))
        .map(
          (url) => `
      <item>
        <title>${url}</title>
        <link>${url}</link>
        <guid>${url}</guid>
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