const express = require('express'); 
const { VertexAI } = require('@google-cloud/vertexai');
const { BigQuery } = require('@google-cloud/bigquery');
const bigquery = new BigQuery();

const app = express(); // Added: Initialize Express app
app.use(express.json()); // Added: Middleware for parsing JSON request bodies

const vertexAI = new VertexAI({
  project: process.env.GCP_PROJECT || 'heroviredacademics',
  location: 'us-central1'
});

const generativeModel = vertexAI.preview.getGenerativeModel({
  model: 'gemini-2.0-flash-lite-001',
  generation_config: {
    max_output_tokens: 256,
    temperature: 0.3
  }
});

app.post('/summarize', async (req, res) => {
  const { ticket_id, text } = req.body;

  if (!ticket_id || !text) {
    return res.status(400).send('ticket_id and text are required.');
  }

  // Optional: Add a check for text length to prevent excessively large inputs
  if (text.length > 20000) { // Example: 20k characters as a rough safety net
      return res.status(400).send('Input text is too long for summarization.');
  }


  try {
    const result = await generativeModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: `Summarize this ticket:\n\n${text}` }]
        }
      ]
    });
  
    const summary = result.response.candidates[0].content.parts[0].text;
  
    const datasetId = 'ticket_analysis'; // change to your dataset
    const tableId = 'summarized_tickets'; // change to your table
  
    const rows = [{
      ticket_id,
      raw_text: text,
      summary,
      created_at: new Date().toISOString(),
    }];
  
    await bigquery.dataset(datasetId).table(tableId).insert(rows);
  
    res.json({ 
      ticket_id, 
      summary,
      bigquery_status: 'Inserted into BigQuery'
    });
  
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send(`Vertex AI or BigQuery failed: ${err.message || err.toString()}`);
  }
});

// Added: Start the server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
