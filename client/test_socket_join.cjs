const { io } = require("socket.io-client");
const axios = require("axios");

async function run() {
  // 1. Create a user (User A) and a group
  const authA = await axios.post("http://localhost:8080/api/auth/register", {
    email: "socket.test.A@example.com",
    password: "password123"
  }).catch(e => e.response);
  
  let tokenA = authA.data.token;
  if (!tokenA && authA.data.error === "email already registered") {
    const loginA = await axios.post("http://localhost:8080/api/auth/login", {
      email: "socket.test.A@example.com",
      password: "password123"
    });
    tokenA = loginA.data.token;
  }

  let groupRes = await axios.post("http://localhost:8080/api/groups", { name: "Join Test Group" }, {
    headers: { Authorization: `Bearer ${tokenA}` }
  }).catch(e => e.response);
  const inviteCode = groupRes.data.group.invite_code;
  console.log("Group created with invite code:", inviteCode);

  // 2. Create another user (User B) and join
  const authB = await axios.post("http://localhost:8080/api/auth/register", {
    email: "socket.test.B@example.com",
    password: "password123"
  }).catch(e => e.response);
  
  let tokenB = authB.data.token;
  if (!tokenB && authB.data.error === "email already registered") {
    const loginB = await axios.post("http://localhost:8080/api/auth/login", {
      email: "socket.test.B@example.com",
      password: "password123"
    });
    tokenB = loginB.data.token;
  }

  let joinRes = await axios.post("http://localhost:8080/api/groups/join", { code: inviteCode }, {
    headers: { Authorization: `Bearer ${tokenB}` }
  }).catch(e => e.response);
  const joinedGroup = joinRes.data.group;

  // 3. Connect Socket.IO for User B
  const socket = io("http://localhost:3001", {
    auth: { token: tokenB },
    transports: ["websocket"]
  });

  socket.on("connect", () => {
    console.log("Connected to socket as User B");
    
    socket.emit("send_message", {
      groupId: joinedGroup.id,
      chatId: joinedGroup.chats[0].id,
      tenantId: joinedGroup.tenant_id,
      workspaceId: joinedGroup.workspace_id,
      content: "Test message from User B!"
    }, (ack) => {
      console.log("Ack received:", ack);
      process.exit(0);
    });
  });
}

run();
