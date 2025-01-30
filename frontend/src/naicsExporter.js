// src/NaicsExporter.js
import React, { useState } from 'react';
import Papa from 'papaparse';
import './styles/naicsExporter.css';

function NaicsExporter() {
  const [userDescription, setUserDescription] = useState('');
  const [sizeThreshold, setSizeThreshold] = useState(0);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const functionUrl = 'https://getrelevantnaics-yi5l4qgedq-uc.a.run.app';

  const parseFirmSize = (sizeString) => {
    const matches = sizeString.match(/\d+/g);
    if (!matches) return 0;
    const numbers = matches.map(Number);
    return Math.max(...numbers);
  };

  const aggregateResults = (rows) => {
    const aggregation = {};
    
    rows.forEach(row => {
      const code = row.naics_code.slice(0, 2);
      const firmSize = parseFirmSize(row.firm_size || '');
      
      if (!aggregation[code]) {
        aggregation[code] = {
          description: row.industry_description,
          totalFirms: 0
        };
      }

      if (firmSize >= sizeThreshold) {
        aggregation[code].totalFirms += parseInt(row.number_of_firms) || 0;
      }
    });

    return Object.entries(aggregation).map(([code, data]) => ({
      code,
      description: data.description,
      totalFirms: data.totalFirms
    }));
  };

  async function handleAnalyze() {
    try {
      setLoading(true);
      setResults([]);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userDescription,
          sizeThreshold
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to call API: ${errorText}`);
      }

      const data = await response.json();
      const relevantTwoDigitCodes = data.relevantTwoDigitCodes || [];

      const csvResponse = await fetch('/naics_data.csv');
      if (!csvResponse.ok) {
        throw new Error('Failed to fetch naics_data.csv');
      }
      const csvText = await csvResponse.text();
      
      const parsed = Papa.parse(csvText, { header: true });
      let rows = parsed.data;

      const codeSet = new Set(relevantTwoDigitCodes.map(code => code.trim()));
      
      const filteredRows = rows.filter(row => {
        const code = (row.naics_code || '').trim();
        const prefix2 = code.slice(0, 2);
        return codeSet.has(prefix2);
      });

      setResults(aggregateResults(filteredRows));
      setLoading(false);
    } catch (err) {
      console.error('Analysis Error:', err);
      alert(`Analysis failed: ${err.message}`);
      setLoading(false);
    }
  }

  function handleExport() {
    const exportData = results.map(item => ({
      'NAICS Code': item.code,
      'Industry Description': item.description,
      'Addressable Firms': item.totalFirms
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'addressable_industries.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="naics-container">
      <h1 className="naics-title">NAICS Market Analysis</h1>
      
      <div className="input-section">
        <textarea
          className="description-input"
          rows={4}
          placeholder="Describe the business..."
          value={userDescription}
          onChange={(e) => setUserDescription(e.target.value)}
        />
        
        <div className="filters">
          <label className="filter-label">Minimum company size:</label>
          <select 
            className="size-select"
            value={sizeThreshold}
            onChange={(e) => setSizeThreshold(Number(e.target.value))}
          >
            <option value={0}>No minimum</option>
            <option value={20}>20+ employees</option>
            <option value={100}>100+ employees</option>
            <option value={500}>500+ employees</option>
          </select>
        </div>

        <div className="action-buttons">
          <button 
            className={`analyze-button ${loading ? 'loading' : ''}`}
            onClick={handleAnalyze} 
            disabled={loading}
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
          <button 
            className="export-button"
            onClick={handleExport} 
            disabled={results.length === 0}
          >
            Export CSV
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="results-section">
          <h2 className="results-title">Addressable Industries</h2>
          <table className="results-table">
            <thead>
              <tr>
                <th>Industry Description</th>
                <th>Addressable Firms</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, index) => (
                <tr key={index}>
                  <td>{result.description}</td>
                  <td>{result.totalFirms.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default NaicsExporter;