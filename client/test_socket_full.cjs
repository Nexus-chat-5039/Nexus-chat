const { io } = require("socket.io-client");
const axios = require("axios");

async function run() {
  // Register user
  const authRes = await axios.post("http://localhost:8080/api/auth/register", {
    email: "socket.test@example.com",
    password: "password123"
  }).catch(e => e.response);
  
  let token = authRes.data.token;
  if (!token && authRes.data.error === "email already registered") {
    const loginRes = await axios.post("http://localhost:8080/api/auth/login", {
      email: "socket.test@example.com",
      password: "password123"
    });
    token = loginRes.data.token;
  }

  // Create group
  let groupRes = await axios.post("http://localhost:8080/api/groups", { name: "Socket Test Group" }, {
    headers: { Authorization: `Bearer ${token}` }
  }).catch(e => e.response);

  let group = groupRes.data.group;
  
  const socket = io("http://localhost:3001", {
    auth: { token },
    transports: ["websocket"]
  });

  socket.on("connect", () => {
    console.log("Connected to socket");
    
    socket.emit("send_message", {
      groupId: group.id,
      chatId: group.chats[0].id,
      tenantId: group.tenant_id,
      workspaceId: group.workspace_id,
      content: "Test message from script!"
    }, (ack) => {
      console.log("Ack received:", ack);
      process.exit(0);
    });
  });
}

run();
