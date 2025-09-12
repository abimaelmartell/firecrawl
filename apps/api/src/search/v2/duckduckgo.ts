import type { SearchV2Response } from "../../lib/entities";
import { duckduckgo_search } from "../duckduckgo";
import type { Logger } from "winston";

export async function duckduckgo_search_v2(
  query: string,
  opts: { num_results: number },
  logger?: Logger,
): Promise<SearchV2Response> {
  const results = await duckduckgo_search(
    query,
    { num_results: opts.num_results },
    logger,
  );

  if (results.length > 0) {
    return {
      web: results.map(r => ({
        url: r.url,
        title: r.title,
        description: r.description,
      })),
    };
  }

  return {};
}
