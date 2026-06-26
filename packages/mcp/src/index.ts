#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getConfig, handleToolCall, TOOL_DEFINITIONS, toolError } from './lib.js';

const server = new Server(
  { name: 'zmailr', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...TOOL_DEFINITIONS],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;

  try {
    return await handleToolCall(request.params.name, args);
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
});

async function main() {
  getConfig();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('zmailr-mcp failed:', error);
  process.exit(1);
});
