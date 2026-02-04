# app/init_db.py
from .db import Base, engine
from . import models

def init_db():
    Base.metadata.create_all(bind=engine)
