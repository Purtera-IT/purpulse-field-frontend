# Purpulse — Azure Functions

These are **Node.js 18** Azure Functions that run as a separate deployment from the Base44 frontend/backend. They handle compute-heavy tasks (ML pipeline) that should not run inside the web process.

---

## processEvidence

HTTP-triggered function that runs the evidence processing pipeline after a file is uploaded.

### Trigger

`POST /api/evidence/process`  
Body: `{ "evidenceId": "string", "fileUrl": "string" }`

Invoke from your Base44 backend function after `evidence.status` transitions to `processing`:

```js
await axios.post(`${process.env.AZURE_FUNCTION_URL}/api/evidence/process`, {
  evidenceId: evidence.id,
  fileUrl: evidence.file_url,
}, {
  headers: { 'x-functions-key': process.env.AZURE_FUNCTION_KEY },
});
```

### Pipeline

1. **Download** original file from storage
2. **Thumbnail** — `sharp` → resize to 400×400, upload to blob storage
3. **OCR** — Azure Computer Vision `recognizePrintedText`
4. **Face detection** — Azure Face API; if faces detected, composite black rectangles and upload redacted copy
5. **Embeddings** — Azure OpenAI `text-embedding-3-small` on OCR text
6. **POST results** to `BACKEND_API_URL/api/v1/evidence/{id}/process-result`

### Environment Variables

| Variable | Description |
|---|---|
| `AZURE_CV_KEY` | Azure Computer Vision API key |
| `AZURE_CV_ENDPOINT` | e.g. `https://your-cv.cognitiveservices.azure.com/` |
| `AZURE_FACE_KEY` | Azure Face API key |
| `AZURE_FACE_ENDPOINT` | e.g. `https://your-face.cognitiveservices.azure.com/` |
| `AZURE_OPENAI_KEY` | Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` | e.g. `https://your-aoai.openai.azure.com/` |
| `AZURE_OPENAI_DEPLOYMENT_ID` | Deployment name, e.g. `text-embedding-3-small` |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob storage connection string |
| `AZURE_STORAGE_CONTAINER` | Container name for thumbnails/redacted images |
| `BACKEND_API_URL` | Base URL of the Purpulse API, e.g. `https://api.purpulse.io` |
| `BACKEND_API_TOKEN` | Service-level bearer token for `/api/v1/evidence/{id}/process-result` |

### Local Development

```bash
cd azure-functions
npm install
cp .env.example .env   # fill in your values
npx func start
```

Test with curl:
```bash
curl -X POST http://localhost:7071/api/evidence/process \
  -H "Content-Type: application/json" \
  -d '{"evidenceId":"test-123","fileUrl":"https://your-blob/sample.jpg"}'
```

### Dependencies

```json
{
  "dependencies": {
    "@azure/cognitiveservices-computervision": "^8.2.0",
    "@azure/cognitiveservices-face": "^1.0.4",
    "@azure/ms-rest-azure-js": "^2.1.0",
    "@azure/openai": "^1.0.0",
    "@azure/storage-blob": "^12.17.0",
    "axios": "^1.6.0",
    "sharp": "^0.33.0"
  }
}
```

Run `npm install` inside `azure-functions/` before deploying.

### Retry Policy

Configured in `function.json`: 3 fixed-delay retries at 30s intervals.
For more aggressive backoff, switch to `"strategy": "exponentialBackoff"`.

### Security

- The function requires an Azure Function key (`x-functions-key` header or `code` query param).
- `BACKEND_API_TOKEN` should be a short-lived or rotatable service token — do **not** share with frontend.
- The `BACKEND_API_URL/api/v1/evidence/{id}/process-result` endpoint must validate this token server-side.

---

## Notes

- These functions are **not** Base44 Deno functions. Do not deploy them with `base44 deploy`.
- Deploy to Azure via: `az functionapp deployment source config-zip` or GitHub Actions.
- Ensure the storage container has private access; thumbnails/redacted images should use SAS URLs for client access.