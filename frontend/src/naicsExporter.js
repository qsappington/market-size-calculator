// frontend/src/NaicsExporter.js
import React, { useState } from "react";
import Papa from "papaparse";

function NaicsExporter() {
  const [userDescription, setUserDescription] = useState("");
  const [loading, setLoading] = useState(false);

  // Replace with your actual Cloud Function URL
  const functionUrl = "https://getrelevantnaics-yi5l4qgedq-uc.a.run.app";

  async function handleExport() {
    try {
      setLoading(true);
      console.log("Export initiated with description:", userDescription);

      // 1. Call your Cloud Function with userDescription
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userDescription }),
      });

      console.log("Cloud Function response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to call getRelevantNaics function: ${errorText}`);
      }

      const data = await response.json();
      const relevantTwoDigitCodes = data.relevantTwoDigitCodes || [];
      console.log("Relevant Two-Digit NAICS Codes:", relevantTwoDigitCodes);

      // 2. Fetch the CSV from /public
      const csvResponse = await fetch("/naics_data.csv");
      console.log("CSV fetch response status:", csvResponse.status);

      if (!csvResponse.ok) {
        throw new Error("Failed to fetch naics_data.csv");
      }
      const csvText = await csvResponse.text();
      console.log("CSV fetched successfully");

      // 3. Parse CSV in the browser
      const parsed = Papa.parse(csvText, { header: true });
      let rows = parsed.data; // array of objects
      console.log(`Parsed ${rows.length} rows from CSV`);

      // 4. Mark each row "yes" or "no" for addressable
      // Optimize by using a Set for faster lookup
      const codeSet = new Set(relevantTwoDigitCodes.map(code => code.trim()));
      console.log("Using codes set:", codeSet);

      rows = rows.map((row) => {
        const code = (row.naics_code || "").trim();
        const prefix2 = code.slice(0, 2);
        const addressable = codeSet.has(prefix2) ? "yes" : "no";
        return { ...row, addressable };
      });
      console.log("Rows marked with 'addressable'");

      // 5. Convert back to CSV
      const newCsv = Papa.unparse(rows);
      console.log("New CSV generated");

      // 6. Trigger download of the new CSV
      const blob = new Blob([newCsv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "addressable_naics_data.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url); // Clean up
      console.log("Download triggered");

      setLoading(false);
    } catch (err) {
      console.error("Export Error:", err);
      alert(`Export failed: ${err.message}`);
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h3>NAICS CSV Export</h3>
      <textarea
        rows={4}
        placeholder="Describe the business..."
        value={userDescription}
        onChange={(e) => setUserDescription(e.target.value)}
        style={{ width: "100%", padding: "8px" }}
      />
      <br />
      <button onClick={handleExport} disabled={loading} style={{ marginTop: "10px", padding: "10px 20px" }}>
        {loading ? "Exporting..." : "Export CSV"}
      </button>
    </div>
  );
}

export default NaicsExporter;
