from sqlalchemy import Column, String, JSON, DateTime
from datetime import datetime
from app.db import Base

class Task(Base):
    __tablename__ = "tasks"
    id = Column(String, primary_key=True)
    status = Column(String, default="pending")
    company = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class Result(Base):
    __tablename__ = "results"
    id = Column(String, primary_key=True)
    task_id = Column(String)
    data = Column(JSON)
