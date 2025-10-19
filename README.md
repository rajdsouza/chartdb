<h1 align="center">
  <a href="https://chartdb.io#gh-light-mode-only">
    <img src="https://github.com/chartdb/chartdb/blob/main/src/assets/logo-light.png" width="400" height="70" alt="ChartDB">
  </a>
  <a href="https://chartdb.io##gh-dark-mode-only">
    <img src="https://github.com/chartdb/chartdb/blob/main/src/assets/logo-dark.png" width="400" height="70" alt="ChartDB">
  </a>
  <br>
</h1>

<p align="center">
  <b>Open-source database diagrams editor</b> <br />
  <b>No installations • No Database password required.</b> <br />
</p>

<h3 align="center">
  <a href="https://discord.gg/QeFwyWSKwC">Community</a>  &bull;
  <a href="https://www.chartdb.io?ref=github_readme">Website</a>  &bull;
  <a href="https://chartdb.io/templates?ref=github_readme">Examples</a>  &bull;
  <a href="https://app.chartdb.io?ref=github_readme">Demo</a>
</h3>

<h4 align="center">
  <a href="https://github.com/chartdb/chartdb?tab=AGPL-3.0-1-ov-file#readme">
    <img src="https://img.shields.io/github/license/chartdb/chartdb?color=blue" alt="ChartDB is released under the AGPL license." />
  </a>
  <a href="https://github.com/chartdb/chartdb/blob/main/CONTRIBUTING.md">
    <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen" alt="PRs welcome!" />
  </a>
  <a href="https://discord.gg/QeFwyWSKwC">
    <img src="https://img.shields.io/discord/1277047413705670678?color=5865F2&label=Discord&logo=discord&logoColor=white" alt="Discord community channel" />
  </a>
  <a href="https://x.com/intent/follow?screen_name=jonathanfishner">
    <img src="https://img.shields.io/twitter/follow/jonathanfishner?style=social"/>
  </a>

</h4>

---

<p align="center">
  <img width='700px' src="./public/chartdb.png">
</p>

### 🎉 ChartDB

ChartDB is a powerful, web-based database diagramming editor.
Instantly visualize your database schema with a single **"Smart Query."** Customize diagrams, export SQL scripts, and access all features—no account required. Experience seamless database design here.

**What it does**:

- **Instant Schema Import**
  Run a single query to instantly retrieve your database schema as JSON. This makes it incredibly fast to visualize your database schema, whether for documentation, team discussions, or simply understanding your data better.

- **AI-Powered Export for Easy Migration**
  Our AI-driven export feature allows you to generate the DDL script in the dialect of your choice. Whether you're migrating from MySQL to PostgreSQL or from SQLite to MariaDB, ChartDB simplifies the process by providing the necessary scripts tailored to your target database.
- **Interactive Editing**
  Fine-tune your database schema using our intuitive editor. Easily make adjustments or annotations to better visualize complex structures.

### Status

ChartDB is currently in Public Beta. Star and watch this repository to get notified of updates.

### Supported Databases

- ✅ PostgreSQL (<img src="./src/assets/postgresql_logo_2.png" width="15"/> + <img src="./src/assets/supabase.png" alt="Supabase" width="15"/> + <img src="./src/assets/timescale.png" alt="Timescale" width="15"/> )
- ✅ MySQL
- ✅ SQL Server
- ✅ MariaDB
- ✅ SQLite (<img src="./src/assets/sqlite_logo_2.png" width="15"/> + <img src="./src/assets/cloudflare_d1.png" alt="Cloudflare D1" width="15"/> Cloudflare D1)
- ✅ CockroachDB
- ✅ ClickHouse

## Getting Started

### Server-backed storage (SQLite)

To store diagrams in a local SQLite database (instead of browser IndexedDB), run the included API server and point the frontend to it.

Dev mode:

- Terminal 1: npm run dev
- Terminal 2: npm run server

By default, the server listens on http://localhost:8080 and creates chartdb.sqlite in the project root. You can optionally split ports by setting FRONTEND_PORT and API_PORT; for example, FRONTEND_PORT=8080 and API_PORT=8081 to serve the UI on 8080 and the API on 8081.

Frontend selection:

- Set VITE_STORAGE_BACKEND=server (recommended) and optionally VITE_API_BASE (e.g., empty to use same origin when served by the server, or "" in dev with proxy).
- The app auto-selects the server backend when VITE_STORAGE_BACKEND=server or when VITE_API_BASE is set.

Prod mode:

- Build the frontend: npm run build
- Start the server (it will serve static files from dist/ and the API): npm run server

Env vars:

- API_PORT: API server port for /api (default 8080 in dev when using same origin)
- FRONTEND_PORT: Frontend static server port (optional; when unset, API serves static as well)
- DB_PATH: path to the SQLite file (default ./chartdb.sqlite)
- STATIC_DIR: directory to serve static files (default ./dist)

Use the [cloud version](https://app.chartdb.io?ref=github_readme_2) or deploy locally:

### How To Use

```bash
npm install
npm run dev
```

### Build

```bash
npm install
npm run build
```

Or like this if you want to have AI capabilities:

```bash
npm install
VITE_OPENAI_API_KEY=<YOUR_OPEN_AI_KEY> npm run build
```

### Run the Docker Container (server + SQLite)

This image runs the Express API and serves the built frontend from the same process.

```bash
# Pull and run published image
# - Maps container port 8080 to host 8080
# - Persists SQLite DB at ./chartdb-data/chartdb.sqlite on the host
# - Optionally pass AI env vars used by /config.js at runtime

docker run \
  -p 8080:8080 \
  -p 8081:8081 \
  -v $(pwd)/chartdb-data:/data \
  -e OPENAI_API_KEY=<YOUR_OPEN_AI_KEY> \
  -e OPENAI_API_ENDPOINT=<YOUR_ENDPOINT> \
  -e LLM_MODEL_NAME=<YOUR_MODEL_NAME> \
  ghcr.io/chartdb/chartdb:latest
```

Env vars (runtime):
- PORT: server port (default 8080)
- DB_PATH: path to the SQLite file inside the container (default /data/chartdb.sqlite)
- STATIC_DIR: directory with built frontend (default /usr/src/app/dist)
- OPENAI_API_KEY, OPENAI_API_ENDPOINT, LLM_MODEL_NAME, HIDE_CHARTDB_CLOUD, DISABLE_ANALYTICS: exposed to the frontend at /config.js

#### Build and Run locally

```bash
# Build with server-backed storage enabled (default)
docker build -t chartdb .

# Run
 docker run \
  -p 8080:8080 \
  -p 8081:8081 \
  -v $(pwd)/chartdb-data:/data \
  -e OPENAI_API_KEY=<YOUR_OPEN_AI_KEY> \
  chartdb
```

#### Using Custom Inference Server

```bash
# Build-time Vite vars (optional, most can be passed at runtime via /config.js)
docker build \
  --build-arg VITE_OPENAI_API_ENDPOINT=<YOUR_ENDPOINT> \
  --build-arg VITE_LLM_MODEL_NAME=<YOUR_MODEL_NAME> \
  -t chartdb .

# Run-time envs passed to /config.js
docker run \
  -e OPENAI_API_ENDPOINT=<YOUR_ENDPOINT> \
  -e LLM_MODEL_NAME=<YOUR_MODEL_NAME> \
  -p 8080:8080 -p 8081:8081 chartdb
```

> **Privacy Note:** ChartDB includes privacy-focused analytics via Fathom Analytics. You can disable this by adding `-e DISABLE_ANALYTICS=true` to the run command or `--build-arg VITE_DISABLE_ANALYTICS=true` when building.

> **Note:** You must configure either Option 1 (OpenAI API key) OR Option 2 (Custom endpoint and model name) for AI capabilities to work. Do not mix the two options.

Open your browser and navigate to `http://localhost:8080` (frontend). The API will be available at `http://localhost:8081` when using split ports.

Example configuration for a local vLLM server:

```bash
VITE_OPENAI_API_ENDPOINT=http://localhost:8000/v1
VITE_LLM_MODEL_NAME=Qwen/Qwen2.5-32B-Instruct-AWQ
```

## Try it on our website

1. Go to [ChartDB.io](https://chartdb.io?ref=github_readme_2)
2. Click "Go to app"
3. Choose the database that you are using.
4. Take the magic query and run it in your database.
5. Copy and paste the resulting JSON set into ChartDB.
6. Enjoy Viewing & Editing!

## 💚 Community & Support

- [Discord](https://discord.gg/QeFwyWSKwC) (For live discussion with the community and the ChartDB team)
- [GitHub Issues](https://github.com/chartdb/chartdb/issues) (For any bugs and errors you encounter using ChartDB)
- [Twitter](https://x.com/intent/follow?screen_name=jonathanfishner) (Get news fast)

## Contributing

We welcome community contributions, big or small, and are here to guide you along
the way. Message us in the [ChartDB Community Discord](https://discord.gg/QeFwyWSKwC).

For more information on how to contribute, please see our
[Contributing Guide](/CONTRIBUTING.md).

This project is released with a [Contributor Code of Conduct](/CODE_OF_CONDUCT.md).
By participating in this project, you agree to follow its terms.

Thank you for helping us make ChartDB better for everyone :heart:.

## License

ChartDB is licensed under the [GNU Affero General Public License v3.0](LICENSE)
