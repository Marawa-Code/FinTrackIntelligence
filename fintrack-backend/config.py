import os
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(Path(__file__).with_name(".env"))

SECTORS_API_KEY = os.getenv("SECTORS_API_KEY")
