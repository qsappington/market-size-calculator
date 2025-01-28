import React, { useState } from 'react';

function App() {
  const [description, setDescription] = useState('');
  const [naicsCode, setNaicsCode] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    setNaicsCode('');
    try {
      const response = await fetch(
        'https://us-central1-naics-web-app.cloudfunctions.net/getNaicsCode',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userDescription: description })
        }
      );
      if (!response.ok) {
        throw new Error('Failed to get NAICS code');
      }
      const data = await response.json();
      setNaicsCode(data.naicsCode);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h1>NAICS Finder</h1>
      <textarea
        rows="4"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe the business..."
      />
      <br />
      <button onClick={handleSubmit}>Get NAICS Code</button>
      {naicsCode && <p>OpenAI suggests code: <strong>{naicsCode}</strong></p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
  );
}

export default App;
