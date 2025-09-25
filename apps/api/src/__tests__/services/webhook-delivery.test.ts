import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { WebhookSender } from "../../services/webhook/delivery";
import { WebhookEvent } from "../../services/webhook/types";
import * as safeFetch from "../../scraper/scrapeURL/engines/utils/safeFetch";

// Minimal mocks - only what's actually needed
jest.mock("undici", () => ({
  fetch: jest.fn(),
}));
jest.mock("../../scraper/scrapeURL/engines/utils/safeFetch", () => ({
  isIPPrivate: jest.fn(),
  getSecureDispatcher: jest.fn().mockReturnValue({}),
}));
jest.mock("../../lib/logger", () => ({
  logger: {
    warn: jest.fn(),
    child: jest.fn().mockReturnValue({ warn: jest.fn() }),
  },
}));
jest.mock("../../services/redis");
jest.mock("../../services/supabase");

const mockSafeFetch = safeFetch as jest.Mocked<typeof safeFetch>;

describe("WebhookSender - Private IP Handling", () => {
  const mockContext = {
    teamId: "test-team",
    jobId: "test-job",
    v0: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock isIPPrivate to return true for 192.168.x.x addresses
    mockSafeFetch.isIPPrivate.mockImplementation((address: string) => {
      return address.startsWith("192.168.");
    });
  });

  afterEach(() => {
    delete process.env.SELF_HOSTED_WEBHOOK_URL;
  });

  it("should block webhook calls to private IPs when not self-hosted", async () => {
    const config = {
      url: "http://192.168.1.1:8080/webhook",
      headers: {},
      metadata: {},
      events: ["completed"] as ("completed" | "failed" | "page" | "started")[],
    };

    const webhookSender = new WebhookSender(config, undefined, mockContext);
    // Explicitly set isSelfHosted to false for testing
    (webhookSender as any).isSelfHosted = false;

    // Mock undici.fetch to track if it's called
    const mockFetch = require("undici").fetch as jest.MockedFunction<any>;
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await webhookSender.send(WebhookEvent.CRAWL_COMPLETED, {
      success: true,
      data: [],
    });

    // Should not call fetch for private IP when not self-hosted
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should allow webhook calls to private IPs when self-hosted", async () => {
    // Set environment variable to indicate self-hosted mode
    process.env.SELF_HOSTED_WEBHOOK_URL = "http://192.168.1.1:8080/webhook";

    const config = {
      url: "http://192.168.1.1:8080/webhook",
      headers: {},
      metadata: {},
      events: ["completed"] as ("completed" | "failed" | "page" | "started")[],
    };

    const webhookSender = new WebhookSender(config, undefined, mockContext);
    // Set the isSelfHosted flag manually for testing
    (webhookSender as any).isSelfHosted = true;

    // Mock undici.fetch to track if it's called
    const mockFetch = require("undici").fetch as jest.MockedFunction<any>;
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await webhookSender.send(WebhookEvent.CRAWL_COMPLETED, {
      success: true,
      data: [],
    });

    // Should call fetch for private IP when self-hosted
    expect(mockFetch).toHaveBeenCalled();
  });
});
