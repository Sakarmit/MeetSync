# MeetSync

## Setup Instructions

### Using uv (Recommended)

[Astral's uv](https://docs.astral.sh/uv/) is a tool to manage and run Python applications. This is an external dependency and needs to be [installed](https://docs.astral.sh/uv/getting-started/installation/) separately.

1. Install dependencies and set up the virtual environment:

```shell
uv sync
```

2. Run the application:

```shell
uv run fastapi run
# or, for development with auto-reload
uv run fastapi dev
```

### Using Python + pip

Before running the application, ensure you have Python 3.13 or higher installed, and `pip` is available and up to date.

1. Create and activate a virtual environment:

```shell
python3 -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:

```shell
pip install -r requirements.txt
```

3. Run the application:

```shell
fastapi run
# or, for development with auto-reload
fastapi dev
```

## Running the Application

Once started, the app will be available at [http://localhost:8000](http://localhost:8000) by default.

## Updating 'requirements.txt'

```shell
uv export -o requirements.txt
# or, if not using uv
pip freeze > requirements.txt
```
