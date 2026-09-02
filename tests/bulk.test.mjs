/**
 * Live test for bulk monitoring tools: list_bulk_jobs, get_bulk_job_items,
 * get_bulk_webhook_logs against the real Data Service API.
 * Run: node tests/bulk.test.mjs
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const KEY = process.env.EASYPARSER_API_KEY ?? process.env.api_key;
if (!KEY) {
  console.error("Set EASYPARSER_API_KEY (or api_key) to run bulk tests.");
  process.exit(1);
}

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  env: { ...process.env, EASYPARSER_API_KEY: KEY },
});
const client = new Client({ name: "easyparser-bulk-test", version: "0.1.0" });

let failures = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`PASS  ${name}`);
  else {
    console.log(`FAIL  ${name} ${extra}`);
    failures++;
  }
};
const parse = (r) => JSON.parse(r.content[0].text);

try {
  await client.connect(transport);

  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  check("15 tools registered", tools.length === 15, `got ${tools.length}`);
  for (const t of ["list_bulk_jobs", "get_bulk_job_items", "get_bulk_webhook_logs"]) {
    check(`tool present: ${t}`, names.includes(t));
  }

  // list_bulk_jobs
  const jobs = await client.callTool({
    name: "list_bulk_jobs",
    arguments: { page: 1, limit: 5 },
  });
  const jobsData = parse(jobs);
  check(
    "list_bulk_jobs returns jobs",
    jobs.isError !== true && jobsData.success === true && Array.isArray(jobsData.data),
    jobs.isError ? jobs.content[0].text.slice(0, 150) : "",
  );
  const firstJob = jobsData.data?.[0];
  check(
    "job row has expected fields",
    !!firstJob?.bulk_request_id && !!firstJob?.group_id && !!firstJob?.status,
  );
  console.log(`      total jobs: ${jobsData.meta_data?.total}, first: ${firstJob?.operation} ${firstJob?.status} (${firstJob?.completed_items}/${firstJob?.total_items})`);

  // status filter
  const filtered = await client.callTool({
    name: "list_bulk_jobs",
    arguments: { page: 1, limit: 5, status: "completed" },
  });
  const filteredData = parse(filtered);
  check(
    "status filter works",
    filteredData.data?.every((j) => j.status === "completed") ?? false,
  );

  // get_bulk_job_items
  if (firstJob?.group_id) {
    const items = await client.callTool({
      name: "get_bulk_job_items",
      arguments: { group_id: firstJob.group_id, page: 1, limit: 3 },
    });
    const itemsData = parse(items);
    check(
      "get_bulk_job_items returns items",
      items.isError !== true && itemsData.success === true && Array.isArray(itemsData.data),
      items.isError ? items.content[0].text.slice(0, 150) : "",
    );
    const firstItem = itemsData.data?.[0];
    check(
      "item row has expected fields",
      !!firstItem?.item_id && !!firstItem?.status && !!firstItem?.value,
    );
    console.log(`      job items total: ${itemsData.meta_data?.total}, first item: ${firstItem?.value} → ${firstItem?.status}`);

    // item status filter
    const failedItems = await client.callTool({
      name: "get_bulk_job_items",
      arguments: { group_id: firstJob.group_id, status: "failed", page: 1, limit: 3 },
    });
    const failedData = parse(failedItems);
    check(
      "item status filter works",
      failedData.success === true && (failedData.data ?? []).every((i) => i.status === "failed"),
    );
  }

  // get_bulk_webhook_logs (may be empty — structure check only)
  const logs = await client.callTool({
    name: "get_bulk_webhook_logs",
    arguments: { page: 1, limit: 5 },
  });
  const logsData = parse(logs);
  check(
    "get_bulk_webhook_logs responds",
    logs.isError !== true && logsData.success === true && Array.isArray(logsData.data),
    logs.isError ? logs.content[0].text.slice(0, 150) : "",
  );
  console.log(`      webhook logs total: ${logsData.meta_data?.total ?? 0}`);
} catch (err) {
  console.error("FATAL", err);
  failures++;
} finally {
  await client.close();
}

console.log(failures === 0 ? "\nALL BULK TESTS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
