// ABOUTME: Entry point for seedat-ingest: the daily cron starts the NightlyIngest Workflow; the minute cron
// ABOUTME: fetches one One Stop detail page. No public HTTP surface; manual runs use `wrangler workflows trigger`.
import { crawlTick } from "./crawl";
import type { Env } from "./workflow";

export { NightlyIngest } from "./workflow";

export default {
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    if (controller.cron === "* * * * *") {
      console.log(await crawlTick(env, new Date(controller.scheduledTime)));
      return;
    }
    await env.NIGHTLY.create({ id: `nightly-${new Date(controller.scheduledTime).toISOString().slice(0, 10)}`, params: {} });
  },
  async fetch(): Promise<Response> {
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
