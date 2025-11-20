# MeetSync

## Hosted demo

Link (may take a moment to start): https://meetsync-l0t8.onrender.com/

Hosted using [Render](https://render.com/).

## Local setup instructions and dependencies

The only direct Python dependency is `fastapi[standard]` version 0.119. All dependencies (direct and indirect) are listed in `requirements.txt`. All dependencies will be installed automatically when following the setup instructions below.

Two methods are provided to set up and run the application locally: using uv (recommended) or using Python + pip.

Run the commands below from the project's root directory.

### Using uv (recommended)

[Astral's uv](https://docs.astral.sh/uv/) is a tool for managing and running Python applications. This is an external dependency and must be installed separately (see https://docs.astral.sh/uv/getting-started/installation/). The application was developed and tested with uv version 0.9.5, but it may work with other versions that support Python 3.13.

1. Install dependencies and set up the virtual environment:

   ```shell
   uv sync
   ```

2. Run the application:

   ```shell
   uv run fastapi run
   ```

### Using Python + pip

Ensure Python 3.13 (or a compatible 3.x) and pip are installed.

1. Create and activate a virtual environment:

   ```shell
   python -m venv .venv
   ```

   - PowerShell (Windows):

     ```powershell
     .\.venv\Scripts\Activate.ps1
     ```

   - Git Bash (Windows):

     ```bash
     source .venv/Scripts/activate
     ```

   - Bash/Zsh (macOS/Linux):

     ```bash
     source .venv/bin/activate
     ```

   - Or use your preferred method to create and activate a virtual environment.

2. Install dependencies:

   ```shell
   pip install -r requirements.txt
   ```

3. Run the application:

   ```shell
   fastapi run
   ```

## Running the application

Once started, the app will be available at http://localhost:8000 by default. The terminal will display the exact URL to access the app.

## Screenshots

### Initial view

![Program at the Start](screenshots/initial-view.png)

### User editing view

![Individual User Page](screenshots/example-user-schedule.png)

### Error/warning popups

![Error Popup](screenshots/error-popup.png)
![Warning Dialog](screenshots/warning-choice.png)

### Result page

![Result Page](screenshots/result-view.png)

## Folder/file structure

- `templates/` — Jinja templates used to render views (e.g. `main.html.jinja`, `base.html.jinja`, `schedule.html.jinja`).
- `static/` — Frontend assets (styles, scripts, images). Contains CSS under `styles/` and JavaScript (UI and client logic) under `scripts/`.
- `services/` — Backend service modules (e.g. `transformer.py`).
- `templates.py` — Creates the Jinja `templates` object used to render HTML views.
- `main.py` — Application entry/host file (defines the FastAPI app and mounts routes).
- `model.py` — Heuristic model and supporting code used by the scheduler/transformer logic.

## Team members

- Zachery Davis
- Brian Nguyen
- Ethan Pinto
- Smit Sakariya
- Brandon Sheng
