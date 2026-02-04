from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, dialogs, messages, ws, users
from app.routers import files
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Resonat")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(dialogs.router)
app.include_router(messages.router, prefix="/messages", tags=["messages"])
app.include_router(ws.router)
app.include_router(users.router)
app.include_router(files.router)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")