// testOpenAI.js
const OpenAI = require("openai");

console.log("Loaded OpenAI library successfully!");

const openai = new OpenAI({ apiKey: "test-key" });
console.log("Client initialized:", openai);