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
        
        if (!userDescription) {
          return res.status(400).json({ error: "Missing userDescription" });
        }

        const openai = new OpenAI({ apiKey: openAIKey.value() });

        const prompt = `
          ${userDescription.includes(' ') ? 
            `Business description: "${userDescription}"` : 
            `Company name: "${userDescription}"`}

          Identify the 2-digit NAICS codes for industries that this business or company may sell into (e.g., Microsoft would sell into practically all industries). Please provide an exhaustive list.
          
          Provide only the numeric codes as comma-separated values (e.g., "54, 62").
          No explanations or additional text.
        `;

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
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
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    });
  }
);