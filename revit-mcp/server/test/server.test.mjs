// End-to-end test of the MCP server over stdio, against a fake add-in speaking the bridge protocol.
import assert from "node:assert/strict";
import net from "node:net";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server.mjs");
const PNG = "iVBORw0KGgo=";

let fake;
let client;
const received = [];

function connectClient(port) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: { ...process.env, REVIT_MCP_PORT: String(port) },
  });
  const c = new Client({ name: "test", version: "1.0.0" });
  return c.connect(transport).then(() => c);
}

before(async () => {
  fake = net.createServer((socket) => {
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk;
      if (!buffer.includes("\n")) return;
      const request = JSON.parse(buffer);
      received.push(request);

      let response;
      if (request.command === "export_view_image") {
        response = { ok: true, result: { view: "Level 1", mime_type: "image/png", data_base64: PNG } };
      } else if (request.params.element_id === 404) {
        response = { ok: false, error: "No element with id 404." };
      } else {
        response = { ok: true, result: { echoed: request.command } };
      }
      socket.end(JSON.stringify(response) + "\n");
    });
  });
  await new Promise((resolve) => fake.listen(0, "127.0.0.1", resolve));
  client = await connectClient(fake.address().port);
});

after(async () => {
  await client.close();
  fake.close();
});

test("lists every tool with read-only hints set correctly", async () => {
  const { tools } = await client.listTools();
  // No fixed count: it went stale every time a tool was added. Check names are unique instead.
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  assert.equal(Object.keys(byName).length, tools.length);
  assert.equal(byName.inspect_link.annotations.readOnlyHint, true);
  assert.ok(byName.link_revit_model && byName.acquire_coordinates);
  assert.equal(byName.query_elements.annotations.readOnlyHint, true);
  assert.equal(byName.delete_elements.annotations.destructiveHint, true);
});

test("forwards the command and arguments to the bridge", async () => {
  const start = { x: 0, y: 0 };
  const end = { x: 5000, y: 0 };
  const result = await client.callTool({ name: "create_wall", arguments: { start, end, level_id: 311 } });
  assert.deepEqual(JSON.parse(result.content[0].text), { echoed: "create_wall" });
  assert.deepEqual(received.at(-1), { command: "create_wall", params: { start, end, level_id: 311 } });
});

test("family tools forward their source, and every tool accepts document", async () => {
  const { tools } = await client.listTools();
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  for (const name of ["family_types", "family_forms", "family_dimensions", "family_type_extents", "family_report"])
    assert.equal(byName[name].annotations.readOnlyHint, true, name);
  assert.equal(byName.set_family_parameters.annotations.readOnlyHint, false);
  assert.ok(byName.list_levels.inputSchema.properties.document, "document param on every tool");

  const args = { path: "C:\\f\\pergola.rfa", expect_sha256: "5a5e1333", match_height_mm: 3500 };
  await client.callTool({ name: "family_type_extents", arguments: args });
  assert.deepEqual(received.at(-1), { command: "family_type_extents", params: args });

  await client.callTool({ name: "list_levels", arguments: { document: "Other model" } });
  assert.deepEqual(received.at(-1), { command: "list_levels", params: { document: "Other model" } });
});

test("surfaces bridge errors as tool errors", async () => {
  const result = await client.callTool({ name: "get_element", arguments: { element_id: 404 } });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /No element with id 404/);
});

test("returns exported views as image content", async () => {
  const result = await client.callTool({ name: "export_view_image", arguments: {} });
  const image = result.content.find((c) => c.type === "image");
  assert.equal(image.data, PNG);
  assert.equal(image.mimeType, "image/png");
});

test("rejects invalid arguments before reaching Revit", async () => {
  const before = received.length;
  const result = await client.callTool({ name: "delete_elements", arguments: { element_ids: [] } }).catch((err) => ({
    isError: true,
    content: [{ text: err.message }],
  }));
  assert.equal(result.isError, true);
  assert.equal(received.length, before);
});

test("explains when Revit is not running", async () => {
  const unused = net.createServer();
  await new Promise((resolve) => unused.listen(0, "127.0.0.1", resolve));
  const port = unused.address().port;
  await new Promise((resolve) => unused.close(resolve));

  const offline = await connectClient(port);
  try {
    const result = await offline.callTool({ name: "list_levels", arguments: {} });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /Start Revit/);
  } finally {
    await offline.close();
  }
});
