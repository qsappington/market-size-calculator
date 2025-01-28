// frontend/src/NaicsExporter.js
import React, { useState } from "react";
import Papa from "papaparse";

function NaicsExporter() {
  const [userDescription, setUserDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    try {
      setLoading(true);

      // 1. Call the Cloud Function
      const functionUrl = "https://getnaicscode-yi5l4qgedq-uc.a.run.app";
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userDescription }),
      });
      if (!response.ok) throw new Error("Failed to call getRelevantNaics");

      const data = await response.json();
      const relevantTwoDigitCodes = data.relevantTwoDigitCodes || [];

      // 2. Fetch your CSV. If it's in public/, it's "/naics_data_cleaned.csv"
      const csvResp = await fetch("/naics_data_cleaned.csv");
      const csvText = await csvResp.text();

      // 3. Parse CSV
      const parsed = Papa.parse(csvText, { header: true });
      let rows = parsed.data;

      // 4. Mark each row as "yes" or "no"
      rows = rows.map((row) => {
        const code = (row.naics_code || "").trim();
        let addressable = "no";
        for (const twoDigit of relevantTwoDigitCodes) {
          if (code.startsWith(twoDigit.trim())) {
            addressable = "yes";
            break;
          }
        }
        return { ...row, addressable };
      });

      // 5. Convert back to CSV
      const newCsv = Papa.unparse(rows);

      // 6. Trigger download
      const blob = new Blob([newCsv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "addressable_naics_data.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  return (
    <div>
      <h3>Export Addressable CSV</h3>
      <textarea
        rows={4}
        placeholder="Describe the business..."
        value={userDescription}
        onChange={(e) => setUserDescription(e.target.value)}
      />
      <br />
      <button onClick={handleExport} disabled={loading}>
        {loading ? "Exporting..." : "Export CSV"}
      </button>
    </div>
  );
}

export default NaicsExporter;
