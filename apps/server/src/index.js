import { WebSocketServer } from "ws";
import { createRoom } from "./room.js";

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });
const room = createRoom();

wss.on("connection", (socket) => {
	room.handleConnection(socket);
});

console.log(`WS server listening on ${PORT}`);
