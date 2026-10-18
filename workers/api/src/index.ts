// ABOUTME: seedat-api: a stateless MCP server (Streamable HTTP, JSON responses) exposing See Dat's tools at POST /mcp.
// ABOUTME: Implements initialize, ping, tools/list and tools/call; no sessions, no streaming, read-only.
import { TOOLS, ToolError, type Env } from "./tools";

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "seedat", title: "See Dat: New Orleans property and permit records", version: "0.1.0" };
const INSTRUCTIONS = `See Dat joins the City of New Orleans' public property data to parcels: permits (with timelines and inspections),
code enforcement, One Stop reviews (HDLC/VCC), short-term rental licenses, zoning, historic district rules, and block-level
311 and police activity. Start with lookup_address for a specific property, search_permits or find_properties for citywide
questions, and list_values to learn valid filter values. Every answer carries an as_of date and a page_url for people.
Police data is block-level by NOPD's terms: never present it as describing a specific address.`;

interface RpcRequest { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> }

const rpcResult = (id: RpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id: RpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function handle(env: Env, req: RpcRequest): Promise<object | null> {
  if (req.id === undefined) return null;   // notifications (e.g. notifications/initialized) get no response
  switch (req.method) {
    case "initialize": {
      const asked = String(req.params?.protocolVersion ?? "");
      return rpcResult(req.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return rpcResult(req.id, {});
    case "tools/list":
      return rpcResult(req.id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema, annotations: { readOnlyHint: true, openWorldHint: false } })) });
    case "tools/call": {
      const name = String(req.params?.name ?? "");
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) return rpcError(req.id, -32602, `Unknown tool: ${name}`);
      try {
        const out = await tool.run(env, (req.params?.arguments as Record<string, unknown>) ?? {});
        return rpcResult(req.id, { content: [{ type: "text", text: JSON.stringify(out, null, 1) }], structuredContent: out, isError: false });
      } catch (err) {
        if (err instanceof ToolError) return rpcResult(req.id, { content: [{ type: "text", text: err.message }], isError: true });
        console.error(`tool ${name} failed`, err);
        return rpcResult(req.id, { content: [{ type: "text", text: "The tool failed unexpectedly. Try again, or narrow the request." }], isError: true });
      }
    }
    default:
      return rpcError(req.id, -32601, `Method not found: ${req.method}`);
  }
}

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, mcp-protocol-version, mcp-session-id", "access-control-allow-methods": "POST, GET, OPTIONS" };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === "/") {
      return new Response("See Dat MCP server. Connect an MCP client to POST /mcp (Streamable HTTP).\n", { headers: { "content-type": "text/plain", ...CORS } });
    }
    if (url.pathname !== "/mcp") return new Response("Not found", { status: 404, headers: CORS });
    // Stateless server: no server-initiated stream, no sessions to delete.
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST", ...CORS } });

    let body: unknown;
    try { body = await request.json(); } catch { return Response.json(rpcError(null, -32700, "Parse error"), { status: 400, headers: CORS }); }
    const batch = Array.isArray(body);
    const reqs = (batch ? body : [body]) as RpcRequest[];
    if (!reqs.length || reqs.some((r) => !r || r.jsonrpc !== "2.0" || typeof r.method !== "string")) {
      return Response.json(rpcError(null, -32600, "Invalid request"), { status: 400, headers: CORS });
    }
    const out = (await Promise.all(reqs.map((r) => handle(env, r)))).filter((r): r is object => r !== null);
    if (!out.length) return new Response(null, { status: 202, headers: CORS });
    return Response.json(batch ? out : out[0], { headers: CORS });
  },
} satisfies ExportedHandler<Env>;
