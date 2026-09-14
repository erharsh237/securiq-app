import type {
  BaseRawData,
  Collector,
  CollectorContext,
  CollectorError,
  CollectorResult,
  CollectorStatus,
  Provider,
} from "./types";

// Template Collector class
export abstract class BaseCollector<CollectedData extends BaseRawData> implements Collector<CollectedData> {
  abstract readonly id: string;
  abstract readonly provider: Provider;
  protected abstract fetchRaw(
    context: CollectorContext,
  ): Promise<CollectedData[]>;
  protected abstract classifyError(err: unknown): CollectorError;

  async collect(
    context: CollectorContext,
  ): Promise<CollectorResult<CollectedData>> {
    const startAt = Date.now();
    let status = "ok";
    let items: CollectedData[] = [];
    let error: CollectorError | null = null;

    try {
      items = await this.fetchRaw(context);
    } catch (err) {
      status = "error";
      error = this.classifyError(err);
    }

    return {
      collector: this.id,
      provider: this.provider,
      status: status,
      count: items.length,
      items,
      error: error,
      durationMs: Date.now() - startAt,
    } as CollectorResult<CollectedData>;
  }
}
