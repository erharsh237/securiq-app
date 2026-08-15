// Collector interface for collector types
export interface Collector<CollectedData> {
    readonly id: string;
    readonly provider: string;
    collect(ctx: CollectorContext): Promise<CollectorResult<CollectedData>>;
}

// Provider for collector, aws, gcp, github, azure, etc
export type Provider = "aws";

export type CollectorStatus = "ok" | "error";

// Collector's mapped extracted data 
export interface CollectorResult<CollectedData> {
    collector: string;
    provider: Provider;
    status: CollectorStatus;
    count: number;
    items: CollectedData[];
    error?: CollectorError;
    durationMs: number;
}

export interface CollectorError {
    code: "AUTH" | "RATE_LIMIT" | "API" | "SCHEMA" | "UNKNOWN";
    message: string;
    retryAfterSeconds?: number;
}

export interface CollectorContext {
    accountId: string;
    provider: Provider;
    region: string;
}

export type CollectRun = {
    accountId: string;
    context: CollectorContext;
    results: CollectorResult<unknown>[];
};

export interface BaseRawData {
    [key: string]: unknown;
}
