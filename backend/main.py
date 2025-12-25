import os
import json
import logging
import hashlib
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Request
from groq import Groq
from dotenv import load_dotenv
from pydantic import BaseModel

# Load variables from .env
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ScanaxGroqOnly")

app = FastAPI(title="Scanax Groq-Powered Security (BYOK)")

# ============================================
# Configuration
# ============================================
GLOBAL_GROQ_KEY = os.getenv("GROQ_API_KEY")
if not GLOBAL_GROQ_KEY:
    raise ValueError("GROQ_API_KEY not found in .env file")

MODEL_ID = "llama-3.3-70b-versatile"

# ============================================
# Rate Limiting & Caching
# ============================================
analysis_cache = {}  
CACHE_TTL_MINUTES = int(os.getenv("CACHE_TTL_MINUTES", "60"))

# ============================================
# Data Models
# ============================================
class CodeAnalysisRequest(BaseModel):
    code: str
    user_key: str | None = None

class FixRequest(BaseModel):
    original_code: str
    vulnerability_description: str
    user_key: str | None = None
    vulnerability_line: int | None = None

class Vulnerability(BaseModel):
    line: int
    message: str
    fix: str

class AnalysisResponse(BaseModel):
    errors: list[Vulnerability]

class SurgicalChange(BaseModel):
    search: str
    replace: str

class SurgicalFixResponse(BaseModel):
    changes: list[SurgicalChange]

# ============================================
# Helper Functions
# ============================================

def get_code_hash(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()

def is_cached(code_hash: str) -> bool:
    if code_hash not in analysis_cache:
        return False
    cached_time = analysis_cache[code_hash]["timestamp"]
    if datetime.now() - cached_time > timedelta(minutes=CACHE_TTL_MINUTES):
        del analysis_cache[code_hash]
        return False
    return True

def get_cached_result(code_hash: str):
    if is_cached(code_hash):
        return analysis_cache[code_hash]["result"]
    return None

def cache_result(code_hash: str, result):
    analysis_cache[code_hash] = {
        "result": result,
        "timestamp": datetime.now()
    }

# ============================================
# Prompts
# ============================================

SYSTEM_PROMPT_ANALYZE = """
ACT AS A SENIOR SECURITY ENGINEER.
Analyze code for vulnerabilities (SQLi, XSS, etc.).
OUTPUT RULES:
1. Return ONLY valid JSON.
2. Object must have key "errors" containing an array.
3. Each error has: "line" (int), "message" (string), "fix" (string).
"""

SYSTEM_PROMPT_FIX = """
ACT AS A SENIOR SECURITY ENGINEER.
Provide a SURGICAL fix for the security vulnerability.

RULES:
1. Return ONLY valid JSON.
2. The JSON must have a "changes" key containing an array of objects.
3. Each object must have "search" (the exact vulnerable snippet) and "replace" (the fixed version).
4. The "search" string MUST exist EXACTLY as-is in the provided code (including indentation).
5. Only include the minimal code block needed for the fix.
6. If the fix requires a new import, add a separate change object for it.

FORMAT EXAMPLE:
{
  "changes": [
    {
      "search": "db.query('SELECT * FROM users WHERE id = ' + id)",
      "replace": "db.query('SELECT * FROM users WHERE id = ?', [id])"
    }
  ]
}
"""

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_code(request_obj: Request, body: CodeAnalysisRequest):
    client_ip = request_obj.client.host if request_obj.client else "unknown"
    if not body.code.strip():
        return AnalysisResponse(errors=[])
    
    code_hash = get_code_hash(body.code)
    cached_result = get_cached_result(code_hash)
    if cached_result is not None:
        return AnalysisResponse(errors=cached_result)
    
    api_key = body.user_key if body.user_key else GLOBAL_GROQ_KEY
    
    try:
        groq_client = Groq(api_key=api_key)
        completion = groq_client.chat.completions.create(
            model=MODEL_ID,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_ANALYZE},
                {"role": "user", "content": f"Analyze this code:\n\n{body.code}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )

        result = json.loads(completion.choices[0].message.content)
        vulnerabilities = [Vulnerability(**e) for e in result.get("errors", [])]
        cache_result(code_hash, vulnerabilities)
        return AnalysisResponse(errors=vulnerabilities)

    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/fix", response_model=SurgicalFixResponse)
async def fix_vulnerability(request_obj: Request, body: FixRequest):
    """Generates a surgical search-and-replace fix instead of a full file replacement."""
    if not body.original_code.strip():
        return SurgicalFixResponse(changes=[])
    
    api_key = body.user_key if body.user_key else GLOBAL_GROQ_KEY
    
    try:
        groq_client = Groq(api_key=api_key)
        
        line_ctx = f" (specifically around line {body.vulnerability_line})" if body.vulnerability_line else ""
        user_message = f"Vulnerability: {body.vulnerability_description}{line_ctx}\n\nCode:\n{body.original_code}"
        
        completion = groq_client.chat.completions.create(
            model=MODEL_ID,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_FIX},
                {"role": "user", "content": user_message}
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )

        result = json.loads(completion.choices[0].message.content)
        return SurgicalFixResponse(changes=result.get("changes", []))

    except Exception as e:
        logger.error(f"Fix generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "active", "byok_enabled": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)