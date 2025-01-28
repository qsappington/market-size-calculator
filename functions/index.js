const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");
const OpenAI = require("openai");
const Papa = require("papaparse");
const openAIKey = defineSecret("OPENAI_API_KEY");

// Initialize Admin SDK so we can use Cloud Storage
initializeApp({
  credential: applicationDefault(),
});

exports.getNaicsCode = onRequest(
  { secrets: [openAIKey] },
  async (req, res) => {
    try {
      // 1. Download the large CSV from Cloud Storage
      const bucketName = "[PROJECT_ID].appspot.com";
      const filePath = "naics/naics_data.csv"; // where you uploaded it
      const tempFilePath = `/tmp/naics_data.csv`; // write locally on the function's temp

      await getStorage().bucket(bucketName).file(filePath).download({
        destination: tempFilePath,
      });
      console.log("CSV file downloaded to", tempFilePath);

      // 2. Read the CSV from /tmp
      const fs = require("fs");
      const csvContent = fs.readFileSync(tempFilePath, "utf8");
      const parsed = Papa.parse(csvContent, { header: true });
      const naicsData = parsed.data; // large array of row objects

      // 3. GPT logic: figure out which 2-digit codes are relevant
      const userRequest = req.body.userRequest || "";
      const openai = new OpenAI({ apiKey: openAIKey.value() });

      const prompt = `
        The user request is:
        "${userRequest}"
        
        I have a dataset of NAICS codes. I only need the relevant 2-digit NAICS codes 
        that are most addressable. Return them in a comma-separated list, with no extra text.
      `;
      const chatResponse = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50,
        temperature: 0,
      });
      const rawText = chatResponse.choices[0].message.content.trim();
      console.log("GPT returned:", rawText);

      const twoDigitCodes = rawText
        .split(",")
        .map((code) => code.trim())
        .filter(Boolean);

      // 4. Sum up number_of_firms for rows whose `naics_code` starts with one of those 2 digits
      let totalFirms = 0;
      naicsData.forEach((row) => {
        const code = row.naics_code;
        if (!code) return;
        for (const prefix of twoDigitCodes) {
          if (code.startsWith(prefix)) {
            const count = parseInt(row.number_of_firms, 10) || 0;
            totalFirms += count;
            break;
          }
        }
      });

      return res.status(200).json({
        relevantTwoDigitCodes: twoDigitCodes,
        totalAddressableFirms: totalFirms,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  }
);
