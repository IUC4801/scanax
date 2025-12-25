import fetch from 'node-fetch';

/**
 * Interface representing a surgical code change.
 */
export interface SurgicalChange {
    search: string;
    replace: string;
}

/**
 * Interface representing the backend response for a fix request.
 */
export interface FixResponse {
    changes: SurgicalChange[];
}

export async function sendCodeToScanaxBackend(code: string, userKey: string | null = null): Promise<any> {
    try {
        const body: any = { code };
        if (userKey) {
            body.user_key = userKey;
        }

        const response = await fetch('http://localhost:8000/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Backend error: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        throw new Error(`Failed to send code to backend: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Requests a surgical fix from the backend.
 * Now returns a FixResponse object containing a list of search/replace pairs.
 */
export async function requestFix(
    code: string, 
    vulnerability: string, 
    userKey: string | null = null, 
    vulnLine: number | null = null
): Promise<FixResponse> {
    try {
        const body: any = {
            original_code: code,
            vulnerability_description: vulnerability
        };
        
        if (userKey) {
            body.user_key = userKey;
        }
        if (vulnLine) {
            body.vulnerability_line = vulnLine;
        }

        const response = await fetch('http://localhost:8000/fix', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Backend error: ${response.status}`);
        }

        // Parse the result as JSON to access the 'changes' array
        const result = await response.json();
        
        // Return the whole object so the extension can access result.changes
        return result as FixResponse;
    } catch (error) {
        throw new Error(`Failed to request fix from backend: ${error instanceof Error ? error.message : String(error)}`);
    }
}