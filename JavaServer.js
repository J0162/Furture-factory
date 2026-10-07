import express from "express";
import { ChatAI, initialMessage } from "./AIExample.js";

const app = express();

app.use(express.json());

app.use(express.static("."));

await initialMessage();

app.post("/api/chat", async (req, res) => {

    try {

        const message = req.body.message;

        if (!message) {
            return res.status(400).json({
                error: "No message provided"
            });
        }

        console.log("User:", message);

        const answer = await ChatAI(message);

        console.log("AI:", answer);

        res.json({
            answer: answer
        });

    } catch (error) {

        console.error("ChatAI failed:", error);

        res.status(500).json({
            error: error.message
        });
    }
});

app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});