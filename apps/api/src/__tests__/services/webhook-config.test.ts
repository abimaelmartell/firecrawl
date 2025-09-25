import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { getWebhookConfig } from "../../services/webhook/config";

// Mock dependencies
jest.mock("../../services/supabase");

describe("Webhook Config", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.SELF_HOSTED_WEBHOOK_URL;
    delete process.env.SELF_HOSTED_WEBHOOK_HMAC_SECRET;
    delete process.env.USE_DB_AUTHENTICATION;
  });

  describe("Self-hosted detection", () => {
    it("should detect self-hosted mode when SELF_HOSTED_WEBHOOK_URL is set", async () => {
      process.env.SELF_HOSTED_WEBHOOK_URL =
        "http://192.168.1.1:8080/webhook/{{JOB_ID}}";
      process.env.SELF_HOSTED_WEBHOOK_HMAC_SECRET = "test-secret";

      const result = await getWebhookConfig("test-team", "test-job-id");

      expect(result).not.toBeNull();
      expect(result?.isSelfHosted).toBe(true);
      expect(result?.config.url).toBe(
        "http://192.168.1.1:8080/webhook/test-job-id",
      );
      expect(result?.secret).toBe("test-secret");
    });

    it("should not be in self-hosted mode when SELF_HOSTED_WEBHOOK_URL is not set", async () => {
      delete process.env.SELF_HOSTED_WEBHOOK_URL;

      const result = await getWebhookConfig("test-team", "test-job-id");

      expect(result).toBeNull();
    });

    it("should handle job ID replacement in self-hosted webhook URL", async () => {
      const jobId = "test-job-123";
      process.env.SELF_HOSTED_WEBHOOK_URL = `http://worker:3500/v1.0/publish/pubsub/firecrawl/{{JOB_ID}}`;

      const result = await getWebhookConfig("test-team", jobId);

      expect(result).not.toBeNull();
      expect(result?.isSelfHosted).toBe(true);
      expect(result?.config.url).toBe(
        `http://worker:3500/v1.0/publish/pubsub/firecrawl/${jobId}`,
      );
    });

    it("should set default events for self-hosted webhook", async () => {
      process.env.SELF_HOSTED_WEBHOOK_URL = "http://192.168.1.1:8080/webhook";

      const result = await getWebhookConfig("test-team", "test-job-id");

      expect(result).not.toBeNull();
      expect(result?.config.events).toEqual([
        "completed",
        "failed",
        "page",
        "started",
      ]);
      expect(result?.config.headers).toEqual({});
      expect(result?.config.metadata).toEqual({});
    });

    it("should not set isSelfHosted flag for explicit webhook config", async () => {
      const explicitWebhook = {
        url: "http://192.168.1.1:8080/webhook",
        headers: {},
        metadata: {},
        events: ["completed"] as (
          | "completed"
          | "failed"
          | "page"
          | "started"
        )[],
      };

      const result = await getWebhookConfig(
        "test-team",
        "test-job-id",
        explicitWebhook,
      );

      expect(result).not.toBeNull();
      expect(result?.isSelfHosted).toBeUndefined();
      expect(result?.config.url).toBe("http://192.168.1.1:8080/webhook");
    });

    it("should handle missing SELF_HOSTED_WEBHOOK_HMAC_SECRET", async () => {
      process.env.SELF_HOSTED_WEBHOOK_URL = "http://192.168.1.1:8080/webhook";
      delete process.env.SELF_HOSTED_WEBHOOK_HMAC_SECRET;

      const result = await getWebhookConfig("test-team", "test-job-id");

      expect(result).not.toBeNull();
      expect(result?.isSelfHosted).toBe(true);
      expect(result?.secret).toBeUndefined();
    });
  });

  describe("Environment variable handling", () => {
    it("should work with Docker container hostnames", async () => {
      process.env.SELF_HOSTED_WEBHOOK_URL =
        "http://worker:3500/v1.0/publish/pubsub/firecrawl";

      const result = await getWebhookConfig("test-team", "test-job-id");

      expect(result).not.toBeNull();
      expect(result?.isSelfHosted).toBe(true);
      expect(result?.config.url).toBe(
        "http://worker:3500/v1.0/publish/pubsub/firecrawl",
      );
    });

    it("should work with localhost addresses", async () => {
      process.env.SELF_HOSTED_WEBHOOK_URL = "http://localhost:8080/webhook";

      const result = await getWebhookConfig("test-team", "test-job-id");

      expect(result).not.toBeNull();
      expect(result?.isSelfHosted).toBe(true);
      expect(result?.config.url).toBe("http://localhost:8080/webhook");
    });

    it("should work with 127.0.0.1 addresses", async () => {
      process.env.SELF_HOSTED_WEBHOOK_URL = "http://127.0.0.1:8080/webhook";

      const result = await getWebhookConfig("test-team", "test-job-id");

      expect(result).not.toBeNull();
      expect(result?.isSelfHosted).toBe(true);
      expect(result?.config.url).toBe("http://127.0.0.1:8080/webhook");
    });
  });
});
