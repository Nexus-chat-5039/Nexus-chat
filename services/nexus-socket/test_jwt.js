const jwt = require("jsonwebtoken");
const token = jwt.sign({ user_id: "123", email: "test@example.com" }, "supersecret-dev-key");
console.log(jwt.verify(token, "supersecret-dev-key"));
