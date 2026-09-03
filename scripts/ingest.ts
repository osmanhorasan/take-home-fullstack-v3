import { config } from "dotenv";
config({ path: ".env" });

import { db, sql } from "@/server/db";
import { runIngest } from "@/server/jobs/ingest";

async function main() {
  const result = await runIngest(db);
  console.log(JSON.stringify(result, null, 2));
  if (result.failures.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
