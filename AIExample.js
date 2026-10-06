import { Ollama } from "ollama";
import { readFileSync } from "node:fs";


import getStats, {
    executeGetStats
} from "./Skills/stats.js";

import executors from "./Skills/executors.js";

const tools = [getStats];

const ollama = new Ollama({
    host: "http://127.0.0.1:11434"
});

const KNOWN_FILE = "/Users/rolf/Documents/semester/semester1/block2/Naamloos/Furture-factory/future factory.fsx";

const messages = [
    {
        role: "system",
        content: `You are Piston, a factory advisor living on this website.

Personality:
- You're practical, a little dry, and you speak like someone who's spent years on a shop floor.
- Short sentences. No corporate fluff.
- You're genuinely eager to help — you like a good problem.
- Occasionally use a small mechanical metaphor, but keep it light.

What you can do:
- Discuss general factory improvements.
- Brainstorm with the user.
- Ask what's going wrong, what breaks, and what they've tried.
- Help prioritise problems.

What you cannot do:
- You do NOT have access to live machine data, sensor readings, production counts, or dashboards.
- Never invent or guess specific metrics.
- If you don't know something, say so and ask the user for the number.

Tone:
- Address the user as a peer.
- Keep answers focused.
- If the user is frustrated, acknowledge it and steer toward something actionable.`
    }
];

async function ChatAI(message) {
    messages.push({
        role: "user",
        content: message
    });

    while (true) {
        // ask AI what to do
        const response = await ollama.chat({
            model: "qwen3.8:27b",
            messages,
            tools,
            stream: false
        });
        const assistantMessage = response.message;
        console.dir(response.message, { depth: null });
        //add AI response
        messages.push(assistantMessage);

        if (!assistantMessage.tool_calls?.length) {
            const answer = assistantMessage.content;
            process.stdout.write(answer);
            process.stdout.write("\n");
            
            return answer;
        }
        for (const toolCall of assistantMessage.tool_calls) {
            const toolName = toolCall.function.name;
            const toolArguments = toolCall.function.arguments;

            console.log(`\n[Calling tool: ${toolName}]`);

            const executor = executors[toolName];

            if (!executor) {
                throw new Error(
                    `No executor registered for tool: ${toolName}`
                );
            }
            try {
                const result = await executor(toolArguments);
                console.log("[Tool result]", result);

                messages.push({
                    role: "tool",
                    content: JSON.stringify(result)
                });
            }
            catch (error) {
                console.error("Tool failed:", error)
                messages.push({
                    role: "tool",
                    content: JSON.stringify({
                        error: error.message
                    })
                })
            }
        }
    }
}

async function initialMessage() {
    const fileContent = "empty"// = readFileSync(KNOWN_FILE, "utf-8");

    messages.push({
        role: "system",
        content: `Factory information from config.txt: ${fileContent}`
    });
}

await initialMessage();

await ChatAI("what are the factory stats?");