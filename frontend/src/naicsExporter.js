import React, { useState } from 'react';
import Papa from 'papaparse';
import './styles/naicsExporter.css';

// Add this mapping at the top of the file, outside the component
const HYPHENATED_NAICS_MAPPINGS = {
  '31': '31-33', // Manufacturing
  '32': '31-33',
  '33': '31-33',
  '44': '44-45', // Retail Trade
  '45': '44-45',
  '48': '48-49', // Transportation and Warehousing
  '49': '48-49'
};

function NaicsExporter() {
  const [userDescription, setUserDescription] = useState('');
  const [sizeThreshold, setSizeThreshold] = useState(0);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [csvData, setCsvData] = useState([]);

  const functionUrl = 'https://getrelevantnaics-yi5l4qgedq-uc.a.run.app';

  const parseFirmSize = (sizeString) => {
    const matches = sizeString.match(/\d+/g);
    if (!matches) return 0;
    const numbers = matches.map(Number);
    return Math.max(...numbers);
  };

  async function handleAnalyze() {
    try {
      setLoading(true);
      setResults([]);

      // Step 1: Get relevant NAICS codes from Cloud Function
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userDescription, sizeThreshold }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${errorText}`);
      }

      const codeData = await response.json();
      const relevantCodes = codeData.relevantTwoDigitCodes || [];

      // Step 2: Load and process CSV data
      const csvResponse = await fetch('/naics_data.csv');
      if (!csvResponse.ok) throw new Error('Failed to load NAICS data');
      
      const csvText = await csvResponse.text();
      const { data: csvData } = Papa.parse(csvText, { header: true });
      setCsvData(csvData);

      // Step 3: Filter and aggregate results
      const codeSet = new Set(relevantCodes.map(code => {
        const trimmedCode = code.trim();
        // Check if this code is part of a hyphenated group
        return HYPHENATED_NAICS_MAPPINGS[trimmedCode] || trimmedCode;
      }));

      const aggregated = csvData.reduce((acc, row) => {
        const naicsCode = (row.naics_code || '').trim();
        
        // Skip if not a 2-digit code and not a hyphenated code
        if (naicsCode.length !== 2 && !naicsCode.includes('-')) return acc;
        
        // For 2-digit codes, check if they're part of a hyphenated group
        const effectiveCode = HYPHENATED_NAICS_MAPPINGS[naicsCode] || naicsCode;
        
        const firmSize = parseFirmSize(row.firm_size || '');
        
        if (codeSet.has(effectiveCode) && firmSize >= sizeThreshold) {
          if (!acc[effectiveCode]) {
            acc[effectiveCode] = {
              code: effectiveCode,
              description: row.industry_description || 'N/A',
              totalFirms: 0
            };
          }
          acc[effectiveCode].totalFirms += parseInt(row.number_of_firms) || 0;
        }
        return acc;
      }, {});

      setResults(Object.values(aggregated));
      setLoading(false);

    } catch (err) {
      console.error('Analysis failed:', err);
      alert(`Error: ${err.message}`);
      setLoading(false);
    }
  }

  function handleExport() {
    // Create a copy of the data with the new "addressable" column
    const exportData = csvData.map(row => {
      // Check if the first 2 digits of this row's NAICS code match any of our relevant codes
      const twoDigitCode = (row.naics_code || '').trim().slice(0, 2);
      const isAddressable = results.some(result => result.code === twoDigitCode);

      return {
        ...row, // Include all existing columns
        addressable: isAddressable ? 'yes' : 'no' // Add new column
      };
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'naics_data_with_addressable.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="naics-container">
      <div className="sidebar">
        <h1 className="naics-title">Total Addressable Market Calculator</h1>
        <p className="naics-subtitle">
          For B2B companies: Calculate how many potential business customers exist in the U.S. market based on industry and company size.
        </p>
        <p className="input-description">
          Enter your company name or describe what type of businesses you sell to.
        </p>
        
        <div className="input-wrapper">
          <textarea
            className="description-input"
            rows={4}
            placeholder="E.g., 'Microsoft' or 'A software company that sells to hospitals...'"
            value={userDescription}
            onChange={(e) => setUserDescription(e.target.value)}
          />
        </div>
        
        <label className="filter-label">Minimum customer size:</label>
        <div className="select-wrapper">
          <select 
            className="size-select"
            value={sizeThreshold}
            onChange={(e) => setSizeThreshold(Number(e.target.value))}
          >
            <option value={0}>No minimum</option>
            <option value={20}>20 employees</option>
            <option value={100}>100 employees</option>
            <option value={500}>500 employees</option>
          </select>
        </div>

        <div className="button-group">
          <button 
            className={`button ${loading ? 'loading' : ''}`}
            onClick={handleAnalyze} 
            disabled={loading}
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>

          <button 
            className="button"
            onClick={handleExport} 
            disabled={results.length === 0}
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="main-content">
        {results.length > 0 ? (
          <div className="results-section">
            <h2 className="results-title">Addressable Industries</h2>
            <div className="total-firms">
              Total Addressable Firms: {results.reduce((sum, result) => sum + (result.totalFirms || 0), 0).toLocaleString()}
            </div>
            <table className="results-table">
              <thead>
                <tr>
                  <th>Industry</th>
                  <th>Addressable Firms</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index}>
                    <td>{result.description}</td>
                    <td>{(result.totalFirms || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <h2>Enter a description to start analysis.</h2>
        )}
      </div>
    </div>
  );
}

export default NaicsExporter;