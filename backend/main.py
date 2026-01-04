from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List
import random

from database import engine, get_db, Base
from config import settings
from seed import seed_database
import models
import schemas
from auth import (
    get_password_hash,
    create_access_token,
    authenticate_user,
    get_current_user
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables and seed data
    Base.metadata.create_all(bind=engine)
    seed_database()
    yield
    # Shutdown: cleanup if needed
    pass


app = FastAPI(
    title=settings.APP_NAME,
    description="A professional client management and project tracking API",
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper function to log activity
def log_activity(db: Session, user_id: int, action: str, entity_type: str, entity_name: str, details: str = None):
    activity = models.Activity(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_name=entity_name,
        details=details
    )
    db.add(activity)
    db.commit()

# ==================== AUTH ROUTES ====================

@app.post("/api/auth/register", response_model=schemas.Token)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if user exists
    existing_user = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create new user
    db_user = models.User(
        email=user.email,
        hashed_password=get_password_hash(user.password),
        full_name=user.full_name,
        company_name=user.company_name
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Create access token
    access_token = create_access_token(data={"sub": str(db_user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user

# ==================== CLIENT ROUTES ====================

@app.get("/api/clients", response_model=List[schemas.ClientResponse])
def get_clients(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    clients = db.query(models.Client).filter(models.Client.owner_id == current_user.id).all()
    result = []
    for client in clients:
        project_count = db.query(models.Project).filter(models.Project.client_id == client.id).count()
        total_revenue = db.query(func.sum(models.Invoice.amount)).filter(
            models.Invoice.client_id == client.id,
            models.Invoice.status == models.InvoiceStatus.PAID
        ).scalar() or 0

        client_dict = {
            **client.__dict__,
            "project_count": project_count,
            "total_revenue": total_revenue
        }
        result.append(schemas.ClientResponse(**client_dict))
    return result

@app.post("/api/clients", response_model=schemas.ClientResponse)
def create_client(
    client: schemas.ClientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_client = models.Client(**client.model_dump(), owner_id=current_user.id)
    db.add(db_client)
    db.commit()
    db.refresh(db_client)

    log_activity(db, current_user.id, "created", "client", client.name)

    return schemas.ClientResponse(**db_client.__dict__, project_count=0, total_revenue=0)

@app.get("/api/clients/{client_id}", response_model=schemas.ClientResponse)
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    client = db.query(models.Client).filter(
        models.Client.id == client_id,
        models.Client.owner_id == current_user.id
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    project_count = db.query(models.Project).filter(models.Project.client_id == client.id).count()
    total_revenue = db.query(func.sum(models.Invoice.amount)).filter(
        models.Invoice.client_id == client.id,
        models.Invoice.status == models.InvoiceStatus.PAID
    ).scalar() or 0

    return schemas.ClientResponse(**client.__dict__, project_count=project_count, total_revenue=total_revenue)

@app.put("/api/clients/{client_id}", response_model=schemas.ClientResponse)
def update_client(
    client_id: int,
    client_update: schemas.ClientUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    client = db.query(models.Client).filter(
        models.Client.id == client_id,
        models.Client.owner_id == current_user.id
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    for key, value in client_update.model_dump(exclude_unset=True).items():
        setattr(client, key, value)

    db.commit()
    db.refresh(client)

    log_activity(db, current_user.id, "updated", "client", client.name)

    project_count = db.query(models.Project).filter(models.Project.client_id == client.id).count()
    total_revenue = db.query(func.sum(models.Invoice.amount)).filter(
        models.Invoice.client_id == client.id,
        models.Invoice.status == models.InvoiceStatus.PAID
    ).scalar() or 0

    return schemas.ClientResponse(**client.__dict__, project_count=project_count, total_revenue=total_revenue)

@app.delete("/api/clients/{client_id}")
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    client = db.query(models.Client).filter(
        models.Client.id == client_id,
        models.Client.owner_id == current_user.id
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    client_name = client.name
    db.delete(client)
    db.commit()

    log_activity(db, current_user.id, "deleted", "client", client_name)

    return {"message": "Client deleted successfully"}

# ==================== PROJECT ROUTES ====================

@app.get("/api/projects", response_model=List[schemas.ProjectResponse])
def get_projects(
    status: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Project).filter(models.Project.owner_id == current_user.id)
    if status:
        query = query.filter(models.Project.status == status)

    projects = query.all()
    result = []
    for project in projects:
        client_name = None
        if project.client_id:
            client = db.query(models.Client).filter(models.Client.id == project.client_id).first()
            client_name = client.name if client else None

        tasks = db.query(models.Task).filter(models.Task.project_id == project.id).all()

        result.append(schemas.ProjectResponse(
            **project.__dict__,
            client_name=client_name,
            tasks=[schemas.TaskResponse(**t.__dict__) for t in tasks]
        ))
    return result

@app.post("/api/projects", response_model=schemas.ProjectResponse)
def create_project(
    project: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_project = models.Project(**project.model_dump(), owner_id=current_user.id)
    db.add(db_project)
    db.commit()
    db.refresh(db_project)

    log_activity(db, current_user.id, "created", "project", project.name)

    client_name = None
    if db_project.client_id:
        client = db.query(models.Client).filter(models.Client.id == db_project.client_id).first()
        client_name = client.name if client else None

    return schemas.ProjectResponse(**db_project.__dict__, client_name=client_name, tasks=[])

@app.get("/api/projects/{project_id}", response_model=schemas.ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    client_name = None
    if project.client_id:
        client = db.query(models.Client).filter(models.Client.id == project.client_id).first()
        client_name = client.name if client else None

    tasks = db.query(models.Task).filter(models.Task.project_id == project.id).all()

    return schemas.ProjectResponse(
        **project.__dict__,
        client_name=client_name,
        tasks=[schemas.TaskResponse(**t.__dict__) for t in tasks]
    )

@app.put("/api/projects/{project_id}", response_model=schemas.ProjectResponse)
def update_project(
    project_id: int,
    project_update: schemas.ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for key, value in project_update.model_dump(exclude_unset=True).items():
        setattr(project, key, value)

    db.commit()
    db.refresh(project)

    log_activity(db, current_user.id, "updated", "project", project.name)

    client_name = None
    if project.client_id:
        client = db.query(models.Client).filter(models.Client.id == project.client_id).first()
        client_name = client.name if client else None

    tasks = db.query(models.Task).filter(models.Task.project_id == project.id).all()

    return schemas.ProjectResponse(
        **project.__dict__,
        client_name=client_name,
        tasks=[schemas.TaskResponse(**t.__dict__) for t in tasks]
    )

@app.delete("/api/projects/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project_name = project.name
    db.delete(project)
    db.commit()

    log_activity(db, current_user.id, "deleted", "project", project_name)

    return {"message": "Project deleted successfully"}

# Task routes
@app.post("/api/projects/{project_id}/tasks", response_model=schemas.TaskResponse)
def create_task(
    project_id: int,
    task: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db_task = models.Task(**task.model_dump(), project_id=project_id)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    return schemas.TaskResponse(**db_task.__dict__)

@app.put("/api/tasks/{task_id}/toggle")
def toggle_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    task = db.query(models.Task).join(models.Project).filter(
        models.Task.id == task_id,
        models.Project.owner_id == current_user.id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.completed = 0 if task.completed else 1

    # Update project progress
    project = task.project
    all_tasks = db.query(models.Task).filter(models.Task.project_id == project.id).all()
    if all_tasks:
        completed = sum(1 for t in all_tasks if t.completed)
        project.progress = int((completed / len(all_tasks)) * 100)

    db.commit()

    return {"completed": task.completed, "project_progress": project.progress}

@app.delete("/api/tasks/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    task = db.query(models.Task).join(models.Project).filter(
        models.Task.id == task_id,
        models.Project.owner_id == current_user.id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    project = task.project
    db.delete(task)

    # Update project progress
    all_tasks = db.query(models.Task).filter(models.Task.project_id == project.id).all()
    if all_tasks:
        completed = sum(1 for t in all_tasks if t.completed)
        project.progress = int((completed / len(all_tasks)) * 100)
    else:
        project.progress = 0

    db.commit()

    return {"message": "Task deleted successfully"}

# ==================== INVOICE ROUTES ====================

@app.get("/api/invoices", response_model=List[schemas.InvoiceResponse])
def get_invoices(
    status: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Invoice).filter(models.Invoice.owner_id == current_user.id)
    if status:
        query = query.filter(models.Invoice.status == status)

    invoices = query.order_by(models.Invoice.created_at.desc()).all()
    result = []
    for invoice in invoices:
        client = db.query(models.Client).filter(models.Client.id == invoice.client_id).first()
        result.append(schemas.InvoiceResponse(
            **invoice.__dict__,
            client_name=client.name if client else None
        ))
    return result

@app.post("/api/invoices", response_model=schemas.InvoiceResponse)
def create_invoice(
    invoice: schemas.InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Generate invoice number
    count = db.query(models.Invoice).filter(models.Invoice.owner_id == current_user.id).count()
    invoice_number = f"INV-{datetime.now().year}-{str(count + 1).zfill(4)}"

    db_invoice = models.Invoice(
        **invoice.model_dump(),
        invoice_number=invoice_number,
        owner_id=current_user.id
    )
    db.add(db_invoice)
    db.commit()
    db.refresh(db_invoice)

    client = db.query(models.Client).filter(models.Client.id == invoice.client_id).first()
    log_activity(db, current_user.id, "created", "invoice", invoice_number, f"${invoice.amount}")

    return schemas.InvoiceResponse(**db_invoice.__dict__, client_name=client.name if client else None)

@app.put("/api/invoices/{invoice_id}", response_model=schemas.InvoiceResponse)
def update_invoice(
    invoice_id: int,
    invoice_update: schemas.InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.owner_id == current_user.id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    update_data = invoice_update.model_dump(exclude_unset=True)

    # If marking as paid, set paid_date
    if update_data.get("status") == models.InvoiceStatus.PAID and not invoice.paid_date:
        update_data["paid_date"] = datetime.utcnow()

    for key, value in update_data.items():
        setattr(invoice, key, value)

    db.commit()
    db.refresh(invoice)

    client = db.query(models.Client).filter(models.Client.id == invoice.client_id).first()
    log_activity(db, current_user.id, "updated", "invoice", invoice.invoice_number)

    return schemas.InvoiceResponse(**invoice.__dict__, client_name=client.name if client else None)

@app.delete("/api/invoices/{invoice_id}")
def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.owner_id == current_user.id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice_number = invoice.invoice_number
    db.delete(invoice)
    db.commit()

    log_activity(db, current_user.id, "deleted", "invoice", invoice_number)

    return {"message": "Invoice deleted successfully"}

# ==================== DASHBOARD ROUTES ====================

@app.get("/api/dashboard", response_model=schemas.DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Total revenue (paid invoices)
    total_revenue = db.query(func.sum(models.Invoice.amount)).filter(
        models.Invoice.owner_id == current_user.id,
        models.Invoice.status == models.InvoiceStatus.PAID
    ).scalar() or 0

    # Pending invoices amount
    pending_invoices = db.query(func.sum(models.Invoice.amount)).filter(
        models.Invoice.owner_id == current_user.id,
        models.Invoice.status.in_([models.InvoiceStatus.SENT, models.InvoiceStatus.DRAFT])
    ).scalar() or 0

    # Active projects count
    active_projects = db.query(models.Project).filter(
        models.Project.owner_id == current_user.id,
        models.Project.status.in_([models.ProjectStatus.IN_PROGRESS, models.ProjectStatus.REVIEW])
    ).count()

    # Total clients
    total_clients = db.query(models.Client).filter(
        models.Client.owner_id == current_user.id
    ).count()

    # Monthly revenue (last 6 months) - simulated for demo
    months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly_revenue = [
        {"month": month, "revenue": random.randint(5000, 25000)}
        for month in months
    ]

    # Project status distribution
    status_counts = db.query(
        models.Project.status,
        func.count(models.Project.id)
    ).filter(
        models.Project.owner_id == current_user.id
    ).group_by(models.Project.status).all()

    status_colors = {
        "planning": "#6366F1",
        "in_progress": "#10B981",
        "review": "#F59E0B",
        "completed": "#3B82F6",
        "on_hold": "#EF4444"
    }

    project_status_distribution = [
        {"status": status.value, "count": count, "color": status_colors.get(status.value, "#6B7280")}
        for status, count in status_counts
    ]

    # Recent activities
    activities = db.query(models.Activity).filter(
        models.Activity.user_id == current_user.id
    ).order_by(models.Activity.created_at.desc()).limit(10).all()

    return schemas.DashboardStats(
        total_revenue=total_revenue,
        pending_invoices=pending_invoices,
        active_projects=active_projects,
        total_clients=total_clients,
        revenue_change=12.5,
        projects_change=3,
        monthly_revenue=monthly_revenue,
        project_status_distribution=project_status_distribution,
        recent_activities=[schemas.ActivityResponse(**a.__dict__) for a in activities]
    )

# ==================== SEED DATA ====================

@app.post("/api/seed")
def seed_data(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Seed demo data for the current user"""

    # Create sample clients
    clients_data = [
        {"name": "Acme Corporation", "email": "contact@acme.com", "company": "Acme Corp", "avatar_color": "#10B981"},
        {"name": "TechStart Inc", "email": "hello@techstart.io", "company": "TechStart", "avatar_color": "#6366F1"},
        {"name": "Design Studio", "email": "info@designstudio.com", "company": "Design Studio", "avatar_color": "#F59E0B"},
        {"name": "Global Services", "email": "contact@globalservices.com", "company": "Global Services Ltd", "avatar_color": "#EF4444"},
    ]

    created_clients = []
    for client_data in clients_data:
        client = models.Client(**client_data, owner_id=current_user.id)
        db.add(client)
        db.commit()
        db.refresh(client)
        created_clients.append(client)

    # Create sample projects
    projects_data = [
        {"name": "E-commerce Platform", "description": "Full-stack e-commerce solution", "status": models.ProjectStatus.IN_PROGRESS, "budget": 15000, "spent": 8500, "progress": 65, "client_id": created_clients[0].id},
        {"name": "Mobile App Redesign", "description": "UI/UX overhaul for mobile application", "status": models.ProjectStatus.REVIEW, "budget": 8000, "spent": 7200, "progress": 90, "client_id": created_clients[1].id},
        {"name": "API Integration", "description": "Third-party API integration project", "status": models.ProjectStatus.PLANNING, "budget": 5000, "spent": 0, "progress": 10, "client_id": created_clients[2].id},
        {"name": "Dashboard Analytics", "description": "Business intelligence dashboard", "status": models.ProjectStatus.IN_PROGRESS, "budget": 12000, "spent": 4000, "progress": 35, "client_id": created_clients[0].id},
        {"name": "Brand Website", "description": "Corporate website redesign", "status": models.ProjectStatus.COMPLETED, "budget": 6000, "spent": 5800, "progress": 100, "client_id": created_clients[3].id},
    ]

    created_projects = []
    for project_data in projects_data:
        project = models.Project(**project_data, owner_id=current_user.id)
        db.add(project)
        db.commit()
        db.refresh(project)
        created_projects.append(project)

    # Create sample invoices
    invoices_data = [
        {"invoice_number": "INV-2024-0001", "amount": 5000, "status": models.InvoiceStatus.PAID, "client_id": created_clients[0].id, "due_date": datetime.now() - timedelta(days=30), "paid_date": datetime.now() - timedelta(days=25)},
        {"invoice_number": "INV-2024-0002", "amount": 3500, "status": models.InvoiceStatus.PAID, "client_id": created_clients[1].id, "due_date": datetime.now() - timedelta(days=15), "paid_date": datetime.now() - timedelta(days=10)},
        {"invoice_number": "INV-2024-0003", "amount": 7200, "status": models.InvoiceStatus.SENT, "client_id": created_clients[0].id, "due_date": datetime.now() + timedelta(days=15)},
        {"invoice_number": "INV-2024-0004", "amount": 2500, "status": models.InvoiceStatus.DRAFT, "client_id": created_clients[2].id, "due_date": datetime.now() + timedelta(days=30)},
        {"invoice_number": "INV-2024-0005", "amount": 4800, "status": models.InvoiceStatus.OVERDUE, "client_id": created_clients[3].id, "due_date": datetime.now() - timedelta(days=5)},
    ]

    for invoice_data in invoices_data:
        invoice = models.Invoice(**invoice_data, owner_id=current_user.id)
        db.add(invoice)

    # Create sample activities
    activities_data = [
        {"action": "created", "entity_type": "project", "entity_name": "E-commerce Platform"},
        {"action": "updated", "entity_type": "invoice", "entity_name": "INV-2024-0001", "details": "Marked as paid"},
        {"action": "created", "entity_type": "client", "entity_name": "Acme Corporation"},
        {"action": "updated", "entity_type": "project", "entity_name": "Mobile App Redesign", "details": "Status changed to Review"},
        {"action": "created", "entity_type": "invoice", "entity_name": "INV-2024-0003"},
    ]

    for i, activity_data in enumerate(activities_data):
        activity = models.Activity(
            **activity_data,
            user_id=current_user.id,
            created_at=datetime.now() - timedelta(hours=i*2)
        )
        db.add(activity)

    db.commit()

    return {"message": "Demo data seeded successfully"}

@app.get("/api/health")
def health_check():
    """Health check endpoint for Docker/k8s"""
    return {"status": "healthy", "app": settings.APP_NAME, "version": settings.APP_VERSION}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
