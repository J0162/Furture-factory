const getStats = {
    type: "function",

    function: {
        name: "get_stats",

        description:
            "Fetch system/application statistics from the local stats API. " +
            "Call this when the user asks about current stats, metrics, or system status.",

        parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
        },
    },
};


export async function executeGetStats() {
    console.log(">>> get_stats TOOL EXECUTING");

    const response = await fetch(
        "http://127.0.0.1:8000/stats"
    );

    console.log(">>> stats API responded:", response.status);

    if (!response.ok) {
        throw new Error(
            `Stats API returned HTTP ${response.status}`
        );
    }

    const result = await response.json();

    console.log(">>> stats result:", result);

    return result;
}


export default getStats;