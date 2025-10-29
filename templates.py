from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory="templates", trim_blocks=True, lstrip_blocks=True)
