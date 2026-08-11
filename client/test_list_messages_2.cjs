const axios = require("axios");

async function run() {
  const loginRes = await axios.post("http://localhost:8080/api/auth/login", {
    email: "rajatmalik5039@gmail.com",
    password: "password123"
  }).catch(e => e.response);

  const token = loginRes.data.token;
  if (!token) return console.log("Login failed", loginRes.data);

  try {
    const msgsRes = await axios.get(`http://localhost:8080/api/chats/0d137b7a-0ada-4907-99ef-a070309fbb19/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("MESSAGES:", msgsRes.data);
  } catch(e) {
    console.error("ERROR:", e.response?.data);
  }
}
run();
