const { io } = require("socket.io-client");
const axios = require("axios");

async function run() {
  const authA = await axios.post("http://localhost:8080/api/auth/register", {
    email: "socket.payload@example.com",
    password: "password123"
  }).catch(e => e.response);
  
  let token = authA.data.token;
  if (!token) {
    const loginA = await axios.post("http://localhost:8080/api/auth/login", {
      email: "socket.payload@example.com",
      password: "password123"
    });
    token = loginA.data.token;
  }

  let groupRes = await axios.post("http://localhost:8080/api/groups", { name: "Payload Test" }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const group = groupRes.data.group;

  const socket = io("http://localhost:3001", {
    auth: { token },
    transports: ["websocket"]
  });

  socket.on("connect", () => {
    socket.emit("join_chat", {
      groupId: group.id,
      chatId: group.chats[0].id
    });
  });

  socket.on("new_message", (msg) => {
    console.log(msg);
    process.exit(0);
  });

  setTimeout(() => {
    socket.emit("send_message", {
      groupId: group.id,
      chatId: group.chats[0].id,
      tenantId: group.tenant_id,
      workspaceId: group.workspace_id,
      content: "Payload test"
    });
  }, 1000);
}

run();
