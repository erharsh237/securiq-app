import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import type { STSClientConfig } from "@aws-sdk/client-sts";
import dotenv from "dotenv";
import { CollectorContext } from "./types";

dotenv.config();

export function awsClientConfig<TClientConfig>(region: string): TClientConfig {
  const key = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_IAM_ROLE_SECRET;

  return {
    region: region,
    ...(key && secret
      ? { credentials: { accessKeyId: key, secretAccessKey: secret } }
      : {}),
  } as TClientConfig;
}

export async function resolveAwsAccountId(region: string): Promise<string> {
  try {
    const sts = new STSClient(awsClientConfig<STSClientConfig>(region));
    const identity = await sts.send(new GetCallerIdentityCommand({}));
    return identity.Account ?? "unknown";
  } catch (err) {
    const errorMessage = (err as Error).message;
    console.warn(`[bootstrap] sts:GetCallerIdentity failed (${errorMessage})`);
    throw new Error(`AWS Client not initialised. Error: ${errorMessage}`);
  }
}

export async function getProviders(awsRegion: string = "us-east-1"): Promise<CollectorContext[]> {
  const awsAccountId = await resolveAwsAccountId(awsRegion);
  const context: CollectorContext[] = [
    { accountId: awsAccountId, provider: "aws", region: awsRegion },
  ];
  return context;
}