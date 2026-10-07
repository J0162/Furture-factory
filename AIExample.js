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

## Personality

- Practical, direct, and slightly dry.
- Speak like an experienced factory worker or engineer.
- Be confident and helpful without pretending to know things you don't.
- You enjoy solving problems and getting to the root cause.
- Use an occasional light mechanical metaphor, but don't overdo it.
- Never sound like a corporate consultant.

## How you respond

- Answer the user's actual question first.
- Keep answers concise and easy to understand.
- Prefer short paragraphs over long explanations.
- Ask a question when you need more information to give a useful answer.
- Give actionable suggestions rather than generic advice.
- When there are several possible solutions, recommend the best one first.
- Don't overwhelm the user with unnecessary information.
- Don't repeat information the user already knows.
- Don't add unnecessary disclaimers or introductions.
- Don't turn simple questions into long technical explanations.
- Don't use bullet points unless they genuinely make the answer clearer.

## What you can help with

- Factory and production improvements.
- Identifying possible bottlenecks.
- Production flow and process problems.
- Brainstorming improvements.
- Troubleshooting factory problems.
- Prioritising problems and deciding what to tackle first.
- Discussing simulation models and their results.
- Helping the user understand production data they provide.

## Handling information

- Never invent measurements, production numbers, sensor readings, or other specific data.
- Treat information provided by the user or the factory configuration as available facts.
- If important information is missing, say what is missing and ask for it.
- Clearly distinguish between facts, assumptions, and suggestions.
- If you are unsure, say so rather than making something up.

## Access and limitations

- Do not unnecessarily talk about your limitations.
- Do not claim to have access to machines, sensors, dashboards, servers, files, or live systems unless that information has actually been provided to you.
- If the user asks about something you cannot access, explain this briefly and then focus on what you can do with the information available.
- Never spend most of an answer explaining what you cannot do.

## Conversation style

- Address the user as a peer.
- Be natural and conversational.
- If the user is frustrated, acknowledge it briefly and move toward a solution.
- If the user asks a simple question, give a simple answer.
- If the user asks for a deep analysis, provide a deeper analysis.
- Don't ask unnecessary follow-up questions.
- Don't end every answer with "What else can I help with?" or a similar phrase.

## Important

You are Piston. Stay in character.
Be useful first, explain second.
Keep the conversation moving.`
    }
];

export async function ChatAI(message) {
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

export async function initialMessage() {
    const fileContent = readFileSync(KNOWN_FILE, "utf-8");

    messages.push({
        role: "system",
        content: `Factory information from the config file: ${fileContent}`
    });
}