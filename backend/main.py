import os
import json
import logging
import hashlib
import re
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

app = FastAPI(title="Scanax Professional Security (BYOK)")

# ============================================
# Configuration
# ============================================
GLOBAL_GROQ_KEY = os.getenv("GROQ_API_KEY")
if not GLOBAL_GROQ_KEY:
    raise ValueError("GROQ_API_KEY not found in .env file")

# Using Llama 3.1 8B for high-speed and strict instruction following
MODEL_ID = "llama-3.1-8b-instant"

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

class SurgicalChange(BaseModel):
    search: str
    replace: str

class SurgicalFixResponse(BaseModel):
    changes: list[SurgicalChange]

# ============================================
# Professional Prompts
# ============================================

# Note: Added 'json' to satisfy Groq's response_format requirements
SYSTEM_PROMPT_ANALYZE = """
ACT AS A STATIC ANALYSIS ENGINE (CODEQL STYLE).
Identify security vulnerabilities. Output the results in valid JSON format only.
Structure: {"errors": [{"line": int, "message": string, "fix": string}]}
"""

SYSTEM_PROMPT_FIX = """
ACT AS A PRECISION CODE REPAIR ENGINE.
Output the result in valid JSON format only.

STRATEGY: SURGICAL SNIPPET REPLACEMENT
1. Identify the specific lines of code that constitute the 'Sink' (vulnerability).
2. The "search" string MUST be an EXACT, literal copy of the vulnerable lines from the user's input, including the leading indentation and any comments on those lines.
3. The "replace" string MUST contain the corrected version of ONLY those lines.
4. Do NOT include surrounding function definitions or imports UNLESS they are part of the specific lines being fixed.
5. If a new import is required (e.g., 'import subprocess'), include it at the top of the "replace" string.

REQUIRED JSON STRUCTURE:
{
  "search": "exact_original_snippet",
  "replace": "exact_fixed_snippet"
}
"""

# ============================================
# Endpoints
# ============================================

@app.post("/analyze")
async def analyze_code(request_obj: Request, body: CodeAnalysisRequest):
    if not body.code.strip():
        return {"errors": []}
    
    api_key = body.user_key if body.user_key else GLOBAL_GROQ_KEY
    try:
        groq_client = Groq(api_key=api_key)
        completion = groq_client.chat.completions.create(
            model=MODEL_ID,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_ANALYZE},
                {"role": "user", "content": f"Analyze this code and return json results:\n{body.code}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.0, 
        )
        return json.loads(completion.choices[0].message.content)
    except Exception as e:
        logger.error(f"Analysis Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/fix", response_model=SurgicalFixResponse)
async def fix_vulnerability(request_obj: Request, body: FixRequest):
    if not body.original_code.strip():
        return SurgicalFixResponse(changes=[])
    
    api_key = body.user_key if body.user_key else GLOBAL_GROQ_KEY
    groq_client = Groq(api_key=api_key)
    
    try:
        # Request a Semantic Block Patch
        completion = groq_client.chat.completions.create(
            model=MODEL_ID,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_FIX},
                {"role": "user", "content": f"Provide a fix in json format for this vulnerability: {body.vulnerability_description}\n\nCode Context:\n{body.original_code}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
        )

        raw_content = completion.choices[0].message.content
        # Regex cleanup for extra safety against markdown formatting
        clean_json = re.sub(r'^```json\s*|```$', '', raw_content.strip(), flags=re.MULTILINE)
        result = json.loads(clean_json)

        # Normalize logic: Professional tools handle varied response shapes
        changes = []
        if isinstance(result, dict):
            if "changes" in result:
                changes = result["changes"]
            elif "search" in result and "replace" in result:
                # Map the single object response to our list-based response model
                changes = [{"search": result["search"], "replace": result["replace"]}]

        logger.info(f"Generated semantic patch for: {body.vulnerability_description}")
        return SurgicalFixResponse(changes=changes)

    except Exception as e:
        logger.error(f"Autofix Error: {e}")
        raise HTTPException(status_code=500, detail=f"Semantic Patch Failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)