const axios = require("axios");

async function run() {
  const loginRes = await axios.post("http://localhost:8080/api/auth/login", {
    email: "socket.payload@example.com",
    password: "password123"
  }).catch(e => e.response);

  const token = loginRes.data.token;
  if (!token) {
    console.log("Login failed", loginRes.data);
    return;
  }

  const groupsRes = await axios.get("http://localhost:8080/api/groups", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const groups = groupsRes.data.groups;
  if (!groups || groups.length === 0) return console.log("No groups");
  
  const chat = groups[0].chats[0];
  if (!chat) return console.log("No chats");

  const msgsRes = await axios.get(`http://localhost:8080/api/chats/${chat.id}/messages`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log("MESSAGES:", JSON.stringify(msgsRes.data, null, 2));
}
run();
