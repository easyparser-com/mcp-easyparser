import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { TOOL_DEFINITIONS } = await import("../dist/tools/definitions.js");
const { LIST_OPERATIONS_DESCRIPTION, CHECK_CREDITS_DESCRIPTION, OPERATIONS_CATALOG } = await import("../dist/tools/helpers.js");
const { LIST_BULK_JOBS_DESCRIPTION, GET_BULK_JOB_ITEMS_DESCRIPTION, GET_BULK_ITEM_RESULT_DESCRIPTION, GET_BULK_WEBHOOK_LOGS_DESCRIPTION } = await import("../dist/tools/bulk.js");

const out = [];
for (const t of TOOL_DEFINITIONS) {
  out.push(`### ${t.name}\n${t.description}\n`);
}
out.push(`### list_operations\n${LIST_OPERATIONS_DESCRIPTION}\n`);
out.push(`### check_credits\n${CHECK_CREDITS_DESCRIPTION}\n`);
out.push(`### list_bulk_jobs\n${LIST_BULK_JOBS_DESCRIPTION}\n`);
out.push(`### get_bulk_job_items\n${GET_BULK_JOB_ITEMS_DESCRIPTION}\n`);
out.push(`### get_bulk_item_result\n${GET_BULK_ITEM_RESULT_DESCRIPTION}\n`);
out.push(`### get_bulk_webhook_logs\n${GET_BULK_WEBHOOK_LOGS_DESCRIPTION}\n`);
console.log(out.join("\n---\n\n"));
