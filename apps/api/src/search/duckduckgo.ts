import axios from "axios";
import { JSDOM } from "jsdom";
import type { Logger } from "winston";
import { SearchResult } from "../lib/entities";

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

function extractRealUrlFromDuckHref(href: string): string | null {
  try {
    const abs = href.startsWith("http") ? href : `https:${href}`;
    const u = new URL(abs);
    const uddg = u.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : null;
  } catch {
    return null;
  }
}

function parseDuckHtmlToResults(
  html: string,
  limit: number,
  logger?: Logger,
): SearchResult[] {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const bodyText = (doc.body?.textContent || "").toLowerCase();
  if (
    bodyText.includes("bots use duckduckgo too") ||
    bodyText.includes("please complete the following challenge")
  ) {
    logger?.warn("DuckDuckGo HTML returned a bot challenge page");
    return [];
  }
  const anchors = Array.from(
    doc.querySelectorAll("a.result-link, a.result__a"),
  ) as HTMLAnchorElement[];
  const out: SearchResult[] = [];
  for (const a of anchors) {
    const href = a.getAttribute("href") || "";
    const url = extractRealUrlFromDuckHref(href);
    const title = (a.textContent || "").trim();
    let description = "";
    const tr = a.closest("tr");
    if (tr) {
      const nextTr = tr ? (tr.nextElementSibling as HTMLElement | null) : null;
      const snippetTd = nextTr?.querySelector("td.result-snippet");
      if (snippetTd) description = (snippetTd.textContent || "").trim();
    } else {
      const container =
        (a as HTMLElement).closest(".result") ||
        (a.parentElement?.closest(".results") as HTMLElement | null) ||
        a.parentElement ||
        undefined;
      const snippetDiv = container?.querySelector(".result__snippet");
      if (snippetDiv) description = (snippetDiv.textContent || "").trim();
    }
    if (url && title) {
      out.push(new SearchResult(url, title, description));
      if (out.length >= limit) break;
    }
  }
  return out;
}

export async function duckduckgo_search(
  query: string,
  opts: { num_results: number },
  logger?: Logger,
): Promise<SearchResult[]> {
  try {
    const resp = await axios.get<string>("https://html.duckduckgo.com/html/", {
      params: { q: query },
      timeout: 8000,
      responseType: "text",
      headers: { Accept: "text/html", "User-Agent": getUserAgent() },
    });
    return parseDuckHtmlToResults(
      resp.data,
      Math.max(1, opts.num_results),
      logger,
    );
  } catch (error) {
    if (logger) logger.warn("DuckDuckGo (lite) search failed", { error });
    return [];
  }
}
