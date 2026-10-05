import { Ollama } from 'ollama'
const ollama = new Ollama({ host: 'http://127.0.0.1:11434' })

async function ChatAI(Message)
{
    //mesage input
    const message = { role: 'user', content: Message }
    //verzend naar AI Server
    const response = await ollama.chat({
    model: 'qwen3.8:27b',
    messages: [message],
    stream: true,
    })
    //output
    for await (const part of response) {
    process.stdout.write(part.message.content)
    }
}

await ChatAI("How is it going?")
