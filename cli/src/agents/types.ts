/**
 * Agent type definitions
 */

import type { ToolDefinition, ToolResult } from '../tools/index.js';

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AgentMessage {
  role: MessageRole;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentContext {
  messages: AgentMessage[];
  tools: ToolDefinition[];
  memory?: string;
  cwd?: string;
}

export interface AgentResponse {
  content: string;
  toolCalls: ToolCall[];
  tokensUsed: number;
  shouldContinue: boolean;
}

export interface Agent {
  name: string;
  description: string;
  systemPrompt: string;
  tools: ToolDefinition[];
  canHandle(intent: string): number;
}

// Helper functions
export function createMessage(role: MessageRole, content: string): AgentMessage {
  return { role, content };
}

export function systemMessage(content: string): AgentMessage {
  return createMessage('system', content);
}

export function userMessage(content: string): AgentMessage {
  return createMessage('user', content);
}

export function assistantMessage(content: string): AgentMessage {
  return createMessage('assistant', content);
}

export function toolMessage(content: string): AgentMessage {
  return createMessage('tool', content);
}

export function textResponse(content: string): AgentResponse {
  return {
    content,
    toolCalls: [],
    tokensUsed: 0,
    shouldContinue: false,
  };
}

export function toolCallResponse(content: string, calls: ToolCall[]): AgentResponse {
  return {
    content,
    toolCalls: calls,
    tokensUsed: 0,
    shouldContinue: calls.length > 0,
  };
}
