import { BaseCollector } from "../config/baseCollector";
import { BaseRawData, CollectorContext, CollectorError, CollectorResult, Provider } from "../config/types";

interface IAMData extends BaseRawData{

}

export class IAMCollector extends BaseCollector<IAMData> {
    protected fetchRaw(context: CollectorContext): Promise<IAMData[]> {
        throw new Error("Method not implemented.");
    }
    protected classifyError(err: unknown): CollectorError {
        throw new Error("Method not implemented.");
    }
    id: string = "iamCollector";
    provider: Provider = "aws" as const;
}