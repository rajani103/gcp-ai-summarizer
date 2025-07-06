# gcp-ai-summarizer


## Create BigQuery Table

```sql
CREATE TABLE `my-project.ticket_analysis.summarized_tickets` (
  ticket_id STRING,
  raw_text STRING,
  summary STRING,
  created_at TIMESTAMP
);
```



## Project structure

directory structure


```
gcp-ai-summarizer-node/
 ├── Dockerfile
 ├── index.js
 ├── package.json
 ├── .dockerignore
 ├── cloudbuild.yaml
 ├── README.md
```


### Package .json

```json
{
  "name": "gcp-ai-summarizer-node",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
  "@google-cloud/vertexai": "^0.2.0",
  "@google-cloud/bigquery": "^7.7.0",
  "express": "^4.18.2",
  "body-parser": "^1.20.2"
}
}
```


### index.js

```js
const express = require('express');
const bodyParser = require('body-parser');
const {VertexAI} = require('@google-cloud/vertexai');

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

app.post('/summarize', async (req, res) => {
  const text = req.body.text || '';

  try {
    const result = await generativeModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: `Summarize this in 3 sentences:\n\n${text}` }]
        }
      ]
    });

    const summary = result[0].candidates[0].content.parts[0].text;
    res.json({ summary });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error summarizing text');
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Smart Summarizer API listening on port ${PORT}`);
});
```

## dockerfile

```dockerfile
# Use Node.js LTS
FROM node:18-slim

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080

CMD [ "npm", "start" ]
```

### Dockerignore

```
node_modules
npm-debug.log
```



## cloudbuild.yml

```yml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: [ 'build', '-t', 'gcr.io/$PROJECT_ID/gcp-ai-summarizer-node', '.' ]

  - name: 'gcr.io/cloud-builders/docker'
    args: [ 'push', 'gcr.io/$PROJECT_ID/gcp-ai-summarizer-node' ]

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      [
        'run', 'deploy', 'gcp-ai-summarizer-node',
        '--image', 'gcr.io/$PROJECT_ID/gcp-ai-summarizer-node',
        '--region', 'us-central1',
        '--platform', 'managed',
        '--allow-unauthenticated'
      ]

images:
  - 'gcr.io/$PROJECT_ID/gcp-ai-summarizer-node'

```


