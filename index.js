const express = require('express');
const bodyParser = require('body-parser');
const {VertexAI} = require('@google-cloud/vertexai');
const {BigQuery} = require('@google-cloud/bigquery');

const app = express();
app.use(bodyParser.json());

const vertexAI = new VertexAI({
  project: process.env.GCP_PROJECT,
  location: 'us-central1'
});
const generativeModel = vertexAI.preview.getGenerativeModel({
  model: 'gemini-1.5-pro-preview-0409',
  generation_config: {
    max_output_tokens: 256,
    temperature: 0.3
  }
});

const bigquery = new BigQuery();

app.post('/summarize', async (req, res) => {
  const { ticket_id, text } = req.body;
  if (!ticket_id || !text) {
    return res.status(400).send('ticket_id and text are required.');
  }

  try {
    const result = await generativeModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: `Summarize this support ticket in 2 sentences:\n\n${text}` }]
        }
      ]
    });

    const summary = result[0].candidates[0].content.parts[0].text;

    // Insert into BigQuery
    const datasetId = 'ticket_analysis';
    const tableId = 'summarized_tickets';

    await bigquery
      .dataset(datasetId)
      .table(tableId)
      .insert({
        ticket_id,
        raw_text: text,
        summary,
        created_at: new Date().toISOString()
      });

    res.json({
      ticket_id,
      summary
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error summarizing or inserting into BigQuery');
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Smart Ticket Summarizer listening on port ${PORT}`);
});