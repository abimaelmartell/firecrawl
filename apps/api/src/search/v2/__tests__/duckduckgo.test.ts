import axios from "axios";
import { duckduckgo_search_v2 } from "../v2/duckduckgo";

jest.mock("axios");
const mockedGet = axios.get as jest.Mock;

describe("duckduckgo_search_v2", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("parses Lite HTML results (a.result-link + td.result-snippet)", async () => {
    mockedGet.mockResolvedValueOnce({
      data: `
        <table>
          <tr>
            <td>
              <a class="result-link" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com">Example Title</a>
            </td>
          </tr>
          <tr>
            <td class="result-snippet">Example snippet goes here.</td>
          </tr>
        </table>
      `,
    });

    const res = await duckduckgo_search_v2("test", { numResults: 5 });
    expect(res.web?.length).toBe(1);
    expect(res.web?.[0]).toMatchObject({
      url: "https://example.com",
      title: "Example Title",
      description: expect.stringContaining("snippet"),
    });
  });

  it("returns empty on bot challenge page", async () => {
    mockedGet.mockResolvedValueOnce({
      data: `<body>Unfortunately, bots use DuckDuckGo too. Please complete the following challenge</body>`,
    });

    const res = await duckduckgo_search_v2("test", { numResults: 3 });
    expect(res.web ?? []).toHaveLength(0);
  });
});
