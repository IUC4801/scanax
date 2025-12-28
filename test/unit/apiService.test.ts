import * as assert from 'assert';
import * as vscode from 'vscode';
import { NetworkError, BackendError, ApiKeyError } from '../../src/services/apiService';

suite('ApiService Test Suite', () => {

    test('NetworkError should be instance of Error', () => {
        const error = new NetworkError('Connection failed');
        assert.ok(error instanceof Error);
        assert.strictEqual(error.name, 'NetworkError');
        assert.strictEqual(error.message, 'Connection failed');
    });

    test('BackendError should store status code', () => {
        const error = new BackendError('Server error', 500);
        assert.ok(error instanceof Error);
        assert.strictEqual(error.name, 'BackendError');
        assert.strictEqual(error.statusCode, 500);
    });

    test('ApiKeyError should have correct name', () => {
        const error = new ApiKeyError('Invalid API key');
        assert.ok(error instanceof Error);
        assert.strictEqual(error.name, 'ApiKeyError');
    });

    // Note: Full API tests would require mocking fetch or integration tests
    // These test the error classes which are critical for error handling
});
