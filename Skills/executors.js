import { executeGetStats } from "./stats.js";
import { executeGetFactory_design } from "./FileRead.js";

const executors = {
    get_stats: executeGetStats,
    Factory_design: executeGetFactory_design,
};

export default executors;