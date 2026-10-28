// fsxLayout-sax.js — FlexSim .fsx -> compact layout, streaming with saxes.
// Streams the file and skips the 3D-media/UI sections, so memory stays low on huge models.
// npm i saxes
// Usage: node fsxLayout-sax.js "future factory.fsx" layout.json
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { SaxesParser } from "saxes";

const SKIP = new Set(["packedmedia", "flh", "Tools"]); // 3D media, save history, UI
const CONV = new Set(["length", "width", "speed", "rise", "radius", "startAngle", "sweepAngle"]);

// Build a lightweight tree: { f, dt, name, data?: string | { node:[], coupling }, node?: [] }
function readTree(path) {
  return new Promise((resolve, reject) => {
    const p = new SaxesParser();
    const root = { node: [] };
    const stack = [root];  // open <node>s
    const where = [];      // per open <node>: "self" or "data" (where child <node>s go)
    let field = null;      // tag whose text we're collecting
    let skip = 0;          // depth inside a skipped subtree

    p.on("opentag", (t) => {
      if (skip) { if (t.name === "node") skip++; return; }
      const cur = stack[stack.length - 1];
      if (t.name === "node") {
        const n = { f: t.attributes.f, dt: t.attributes.dt, name: "" };
        const parent = where[where.length - 1] === "data" ? (cur.data ??= {}) : cur;
        (parent.node ??= []).push(n);
        stack.push(n); where.push("self");
      } else if (t.name === "data") { where[where.length - 1] = "data"; field = "data"; }
      else if (t.name === "name" || t.name === "coupling") field = t.name;
    });

    p.on("text", (s) => {
      if (skip || !field) return;
      const cur = stack[stack.length - 1];
      if (field === "name") cur.name += s;
      else if (field === "coupling") (cur.data ??= {}).coupling = s;
      else if (s.trim()) cur.data = typeof cur.data === "object" ? cur.data : (cur.data ?? "") + s;
    });

    p.on("closetag", (t) => {
      if (skip) { if (t.name === "node") skip--; return; }
      if (t.name === "node") { stack.pop(); where.pop(); }
      else if (t.name === "data") { where[where.length - 1] = "self"; field = null; }
      else if (t.name === "coupling") field = "data";
      else if (t.name === "name") {
        field = null;
        const cur = stack[stack.length - 1];
        if (stack.length === 3 && SKIP.has(cur.name)) {  // direct child of /model -> drop it
          stack.pop(); where.pop();
          const parent = stack[stack.length - 1];
          const list = where[where.length - 1] === "data" ? parent.data.node : parent.node;
          list.pop();
          skip = 1;
        }
      }
    });

    p.on("error", reject);
    p.on("end", () => resolve(root.node[0])); // the <node> named "model"
    fs.createReadStream(path, { encoding: "utf8", highWaterMark: 1 << 20 })
      .on("data", (chunk) => p.write(chunk))
      .on("end", () => p.close())
      .on("error", reject);
  });
}

// Every FlexSim node: { f, dt, name, data?: string | { node:[], coupling }, node?: [] }
const kids = (n) => n?.node ?? [];
const dataKids = (n) => (typeof n?.data === "object" ? n.data.node ?? [] : []);
const nameOf = (n) => (typeof n?.name === "string" ? n.name : "");
const text = (n) => (typeof n?.data === "string" ? n.data : n?.data?.["#text"] ?? "");
const attr = (o, name) => dataKids(o).find((n) => nameOf(n) === name);
const sub = (n, name) => kids(n).find((c) => nameOf(c) === name);

// FlexSim doubles: 16 hex chars, the two 32-bit words swapped. "000000003ff00000" -> 1.0
function dbl(hex) {
  if (!hex || hex.length !== 16) return null;
  return Math.round(Buffer.from(hex.slice(8) + hex.slice(0, 8), "hex").readDoubleBE(0) * 1000) / 1000;
}

function nums(n, keys) {
  const out = {};
  for (const a of kids(n))
    if (nameOf(a) && a.dt === "1" && text(a) && (!keys || keys.has(nameOf(a)))) out[nameOf(a)] = dbl(text(a).trim());
  return out;
}

const ports = (o, which) =>
  kids(sub(attr(o, "connections"), which))
    .map((c) => c.data?.coupling)
    .filter((c) => c && c !== "null")
    .map((c) => c.split(">")[0].replace(/^\//, ""));

function toRecord(o) {
  const cls = kids(attr(o, "classes")).map(nameOf).filter(Boolean);
  const s = nums(attr(o, "spatial"));
  const r = {
    name: nameOf(o),
    type: cls[0] ?? null,
    pos: [s.spatialx, s.spatialy, s.spatialz],
    size: [s.spatialsx, s.spatialsy, s.spatialsz],
    rotZ: s.spatialrz,
  };
  const v = nums(attr(o, "variables"), CONV);
  if (Object.keys(v).length) r.params = v;
  for (const [k, w] of [["out", "connectionsout"], ["in", "connectionsin"], ["center", "connectionscenter"]]) {
    const p = ports(o, w);
    if (p.length) r[k] = p;
  }
  const labels = Object.fromEntries(kids(attr(o, "labels")).filter(nameOf).map((l) => [nameOf(l), text(l)]));
  if (Object.keys(labels).length) r.labels = labels;
  const nested = kids(o).filter((k) => k.dt === "4").map(toRecord);
  if (nested.length) r.contents = nested;
  return r;
}

async function parseFsx(path) {
  const model = await readTree(path);
  return kids(model).filter((o) => o.dt === "4" && nameOf(o) && !SKIP.has(nameOf(o))).map(toRecord);
}

const toText = (objs) =>
  objs.map((o) => [o.name, o.type, `(${o.pos.map((v) => v?.toFixed(1)).join(", ")})`, `rot ${o.rotZ}`,
    o.in && `in: ${o.in.join(", ")}`, o.out && `out: ${o.out.join(", ")}`, o.center && `center: ${o.center.join(", ")}`]
    .filter(Boolean).join(" | ")).join("\n");

export { parseFsx, toText };

if (process.argv[1] === fileURLToPath(import.meta.url)) { // run directly from the command line
  const [, , input = "future factory.fsx", output = "layout.json"] = process.argv;
  parseFsx(input).then((objs) => {
    fs.writeFileSync(output, JSON.stringify(objs, null, 1));
    fs.writeFileSync(output.replace(/\.json$/, ".txt"), toText(objs));
    console.log(`${objs.length} objects -> ${output}`);
  });
}