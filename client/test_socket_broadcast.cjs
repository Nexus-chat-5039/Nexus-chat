const { io } = require("socket.io-client");
const axios = require("axios");

async function run() {
  // 1. Create a user (User A) and a group
  const authA = await axios.post("http://localhost:8080/api/auth/register", {
    email: "socket.test.A2@example.com",
    password: "password123"
  }).catch(e => e.response);
  
  let tokenA = authA.data.token;
  if (!tokenA && authA.data.error === "email already registered") {
    const loginA = await axios.post("http://localhost:8080/api/auth/login", {
      email: "socket.test.A2@example.com",
      password: "password123"
    });
    tokenA = loginA.data.token;
  }

  let groupRes = await axios.post("http://localhost:8080/api/groups", { name: "Broadcast Test Group" }, {
    headers: { Authorization: `Bearer ${tokenA}` }
  }).catch(e => e.response);
  const inviteCode = groupRes.data.group.invite_code;
  const groupA = groupRes.data.group;

  // 2. Connect Socket.IO for User A
  const socketA = io("http://localhost:3001", {
    auth: { token: tokenA },
    transports: ["websocket"]
  });

  socketA.on("connect", () => {
    socketA.emit("join_chat", {
      groupId: groupA.id,
      chatId: groupA.chats[0].id
    });
  });

  socketA.on("new_message", (msg) => {
    console.log("User A received message:", msg.content);
    process.exit(0);
  });

  // Wait 1 second before User B joins
  setTimeout(async () => {
    const authB = await axios.post("http://localhost:8080/api/auth/register", {
      email: "socket.test.B2@example.com",
      password: "password123"
    }).catch(e => e.response);
    
    let tokenB = authB.data.token;
    if (!tokenB && authB.data.error === "email already registered") {
      const loginB = await axios.post("http://localhost:8080/api/auth/login", {
        email: "socket.test.B2@example.com",
        password: "password123"
      });
      tokenB = loginB.data.token;
    }

    let joinRes = await axios.post("http://localhost:8080/api/groups/join", { code: inviteCode }, {
      headers: { Authorization: `Bearer ${tokenB}` }
    }).catch(e => e.response);
    const joinedGroup = joinRes.data.group;

    const socketB = io("http://localhost:3001", {
      auth: { token: tokenB },
      transports: ["websocket"]
    });

    socketB.on("connect", () => {
      socketB.emit("send_message", {
        groupId: joinedGroup.id,
        chatId: joinedGroup.chats[0].id,
        tenantId: joinedGroup.tenant_id,
        workspaceId: joinedGroup.workspace_id,
        content: "Hello from User B!"
      });
    });

  }, 1000);
}

run();
