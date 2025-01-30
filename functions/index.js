const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");
const cors = require("cors")({ origin: true });

const openAIKey = defineSecret("OPENAI_API_KEY");

exports.getRelevantNaics = onRequest(
  { secrets: [openAIKey] },
  async (req, res) => {
    cors(req, res, async () => {
      try {
        const userDescription = req.body.userDescription || "";
        const sizeThreshold = parseInt(req.body.sizeThreshold) || 0;
        
        if (!userDescription) {
          return res.status(400).json({ error: "Missing userDescription" });
        }

        const openai = new OpenAI({ apiKey: openAIKey.value() });

        const prompt = `
          User request: "${userDescription}"
          ${sizeThreshold > 0 ? 
            `Targeting companies with more than ${sizeThreshold} employees. ` : 
            ''}
          Identify the 2-digit NAICS codes for industries that:
          1. Match the business description
          2. Typically contain companies ${sizeThreshold > 0 ? `with over ${sizeThreshold} employees` : 'of all sizes'}
          
          Provide only the numeric codes as comma-separated values (e.g., "54, 62").
          No explanations or additional text.
        `;

        const response = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 50,
          temperature: 0,
        });

        const rawText = response.choices[0].message.content.trim();
        const twoDigitCodes = rawText
          .split(",")
          .map(code => code.trim())
          .filter(code => /^\d{2}$/.test(code));

        return res.status(200).json({
          relevantTwoDigitCodes: twoDigitCodes
        });
      } catch (err) {
        console.error("API Error:", err);
        return res.status(500).json({ 
          error: err.message.includes("401") ? "Invalid OpenAI key" : err.message 
        });
      }
    });
  }
);