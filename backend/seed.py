"""
Database seeder - Creates demo user and data on startup
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from auth import get_password_hash
import models

# Demo user credentials
DEMO_EMAIL = "demo@nexus.com"
DEMO_PASSWORD = "demo123"
DEMO_NAME = "Demo User"
DEMO_COMPANY = "Nexus Demo"


def seed_database():
    """Seed database with demo data if empty"""

    # Create tables
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        # Check if demo user exists
        existing_user = db.query(models.User).filter(models.User.email == DEMO_EMAIL).first()

        if existing_user:
            print(f"Demo user already exists: {DEMO_EMAIL}")
            return

        print("Seeding database with demo data...")

        # Create demo user
        demo_user = models.User(
            email=DEMO_EMAIL,
            hashed_password=get_password_hash(DEMO_PASSWORD),
            full_name=DEMO_NAME,
            company_name=DEMO_COMPANY
        )
        db.add(demo_user)
        db.commit()
        db.refresh(demo_user)

        print(f"Created demo user: {DEMO_EMAIL} / {DEMO_PASSWORD}")

        # Create sample clients
        clients_data = [
            {"name": "Acme Corporation", "email": "contact@acme.com", "company": "Acme Corp", "phone": "+1 555-0101", "avatar_color": "#10B981"},
            {"name": "TechStart Inc", "email": "hello@techstart.io", "company": "TechStart", "phone": "+1 555-0102", "avatar_color": "#6366F1"},
            {"name": "Design Studio", "email": "info@designstudio.com", "company": "Design Studio", "phone": "+1 555-0103", "avatar_color": "#F59E0B"},
            {"name": "Global Services", "email": "contact@globalservices.com", "company": "Global Services Ltd", "phone": "+1 555-0104", "avatar_color": "#EF4444"},
            {"name": "StartupXYZ", "email": "team@startupxyz.com", "company": "StartupXYZ", "phone": "+1 555-0105", "avatar_color": "#8B5CF6"},
        ]

        created_clients = []
        for client_data in clients_data:
            client = models.Client(**client_data, owner_id=demo_user.id)
            db.add(client)
            db.commit()
            db.refresh(client)
            created_clients.append(client)

        print(f"Created {len(created_clients)} clients")

        # Create sample projects
        projects_data = [
            {"name": "E-commerce Platform", "description": "Full-stack e-commerce solution with React and FastAPI", "status": models.ProjectStatus.IN_PROGRESS, "budget": 15000, "spent": 8500, "progress": 65, "client_id": created_clients[0].id, "deadline": datetime.now() + timedelta(days=30)},
            {"name": "Mobile App Redesign", "description": "UI/UX overhaul for iOS and Android application", "status": models.ProjectStatus.REVIEW, "budget": 8000, "spent": 7200, "progress": 90, "client_id": created_clients[1].id, "deadline": datetime.now() + timedelta(days=7)},
            {"name": "API Integration", "description": "Third-party API integration with payment gateways", "status": models.ProjectStatus.PLANNING, "budget": 5000, "spent": 0, "progress": 10, "client_id": created_clients[2].id, "deadline": datetime.now() + timedelta(days=45)},
            {"name": "Dashboard Analytics", "description": "Business intelligence dashboard with real-time metrics", "status": models.ProjectStatus.IN_PROGRESS, "budget": 12000, "spent": 4000, "progress": 35, "client_id": created_clients[0].id, "deadline": datetime.now() + timedelta(days=60)},
            {"name": "Brand Website", "description": "Corporate website redesign with CMS", "status": models.ProjectStatus.COMPLETED, "budget": 6000, "spent": 5800, "progress": 100, "client_id": created_clients[3].id, "deadline": datetime.now() - timedelta(days=10)},
            {"name": "CRM System", "description": "Custom CRM system for sales team", "status": models.ProjectStatus.IN_PROGRESS, "budget": 20000, "spent": 12000, "progress": 55, "client_id": created_clients[4].id, "deadline": datetime.now() + timedelta(days=90)},
        ]

        created_projects = []
        for project_data in projects_data:
            project = models.Project(**project_data, owner_id=demo_user.id)
            db.add(project)
            db.commit()
            db.refresh(project)
            created_projects.append(project)

        print(f"Created {len(created_projects)} projects")

        # Create sample invoices
        invoices_data = [
            {"invoice_number": "INV-2024-0001", "amount": 5000, "status": models.InvoiceStatus.PAID, "client_id": created_clients[0].id, "due_date": datetime.now() - timedelta(days=30), "paid_date": datetime.now() - timedelta(days=25), "description": "E-commerce Platform - Phase 1"},
            {"invoice_number": "INV-2024-0002", "amount": 3500, "status": models.InvoiceStatus.PAID, "client_id": created_clients[1].id, "due_date": datetime.now() - timedelta(days=15), "paid_date": datetime.now() - timedelta(days=10), "description": "Mobile App - Initial Design"},
            {"invoice_number": "INV-2024-0003", "amount": 7200, "status": models.InvoiceStatus.SENT, "client_id": created_clients[0].id, "due_date": datetime.now() + timedelta(days=15), "description": "E-commerce Platform - Phase 2"},
            {"invoice_number": "INV-2024-0004", "amount": 2500, "status": models.InvoiceStatus.DRAFT, "client_id": created_clients[2].id, "due_date": datetime.now() + timedelta(days=30), "description": "API Integration - Setup"},
            {"invoice_number": "INV-2024-0005", "amount": 4800, "status": models.InvoiceStatus.OVERDUE, "client_id": created_clients[3].id, "due_date": datetime.now() - timedelta(days=5), "description": "Brand Website - Final Payment"},
            {"invoice_number": "INV-2024-0006", "amount": 10000, "status": models.InvoiceStatus.SENT, "client_id": created_clients[4].id, "due_date": datetime.now() + timedelta(days=20), "description": "CRM System - Milestone 1"},
            {"invoice_number": "INV-2024-0007", "amount": 3000, "status": models.InvoiceStatus.PAID, "client_id": created_clients[1].id, "due_date": datetime.now() - timedelta(days=45), "paid_date": datetime.now() - timedelta(days=40), "description": "Mobile App - Consultation"},
        ]

        for invoice_data in invoices_data:
            invoice = models.Invoice(**invoice_data, owner_id=demo_user.id)
            db.add(invoice)

        db.commit()
        print(f"Created {len(invoices_data)} invoices")

        # Create sample activities
        activities_data = [
            {"action": "created", "entity_type": "project", "entity_name": "E-commerce Platform", "created_at": datetime.now() - timedelta(hours=2)},
            {"action": "updated", "entity_type": "invoice", "entity_name": "INV-2024-0001", "details": "Marked as paid", "created_at": datetime.now() - timedelta(hours=4)},
            {"action": "created", "entity_type": "client", "entity_name": "Acme Corporation", "created_at": datetime.now() - timedelta(hours=6)},
            {"action": "updated", "entity_type": "project", "entity_name": "Mobile App Redesign", "details": "Status changed to Review", "created_at": datetime.now() - timedelta(hours=8)},
            {"action": "created", "entity_type": "invoice", "entity_name": "INV-2024-0003", "created_at": datetime.now() - timedelta(hours=10)},
            {"action": "created", "entity_type": "project", "entity_name": "CRM System", "created_at": datetime.now() - timedelta(hours=12)},
            {"action": "updated", "entity_type": "project", "entity_name": "Brand Website", "details": "Marked as completed", "created_at": datetime.now() - timedelta(hours=24)},
            {"action": "created", "entity_type": "client", "entity_name": "StartupXYZ", "created_at": datetime.now() - timedelta(hours=48)},
        ]

        for activity_data in activities_data:
            activity = models.Activity(**activity_data, user_id=demo_user.id)
            db.add(activity)

        db.commit()
        print(f"Created {len(activities_data)} activities")

        print("\n" + "="*50)
        print("DATABASE SEEDED SUCCESSFULLY!")
        print("="*50)
        print(f"Demo Login: {DEMO_EMAIL} / {DEMO_PASSWORD}")
        print("="*50 + "\n")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
