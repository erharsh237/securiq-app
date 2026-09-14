import { runCollectors } from "./collectors/collectors";
import dotenv from "dotenv";
import { promises } from 'fs';
import { getProviders } from "./config/awsClient";

dotenv.config();

const region = process.env.AWS_REGION ?? "us-east-1";

async function main() {
  console.log("Extracting data from AWS");
  const contexts = await getProviders(region);
  const result = await runCollectors(contexts, region);
  console.log(JSON.stringify(result, null, 2));

  // Temp writing to json for storing results 
  try {
    await promises.writeFile("output.json", JSON.stringify(result, null, 2), 'utf-8')
    console.log("File written")
  } catch (err) {
    console.error("Error: ", err)
  }
}

void main();
