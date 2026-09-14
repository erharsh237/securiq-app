import {
  Collector,
  CollectorContext,
  CollectRun,
  Provider,
  CollectorResult,
} from "../config/types";
import { EC2Collector } from "./ec2Collector";
import { IAMCollector } from "./iamCollector";
import { resolveAwsAccountId } from "../config/awsClient";

export function initializeCollectors(region: string): Collector<unknown>[] {
  return [
    new EC2Collector(region)
];
}

export async function runCollectors(
  contexts: CollectorContext[],
  region: string = "us-east-1",
): Promise<CollectRun[]> {
  const runs: CollectRun[] = [];
  const collectors = initializeCollectors(region);

  for (const context of contexts) {
    const currCollector = collectors.filter(
      (collector) => collector.provider === context.provider,
    );
    const result = await Promise.all(
      currCollector.map(async (collector) => {
        try {
          return collector.collect(context);
        } catch (err) {
          return {
            collector: collector.id,
            provider: collector.provider,
            status: "error",
            count: 0,
            items: [],
            error: { code: "UNKNOWN", message: String(err) },
            durationMs: 0,
          } as CollectorResult<unknown>;
        }
      }),
    );

    runs.push({
      accountId: context.accountId,
      context: context,
      results: result,
    } as CollectRun);
  }

  return runs;
}
