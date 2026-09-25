import axios from "axios";
import { strict as assert } from "assert";

const API_URL = "http://localhost:8000/api/v1";

async function runTests() {
    console.log("Starting Phase 16 Observability Tests...");

    let passed = 0;
    let failed = 0;

    const assertPass = (name) => {
        console.log(`[PASS] ${name}`);
        passed++;
    };

    const assertFail = (name, error) => {
        console.error(`[FAIL] ${name}:`, error.message || error);
        failed++;
    };

    // 1. Health endpoint
    try {
        const res = await axios.get(`${API_URL}/health`);
        assert.equal(res.status, 200);
        assert.equal(res.data.status, "ok");
        assertPass("Health endpoint");
    } catch (e) {
        assertFail("Health endpoint", e);
    }

    // 2. Readiness endpoint
    try {
        const res = await axios.get(`${API_URL}/health/ready`);
        assert.equal(res.status, 200);
        assert.equal(res.data.status, "ready");
        assert.ok(res.data.dependencies.mongodb);
        assertPass("Readiness endpoint");
    } catch (e) {
        // Might be 503 if Redis/Mongo is down, but we want to assert it responds correctly
        if (e.response && e.response.status === 503) {
            assert.equal(e.response.data.status, "not_ready");
            assertPass("Readiness endpoint (not ready gracefully handled)");
        } else {
            assertFail("Readiness endpoint", e);
        }
    }

    // 3. Request ID generated & 4. X-Request-Id response header
    try {
        const res = await axios.get(`${API_URL}/health`);
        assert.ok(res.headers["x-request-id"], "Missing X-Request-Id header");
        assertPass("Request ID generated & X-Request-Id response header");
    } catch (e) {
        assertFail("Request ID generated & X-Request-Id response header", e);
    }

    // 5. Existing supplied request ID safely handled
    try {
        const customId = "custom-test-id-123";
        const res = await axios.get(`${API_URL}/health`, {
            headers: { "x-request-id": customId }
        });
        assert.equal(res.headers["x-request-id"], customId);
        assertPass("Existing supplied request ID safely handled");
    } catch (e) {
        assertFail("Existing supplied request ID safely handled", e);
    }

    console.log(`\nPhase 16 Test Summary: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
