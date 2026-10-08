async function ChatAI(message) {

    const response = await fetch("/api/chat", {
        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            message: message
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "AI server returned an error");
    }

    return data.answer;
}

let chatboxdiv = document.getElementById("chatbox");
let messageInput = document.getElementById("ChatMessage");
let Dots = document.getElementById("dots");
var visibility = Dots.style.visibility;

async function Sendmessage() {

    let message = messageInput.value.trim();

    if (message === "") {
        return;
    }

    // =========================
    // USER MESSAGE
    // =========================

    let userMessageDiv = document.createElement("div");
    userMessageDiv.className = "message usermessage";

    let userBox = document.createElement("div");
    userBox.className = "userbox";
    userBox.textContent = message;

    let userIcon = document.createElement("img");
    userIcon.className = "usericon";
    userIcon.src = "personicon.png";

    userMessageDiv.appendChild(userBox);
    userMessageDiv.appendChild(userIcon);

    chatboxdiv.appendChild(userMessageDiv);

    messageInput.value = "";

    chatboxdiv.scrollTop = chatboxdiv.scrollHeight;


    // =========================
    // AI RESPONSE
    // =========================
    Dots.style.visibility = visibility == "visible" ? 'hidden' : "visible"
    console.log("asking AI");
    let AImessage = await ChatAI(message);
    console.log(AImessage);

    let aiMessageDiv = document.createElement("div");
    aiMessageDiv.className = "message aimessage";

    let aiBox = document.createElement("div");
    aiBox.className = "AIbox";
    aiBox.textContent = AImessage;

    let aiIcon = document.createElement("img");
    aiIcon.className = "AIicon";
    aiIcon.src = "personicon.png";

    aiMessageDiv.appendChild(aiIcon);
    aiMessageDiv.appendChild(aiBox);

    chatboxdiv.appendChild(aiMessageDiv);
    Dots.style.visibility = visibility == "hidden" ? 'visible' : "hidden"

    chatboxdiv.scrollTop = chatboxdiv.scrollHeight;
}