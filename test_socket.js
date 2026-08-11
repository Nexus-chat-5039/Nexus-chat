const { io } = require("socket.io-client");

const token = process.argv[2];
const groupId = process.argv[3];
const chatId = process.argv[4];
const tenantId = process.argv[5];
const workspaceId = process.argv[6];

const socket = io("http://localhost:3001", {
  auth: { token },
  transports: ["websocket"]
});

socket.on("connect", () => {
  console.log("Connected to socket");
  
  socket.emit("send_message", {
    groupId,
    chatId,
    tenantId,
    workspaceId,
    content: "Test message from script!"
  }, (ack) => {
    console.log("Ack received:", ack);
    process.exit(0);
  });
});

socket.on("connect_error", (err) => {
  console.error("Connection error:", err.message);
  process.exit(1);
});
