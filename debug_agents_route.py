import json
from backend.routes.agents import agents

r = agents()
print(json.dumps(r, indent=2))
