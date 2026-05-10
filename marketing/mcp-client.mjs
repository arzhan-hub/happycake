// Minimal JSON-RPC client for the Steppe Business Club hackathon MCP endpoint.
// Used by marketing/run-loop.mjs. Requires Node 18+ (built-in fetch).

const ENDPOINT =
  process.env.SBC_MCP_ENDPOINT ?? "https://www.steppebusinessclub.com/api/mcp";
const TOKEN =
  process.env.SBC_TEAM_TOKEN ?? "sbc_team_284a9863e07da61a606117fd1162eb69";

let nextRpcId = 1;

export async function mcpCall(toolName, args = {}) {
  const id = nextRpcId++;
  const body = {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name: toolName, arguments: args },
  };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "X-Team-Token": TOKEN,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    // SSE-style response — pull the last data: line.
    const dataLines = raw
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    if (!dataLines.length) {
      throw new Error(`Non-JSON MCP response (${res.status}): ${raw.slice(0, 300)}`);
    }
    payload = JSON.parse(dataLines[dataLines.length - 1]);
  }

  if (payload.error) {
    throw new Error(`MCP error ${payload.error.code}: ${payload.error.message}`);
  }

  // Tool results live in result.content[0].text (MCP standard)
  const content = payload.result?.content;
  if (Array.isArray(content) && content[0]?.type === "text") {
    try {
      return JSON.parse(content[0].text);
    } catch {
      return content[0].text;
    }
  }
  return payload.result;
}
