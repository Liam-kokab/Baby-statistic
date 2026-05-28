# MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) server that exposes the Baby Statistic REST API as tools for AI agents. Uses **SSE** (Server-Sent Events) transport.

## Stack
- **Runtime**: Node.js 22
- **Framework**: Express 5 (for SSE transport)
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **Schema**: Zod (converted to JSON Schema for tool definitions)

## File Structure
```
mcp-server/
  src/
    index.ts            # SSE server entry point (port 3001)
    apiClient.ts        # HTTP helper — calls the Express API
    types.ts            # ToolDefinition type
    utils.ts            # jsonResponse helper
    descriptions.json   # All tool descriptions (single source of truth)
    tools/
      index.ts          # Aggregates all tool modules
      time.ts           # get_current_time
      drankMilk.ts      # Drank milk tools
      sleep.ts          # Sleep tools (start/end)
      pee.ts            # Pee event tools
      poop.ts           # Poop event tools
      medicine.ts       # Medicine dose logging
      pumping.ts        # Pumping tools
      backup.ts         # Full data dump for analysis
```

## Running

```bash
npm run dev:mcp                # dev with auto-reload (port 3001)
npm run start -w mcp-server    # production (requires build first)
npm run build -w mcp-server    # compile TypeScript
```

In production (Docker), the MCP server is started automatically by `index.js` in SSE-only mode.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BABY_API_URL` | `http://localhost:3000` | Base URL of the Express API server |
| `MCP_PORT` | `3001` | Port for the MCP SSE server |
| `MCP_MODE` | (unset, falls back to argv or `'both'`) | `sse`, `stdio`, or `both` |

## Transport (SSE)

- `GET /sse` — establishes an SSE connection (one client at a time)
- `POST /messages` — sends JSON-RPC messages to the server

## Connecting from MCP Clients

Configure your MCP client (Claude Desktop, Cursor, etc.) with:

```json
{
  "mcpServers": {
    "baby-statistic": {
      "url": "http://localhost:3001/sse"
    }
  }
}
```

## Descriptions

All tool descriptions are stored in `src/descriptions.json` as a flat key-value map (`tool_name` → `description text`). Each tool module imports from this file. To update a description, edit the JSON file — no code changes needed.

## Available Tools

### Time
| Tool | Description |
|---|---|
| `get_current_time` | Returns current time (Europe/Oslo timezone) |

### Drank Milk
| Tool | Description |
|---|---|
| `get_drank_milk` | List drank milk records (optional date filter) |
| `create_drank_milk` | Record baby drank milk (source: FRIDGE/FREEZER default FRIDGE, or BOOB) |
| `log_milk_waste` | Subtract wasted milk from latest record (FRIDGE/FREEZER) |
| `get_current_prediction` | Get server-side suggested next bottle amount (`/api/drank-milk/suggested`) |
| `get_prediction_logs` | List stored prediction logs (returns only linked predictions). The MCP tool validates the response using Zod, and enriches each prediction with `actualAmount` (predicted vs actual) by fetching linked `drank_milk` rows in a single call. The enrichment avoids per-prediction API calls and returns a compact `[{ id, predictedAmount, actualId, createdAt, actualAmount, ...debug }]` array suitable for downstream agents. |

### Sleep
| Tool | Description |
|---|---|
| `get_sleep` | List sleep records |
| `get_latest_sleep` | Check if baby is currently sleeping |
| `start_sleep` | Record baby fell asleep (start = now) |
| `end_sleep` | Record baby woke up (ends latest open sleep) |

### Pee & Poop
| Tool | Description |
|---|---|
| `get_pee` / `get_poop` | List diaper events |
| `log_pee` / `log_poop` | Log diaper events |

### Medicine
| Tool | Description |
|---|---|
| `get_medicines` | List active medicines (discover IDs here) |
| `log_medicine_dose` | Record a dose was given |

### Pumping
| Tool | Description |
|---|---|
| `get_pumping` | List pumping entries |
| `get_latest_pumping` | Get most recent pumping |
| `log_pumping` | Log a pumping event |

### Backup / Analysis
| Tool | Description |
|---|---|
| `get_all_data` | Full dump of all tables for broad analysis |

