// ABOUTME: Entry point for seedat-ingest: the daily cron starts the NightlyIngest Workflow.
// ABOUTME: No public HTTP surface; manual runs use `wrangler workflows trigger seedat-nightly`.
import type { Env } from "./workflow";

export { NightlyIngest } from "./workflow";

export default {
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    await env.NIGHTLY.create({ id: `nightly-${new Date(controller.scheduledTime).toISOString().slice(0, 10)}`, params: {} });
  },
  async fetch(): Promise<Response> {
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
