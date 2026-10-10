# FaceAttendanceAI

An AI-powered Face Recognition-Based Attendance Management System that combines a web dashboard, a Python backend, a relational database, and a facial recognition pipeline to support student enrollment and attendance management.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Database Migrations](#database-migrations)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Privacy and Security](#privacy-and-security)
- [Limitations](#limitations)
- [License](#license)

## Overview

FaceAttendanceAI is designed to simplify attendance management through facial recognition and a browser-based interface. The application separates the frontend, backend API, database layer, and AI-related processing code into dedicated modules.

The backend provides API routes for student management, face enrollment, class sessions, subjects, attendance records, and attendance statistics. PostgreSQL stores application data, with SQLAlchemy used for database interaction and Alembic used for schema migrations.

The frontend is built with React and Vite and communicates with the backend through HTTP API requests.

## Features

The source tree includes modules for the following capabilities:

- Student management
- Face enrollment and face recognition
- Live face recognition and attendance workflows
- Class session management
- Subject management
- Attendance record retrieval and status management
- Attendance statistics and summaries
- PostgreSQL database integration
- Database schema migrations
- Browser-based dashboard
- AI environment and GPU test scripts

The exact availability of each workflow depends on the application configuration and runtime environment.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, JavaScript, Vite, CSS |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Database migrations | Alembic |
| AI processing | Python-based face encoding and recognition modules |
| AI model compatibility | InsightFace-compatible recognition pipeline |
| GPU acceleration | CUDA, where supported and configured |
| Frontend package management | npm |

## Architecture

The application is organized into four main layers:

1. **Frontend:** React components provide the user interface.
2. **API layer:** FastAPI routes expose student, enrollment, session, subject, attendance, and statistics operations.
3. **Service and database layers:** Application services coordinate operations, while SQLAlchemy models and sessions handle database access.
4. **AI layer:** Face encoding, recognition, and live attendance pipeline modules support the recognition workflow.

## Project Structure

```text
FaceAttendanceAI/
├── ai/
│   ├── enrollment/
│   │   └── face_encoder.py
│   └── pipelines/
│       ├── live_attendance.py
│       └── live_face_recognition.py
├── backend/
│   ├── alembic/
│   │   └── versions/
│   └── app/
│       ├── api/
│       │   ├── attendance.py
│       │   ├── attendance_statistics.py
│       │   ├── class_sessions.py
│       │   ├── face_enrollment.py
│       │   ├── live_attendance.py
│       │   ├── students.py
│       │   └── subjects.py
│       ├── core/
│       ├── database/
│       ├── schemas/
│       ├── services/
│       └── main.py
├── frontend/
│   ├── public/
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       └── styles.css
├── scripts/
│   ├── test_face_ai.py
│   └── test_face_gpu.py
├── .env.example
├── alembic.ini
├── requirements.txt
└── README.md
## Prerequisites

- Python compatible with `requirements.txt`
- Node.js and npm
- PostgreSQL
- Git
- CUDA-compatible hardware and drivers if GPU acceleration is required

## Installation

### Backend setup

From the project root, create and activate a virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Create your local environment file:

```powershell
Copy-Item .env.example .env
```

Edit `.env` with your local database settings. Create the PostgreSQL database before starting the backend.

### Frontend setup

Open a separate terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
```

Check that `VITE_API_BASE_URL` points to the correct backend API URL.

## Configuration

The root `.env.example` contains settings for the application, AI device, recognition thresholds, attendance behavior, database URL, and Redis URL.

The frontend environment example defines `VITE_API_BASE_URL`.

Review `backend/app/core/config.py` to confirm the required settings. Keep real credentials in local `.env` files only.

## Running the Application

### Start the backend

From the project root, with the virtual environment activated:

```powershell
python -m uvicorn backend.app.main:app --reload
```

API documentation, when enabled, is available at http://127.0.0.1:8000/docs.

### Start the frontend

In a separate terminal:

```powershell
cd frontend
npm run dev
```

Open the local URL printed by Vite.

## Database Migrations

The project includes Alembic configuration and an initial migration. Review `alembic.ini`, `backend/alembic/env.py`, and your database settings before applying migrations. Confirm the database exists and back up any important data before modifying a database.

## API Documentation

API route modules are located under `backend/app/api/`:

| Module | Area |
|---|---|
| `students.py` | Student operations |
| `face_enrollment.py` | Face enrollment |
| `live_attendance.py` | Live attendance |
| `attendance.py` | Attendance records |
| `attendance_statistics.py` | Attendance statistics |
| `class_sessions.py` | Class sessions |
| `subjects.py` | Subject operations |

For exact endpoint paths, HTTP methods, request formats, and responses, inspect the route definitions or use the running API documentation at `/docs`.

## Testing

The repository contains AI and GPU test scripts:

```powershell
python scripts/test_face_ai.py
python scripts/test_face_gpu.py
```

A database test script is also present:

```powershell
python test_database.py
```

Run tests in a correctly configured environment.

## Privacy and Security

- Never commit `.env` files, passwords, API keys, or access tokens.
- Do not publish real student photographs, face embeddings, attendance records, or database backups.
- Keep local face data outside Git tracking.
- Use placeholder values in example configuration files.
- Follow applicable privacy and consent requirements for biometric data.
- Review authentication, authorization, data retention, and secure transport before deployment.

## Limitations

Recognition performance depends on image quality, lighting, model configuration, and enrollment quality. GPU acceleration requires compatible hardware, drivers, and libraries. Database configuration and end-to-end functionality must be tested in the target environment before production deployment.

## License

No license has been specified. Do not assume others have permission to redistribute or modify this project until a license is added.