import http from "http";
import { readFile } from "fs/promises";
import { extname, join } from "path";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value];
  })
);

const root = args.root || "apps/client";
const port = Number(args.port || 5173);

const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css"
};

const server = http.createServer(async (req, res) => {
  const urlPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = join(process.cwd(), root, urlPath);

  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": mime[extname(filePath)] || "text/plain" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(port, () => {
  console.log(`Client dev server on http://localhost:${port}`);
});
