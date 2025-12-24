import fetch from 'node-fetch';

export async function sendCodeToScanaxBackend(code: string): Promise<any> {
	try {
		const response = await fetch('http://localhost:8000/analyze', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ code }),
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
