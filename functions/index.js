// functions/index.js

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");
const cors = require("cors")({ origin: true }); // Added CORS

const openAIKey = defineSecret("OPENAI_API_KEY");

exports.getRelevantNaics = onRequest(
  { secrets: [openAIKey] },
  async (req, res) => {
    // Wrap entire handler in CORS
    cors(req, res, async () => {
      try {
        const userDescription = req.body.userDescription || "";
        if (!userDescription) {
          return res.status(400).json({ error: "Missing userDescription" });
        }

        const openai = new OpenAI({ apiKey: openAIKey.value() });

        // GPT prompt
        const prompt = `
          User request: "${userDescription}"
          I need the relevant 2-digit NAICS codes 
          that are most addressable. Return them as comma-separated list (e.g., "54, 62").
          No extra text.
        `;

        const response = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 50,
          temperature: 0,
        });

        const rawText = response.choices[0].message.content.trim();
        console.log("GPT says relevant codes:", rawText);

        const twoDigitCodes = rawText
          .split(",")
          .map(code => code.trim())
          .filter(Boolean);

        return res.status(200).json({
          relevantTwoDigitCodes: twoDigitCodes
        });
      } catch (err) {
        console.error("OpenAI error:", err);
        return res.status(500).json({ error: err.message });
      }
    });
  }
);