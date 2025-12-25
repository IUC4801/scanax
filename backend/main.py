import os
import json
import logging
from fastapi import FastAPI, HTTPException
from groq import Groq
from dotenv import load_dotenv

# Load variables from .env
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ScanaxGroqOnly")

app = FastAPI(title="Scanax Groq-Powered Security")

# Initialize Groq Client
# Ensure GROQ_API_KEY is in your .env file
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Production Model ID for Late 2025
MODEL_ID = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """
ACT AS A SENIOR SECURITY ENGINEER.
Your task is to analyze the provided code for security vulnerabilities (SQL Injection, XSS, Hardcoded Secrets, etc.).

OUTPUT RULES:
1. Return ONLY a JSON object.
2. The object must contain a key "errors" which is an array of objects.
3. Each error object must have: "line" (number), "message" (string), and "fix" (string).

FORMAT EXAMPLE:
{
  "errors": [
    {"line": 5, "message": "Hardcoded API Key", "fix": "const key = process.env.API_KEY;"}
  ]
}
"""

@app.post("/analyze")
async def analyze_code(request: dict):
    code = request.get("code", "")
    if not code.strip():
        return {"errors": []}

    try:
        logger.info(f"Sending request to Groq ({MODEL_ID})...")
        
        # chat.completions.create is synchronous, but Groq is so fast it won't block 
        # for long. For higher scale, wrap in run_in_executor.
        completion = client.chat.completions.create(
            model=MODEL_ID,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Analyze this code:\n\n{code}"}
            ],
            # JSON Mode ensures we get a valid JSON object back
            response_format={"type": "json_object"},
            temperature=0.2, # Lower temperature = more consistent security analysis
        )

        # Parse and return
        raw_content = completion.choices[0].message.content
        result = json.loads(raw_content)
        
        # Extract the errors list
        errors = result.get("errors", [])
        logger.info(f"Analysis successful. Found {len(errors)} potential issues.")
        
        return {"errors": errors}

    except Exception as e:
        logger.error(f"Groq API Error: {str(e)}")
        if "429" in str(e):
            raise HTTPException(status_code=429, detail="Groq rate limit hit. Please wait a moment.")
        raise HTTPException(status_code=500, detail="Internal analysis failure.")

@app.get("/health")
async def health():
    return {"status": "active", "engine": "Groq Llama-3.3"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)