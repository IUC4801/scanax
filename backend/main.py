import os
import json
import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="Scanax Backend")

# Configure CORS to allow requests from VS Code extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is not set. Please create a .env file with your API key.")

genai.configure(api_key=GEMINI_API_KEY)


class CodeAnalysisRequest(BaseModel):
    code: str


class Vulnerability(BaseModel):
    line: int
    message: str
    fix: str


class AnalysisResponse(BaseModel):
    errors: list[Vulnerability]


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_code(request: CodeAnalysisRequest) -> AnalysisResponse:
    """
    Analyze code for security vulnerabilities using Gemini 1.5 Flash.
    """
    if not request.code.strip():
        return AnalysisResponse(errors=[])

    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        prompt = f"""You are a security code analyzer. Analyze the following code for security vulnerabilities.
For each vulnerability found, return a JSON array with this exact format:
[
  {{"line": <line_number>, "message": "<vulnerability_description>", "fix": "<suggested_fix>"}},
  ...
]

Only return the JSON array, no other text.

Code to analyze:
```
{request.code}
```

Important:
1. Line numbers should match the actual line numbers in the code (1-based indexing)
2. Only return JSON, no markdown or explanation
3. If no vulnerabilities found, return an empty array: []"""

        response = model.generate_content(prompt)
        
        # Extract JSON from response
        response_text = response.text.strip()
        
        # Try to find JSON array in the response
        json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
        else:
            json_str = response_text
        
        vulnerabilities = json.loads(json_str)
        
        # Validate and convert to Vulnerability objects
        errors = []
        for vuln in vulnerabilities:
            try:
                errors.append(Vulnerability(
                    line=int(vuln.get("line", 0)),
                    message=str(vuln.get("message", "Unknown vulnerability")),
                    fix=str(vuln.get("fix", "No fix suggested"))
                ))
            except (ValueError, KeyError):
                continue
        
        return AnalysisResponse(errors=errors)
    
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse Gemini response as JSON: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing code: {str(e)}"
        )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
