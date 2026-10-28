import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { parseFsx, toText } from "./fsxLayout-sax.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const Factory_design = {
    type: "function",

    function: {
        name: "Factory_design",

        description:
            "Fetch system/application design from a local xml file. " +
            "Call this when the user asks about current design of the factory.",

        parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
        },
    },
};


export async function executeGetFactory_design() {
    console.log(">>> get_factory_design TOOL EXECUTING");
    const filePath = path.resolve(__dirname, "../future factory.fsx");
    const objs = await parseFsx(filePath);
    const text = toText(objs)
    


    //const data = await readFile(filePath, "utf8");
    //console.log(data);
    return text;

}



export default Factory_design;