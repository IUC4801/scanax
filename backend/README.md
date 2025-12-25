# Scanax Backend

A FastAPI-based security code analyzer backend that uses Google's Gemini 1.5 Flash to identify vulnerabilities in code.

## Setup

1. **Create a virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables:**
   - Copy `.env.example` to `.env`
   - Add your Gemini API key to `.env`:
     ```
     GEMINI_API_KEY=your_actual_api_key_here
     ```
   - Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

4. **Run the server:**
   ```bash
   python3 main.py
   ```
   
   The server will start on `http://localhost:8000`

## API Endpoints

### POST /analyze
Analyzes code for security vulnerabilities.

**Request:**
```json
{
  "code": "your code here"
}
```

**Response:**
```json
{
  "errors": [
    {
      "line": 5,
      "message": "SQL Injection vulnerability detected",
      "fix": "Use parameterized queries instead of string concatenation"
    }
  ]
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## Notes

- The Gemini API key is loaded from the `.env` file, not hardcoded
- The backend uses CORS to allow requests from the VS Code extension
- Vulnerability line numbers are 1-based (matching code editor conventions)
