import assert from "node:assert/strict";
import JSON5 from "json5";
import { jsonrepair } from "jsonrepair";
import { convertJsonDocument as convert } from "../public/document-json-convert.mjs";

const libs = { json5: JSON5, repair: jsonrepair };
const big = "900719925474099312345";
assert.equal(convert(`[ {"id":${big}}, {"v":"x"} ]`, "json", "jsonl", libs).text, `{"id":${big}}\n{"v":"x"}`);
assert.equal(convert(`{"id":${big}}\n{"v":"x"}\n`, "jsonl", "json", libs).text, `[{"id":${big}},{"v":"x"}]`);
assert.equal(convert(`{/*note*/"id":${big},}`, "jsonc", "json", libs).text, `{"id":${big}}`);
assert.equal(convert(`{id:${big}, name:'demo'}`, "json5", "json", libs).text, `{"id":${big},"name":"demo"}`);
assert.equal(convert("{hex:0x10}", "json5", "json", libs).text, '{"hex":16}');
assert.throws(() => convert("{bad:Infinity}", "json5", "json", libs), /Infinity and NaN/);
assert.throws(() => convert('{"x":1}', "json", "jsonl", libs), /array/);
assert.throws(() => convert('{"x":1}\nnope', "jsonl", "json", libs), /line 2/);
assert.throws(() => convert('{broken', "jsonc", "json", libs), /Invalid JSONC/);
assert.equal(convert("", "jsonl", "json", libs).text, "[]");
console.log("JSON conversion checks passed");
