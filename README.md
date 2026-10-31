# Odoo-x-Make-A-Ton-9.0-Kochi-Hackathon-2026

## Backend setup

From the repository root, go to `backend`, create and activate a Python virtual environment, and install `requirements.txt`. Copy `.env.example` to `.env`, set a private `JWT_SECRET` and local admin credentials, then run `python -m scripts.seed_admin` and `python seed.py`. Start the API with `uvicorn app.main:app --reload`. API docs are at http://127.0.0.1:8000/docs.
