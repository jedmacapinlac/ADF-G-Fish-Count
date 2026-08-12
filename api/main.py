from fastapi import FastAPI

app = FastAPI()

@app.get("/api/health")
def get_health():
    return {"Health"}

@app.get("/api/locations")
def get_locations():
    return {"Hello": "World"}