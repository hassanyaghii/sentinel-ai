
# Running Sentinel AI with Docker

To get this app running locally on your machine:

1. **Prerequisites**: Ensure you have Docker and Docker Compose installed.
2. **Launch**: Run `docker-compose up -d`.
3. **Access UI**: Open `http://localhost:8080` in your browser.
4. **Access n8n**: Open `http://localhost:5678` to build your AI Agent.

### Important: Webhook URL
When the UI asks for the **n8n Webhook URL**, use `http://localhost:5678/webhook/your-id`. 

*Note: If your browser blocks the request because it is 'Insecure' (HTTP vs HTTPS), you may need to enable "Insecure content" in Site Settings for localhost.*
