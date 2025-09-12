import axios from "axios";
import { JSDOM } from "jsdom";
import type { Logger } from "winston";
import type { SearchV2Response, WebSearchResult } from "../../lib/entities";

function buildRegionLangParam(
  lang?: string,
  country?: string,
): string | undefined {
  const normalizedLang = (lang || "en").toLowerCase();
  const normalizedCountry = (country || "us").toLowerCase();
  return `${normalizedCountry}-${normalizedLang}`;
}

const getRandomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// based on the code from googlesearch.ts
function getUserAgent(): string {
  const lynx_version = `Lynx/${getRandomInt(2, 3)}.${getRandomInt(8, 9)}.${getRandomInt(0, 2)}`;
  const libwww_version = `libwww-FM/${getRandomInt(2, 3)}.${getRandomInt(13, 15)}`;
  const ssl_mm_version = `SSL-MM/${getRandomInt(1, 2)}.${getRandomInt(3, 5)}`;
  const openssl_version = `OpenSSL/${getRandomInt(1, 3)}.${getRandomInt(0, 4)}.${getRandomInt(0, 9)}`;
  return `${lynx_version} ${libwww_version} ${ssl_mm_version} ${openssl_version}`;
}

function resolveDuckRedirectUrl(href: string): string | null {
  // DuckDuckGo result links often point to /l/?uddg=<encodedTarget>
  try {
    const absoluteHref = href.startsWith("http") ? href : `https:${href}`;
    const url = new URL(absoluteHref);
    const target = url.searchParams.get("uddg");
    return target ? decodeURIComponent(target) : null;
  } catch {
    return null;
  }
}

function isBotChallenge(htmlDocument: Document): boolean {
  const text = (htmlDocument.body?.textContent || "").toLowerCase();
  return (
    text.includes("bots use duckduckgo too") ||
    text.includes("please complete the following challenge")
  );
}

function findSnippetForAnchor(anchor: Element): string {
  // Lite layout: snippet is the next <tr> with td.result-snippet
  const tr = anchor.closest("tr");
  if (tr) {
    const nextTr = tr.nextElementSibling as HTMLElement | null;
    const snippetCell = nextTr?.querySelector("td.result-snippet");
    return (snippetCell?.textContent || "").trim();
  }

  // HTML layout: snippet under .result > .result__snippet
  const container =
    (anchor as HTMLElement).closest(".result") ||
    (anchor.parentElement?.closest(".results") as HTMLElement | null) ||
    anchor.parentElement ||
    undefined;
  const snippetDiv = container?.querySelector(".result__snippet");
  return (snippetDiv?.textContent || "").trim();
}

function parseDuckHtml(
  html: string,
  limit: number,
  logger?: Logger,
): WebSearchResult[] {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  if (isBotChallenge(document)) {
    logger?.warn("DuckDuckGo HTML returned a bot challenge page");
    return [];
  }

  // Support both Lite (a.result-link) and HTML (a.result__a) layouts
  const anchors = Array.from(
    document.querySelectorAll("a.result-link, a.result__a"),
  ) as HTMLAnchorElement[];

  const results: WebSearchResult[] = [];
  for (const anchor of anchors) {
    const href = anchor.getAttribute("href") || "";
    const resolvedUrl = resolveDuckRedirectUrl(href);
    const title = (anchor.textContent || "").trim();
    const description = findSnippetForAnchor(anchor);

    if (resolvedUrl && title) {
      results.push({ url: resolvedUrl, title, description });
      if (results.length >= limit) break;
    }
  }
  return results;
}

export async function duckduckgo_search_v2(
  query: string,
  opts: { numResults: number; lang?: string; country?: string },
  logger?: Logger,
): Promise<SearchV2Response> {
  try {
    const params: Record<string, string> = { q: query };
    const kl = buildRegionLangParam(opts.lang, opts.country);
    if (kl) params.kl = kl;

    const response = await axios.get<string>(
      "https://html.duckduckgo.com/html/",
      {
        params,
        timeout: 8000,
        responseType: "text",
        headers: { Accept: "text/html", "User-Agent": getUserAgent() },
      },
    );

    const web = parseDuckHtml(
      response.data,
      Math.max(1, opts.numResults),
      logger,
    );
    return web.length > 0 ? { web } : {};
  } catch (error) {
    logger?.warn("DuckDuckGo (html) search failed", { error });
    return {};
  }
}
