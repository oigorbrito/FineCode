import { describe, expect, it } from "vitest";
import { transformMessages } from "../src/api/transform-messages.ts";
import type { AssistantMessage, JsonObject, Message, Model } from "../src/types.ts";

describe("transformMessages malformed tool call arguments", () => {
	const dummyModel: Model<"anthropic-messages"> = {
		id: "claude-3-5-sonnet-20241022",
		name: "Claude 3.5 Sonnet",
		provider: "anthropic",
		api: "anthropic-messages",
		baseUrl: "https://api.anthropic.com",
		input: ["text", "image"],
		reasoning: false,
		contextWindow: 200000,
		maxTokens: 8192,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	};

	it('normalizes malformed tool call arguments like {"":""} by stripping empty keys', () => {
		const assistantMsg: AssistantMessage = {
			role: "assistant",
			content: [
				{
					type: "toolCall",
					id: "call_1",
					name: "codemode",
					arguments: { "": "" },
				},
			],
			api: "anthropic-messages",
			provider: "anthropic",
			model: "claude-3-5-sonnet-20241022",
			usage: {
				input: 10,
				output: 20,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 30,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "toolUse",
			timestamp: Date.now(),
		};

		const messages: Message[] = [
			{ role: "user", content: "run script", timestamp: Date.now() },
			assistantMsg,
			{
				role: "toolResult",
				toolCallId: "call_1",
				toolName: "codemode",
				content: [{ type: "text", text: "Validation failed" }],
				isError: true,
				timestamp: Date.now(),
			},
			{ role: "user", content: "continue", timestamp: Date.now() },
		];

		const transformed = transformMessages(messages, dummyModel);
		const transformedAssistant = transformed.find((m) => m.role === "assistant") as AssistantMessage;
		expect(transformedAssistant).toBeDefined();
		const toolCall = transformedAssistant.content.find((b) => b.type === "toolCall");
		expect(toolCall).toBeDefined();
		if (toolCall?.type === "toolCall") {
			expect(toolCall.arguments).toEqual({});
		}
	});

	it("normalizes non-object tool call arguments to empty object", () => {
		const assistantMsg: AssistantMessage = {
			role: "assistant",
			content: [
				{
					type: "toolCall",
					id: "call_2",
					name: "read",
					arguments: null as unknown as JsonObject,
				},
			],
			api: "anthropic-messages",
			provider: "anthropic",
			model: "claude-3-5-sonnet-20241022",
			usage: {
				input: 10,
				output: 20,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 30,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "toolUse",
			timestamp: Date.now(),
		};

		const messages: Message[] = [
			assistantMsg,
			{
				role: "toolResult",
				toolCallId: "call_2",
				toolName: "read",
				content: [{ type: "text", text: "err" }],
				isError: true,
				timestamp: Date.now(),
			},
		];

		const transformed = transformMessages(messages, dummyModel);
		const transformedAssistant = transformed.find((m) => m.role === "assistant") as AssistantMessage;
		const toolCall = transformedAssistant.content.find((b) => b.type === "toolCall");
		if (toolCall?.type === "toolCall") {
			expect(toolCall.arguments).toEqual({});
		}
	});
});
