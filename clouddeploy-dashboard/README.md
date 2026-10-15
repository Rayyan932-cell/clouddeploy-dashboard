# CloudDeploy Dashboard

A responsive dark blue/purple frontend dashboard for a Git + Docker + cloud deployment practical.

## Run with Docker

```bash
docker build -t clouddeploy-dashboard .
docker run -d --name clouddeploy-dashboard-container -p 8080:10000 clouddeploy-dashboard
```

Open http://localhost:8080

## Notes

The dashboard metrics, pipeline, and logs are illustrative demo data. The “Simulate deploy” button demonstrates a front-end flow only; it does not trigger an actual cloud deployment. For real cloud hosting, push this repository to GitHub and connect it to a Docker-capable host such as Render. The Nginx container listens on port 10000 for cloud hosting.
