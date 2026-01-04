from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List
from models import ProjectStatus, InvoiceStatus

# Auth Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    company_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    company_name: Optional[str]
    avatar_url: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

# Client Schemas
class ClientCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    avatar_color: Optional[str] = "#10B981"

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    avatar_color: Optional[str] = None

class ClientResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str]
    company: Optional[str]
    address: Optional[str]
    notes: Optional[str]
    avatar_color: str
    created_at: datetime
    project_count: Optional[int] = 0
    total_revenue: Optional[float] = 0

    class Config:
        from_attributes = True

# Project Schemas
class TaskCreate(BaseModel):
    title: str

class TaskResponse(BaseModel):
    id: int
    title: str
    completed: int
    created_at: datetime

    class Config:
        from_attributes = True

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    status: Optional[ProjectStatus] = ProjectStatus.PLANNING
    budget: Optional[float] = 0
    deadline: Optional[datetime] = None
    client_id: Optional[int] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    budget: Optional[float] = None
    spent: Optional[float] = None
    deadline: Optional[datetime] = None
    progress: Optional[int] = None
    client_id: Optional[int] = None

class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    status: ProjectStatus
    budget: float
    spent: float
    deadline: Optional[datetime]
    progress: int
    created_at: datetime
    updated_at: datetime
    client_id: Optional[int]
    client_name: Optional[str] = None
    tasks: List[TaskResponse] = []

    class Config:
        from_attributes = True

# Invoice Schemas
class InvoiceCreate(BaseModel):
    amount: float
    due_date: datetime
    description: Optional[str] = None
    client_id: int

class InvoiceUpdate(BaseModel):
    amount: Optional[float] = None
    status: Optional[InvoiceStatus] = None
    due_date: Optional[datetime] = None
    description: Optional[str] = None

class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    amount: float
    status: InvoiceStatus
    due_date: datetime
    paid_date: Optional[datetime]
    description: Optional[str]
    created_at: datetime
    client_id: int
    client_name: Optional[str] = None

    class Config:
        from_attributes = True

# Activity Schemas
class ActivityResponse(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_name: str
    details: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# Dashboard Schemas
class DashboardStats(BaseModel):
    total_revenue: float
    pending_invoices: float
    active_projects: int
    total_clients: int
    revenue_change: float
    projects_change: int
    monthly_revenue: List[dict]
    project_status_distribution: List[dict]
    recent_activities: List[ActivityResponse]
