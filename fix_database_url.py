
from getpass import getpass
from pathlib import Path
from sqlalchemy.engine import URL
import re

env_path = Path(".env")

if not env_path.exists():
    raise SystemExit("ERROR: .env file not found in the project root.")

password = getpass("Enter your PostgreSQL password (input stays hidden): ")

url = URL.create(
    drivername="postgresql+psycopg",
    username="postgres",
    password=password,
    host="localhost",
    port=5432,
    database="face_attendance",
)

encoded_url = url.render_as_string(hide_password=False)

content = env_path.read_text(encoding="utf-8")

if re.search(r"(?m)^DATABASE_URL\s*=", content):
    content = re.sub(
        r"(?m)^DATABASE_URL\s*=.*$",
        lambda match: "DATABASE_URL=" + encoded_url,
        content,
    )
else:
    content += "\nDATABASE_URL=" + encoded_url + "\n"

env_path.write_text(content, encoding="utf-8")
print("Database URL updated successfully. Password was not displayed.")
