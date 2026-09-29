import axios from 'axios';
import assert from 'assert';

const API_URL = 'http://localhost:8000/api/v1';

async function runSecurityTests() {
    console.log("==========================================");
    console.log("PHASE 14: SECURITY HARDENING TEST SUITE");
    console.log("==========================================\n");

    try {
        console.log("1. Testing Security Headers (Helmet)...");
        const headerRes = await axios.get('http://localhost:8000/api/v1/health');
        assert(headerRes.headers['x-content-type-options'] === 'nosniff', 'Missing nosniff header');
        assert(headerRes.headers['x-frame-options'] === 'SAMEORIGIN', 'Missing x-frame-options header');
        console.log("✅ Security Headers present");

        console.log("2. Testing NoSQL Injection Sanitization...");
        let sqlInjected = false;
        try {
            await axios.post(`${API_URL}/users/login`, {
                username: { "$gt": "" },
                password: "password"
            });
        } catch (e) {
            // Should get 400 or 401, not 500 from MongoDB
            if (e.response && (e.response.status === 401 || e.response.status === 400 || e.response.status === 404)) {
                sqlInjected = true;
            } else if (e.response && e.response.status === 500) {
                console.error("❌ NoSQL Injection triggered a 500 error!");
            }
        }
        assert(sqlInjected, "MongoDB Injection failed to be sanitized");
        console.log("✅ NoSQL Injection prevented");

        console.log("3. Testing Error Information Disclosure...");
        let errorSanitized = false;
        try {
            // Trigger 404 or bad request, check payload
            await axios.get(`${API_URL}/meetings/invalid_meeting_code_123`);
        } catch (e) {
            if (e.response) {
                // Ensure e.message or stack trace is not leaked
                const payload = JSON.stringify(e.response.data);
                if (payload.includes("e.message") || payload.includes("Error:") || payload.includes("MongoServerError")) {
                    console.error("❌ Internal error details leaked!");
                } else {
                    errorSanitized = true;
                }
            }
        }
        assert(errorSanitized, "Error details are leaking!");
        console.log("✅ Error information disclosure sanitized");

        console.log("\n✅ All Security Tests Passed!");
        process.exit(0);

    } catch (error) {
        console.error("\n❌ Security Tests Failed:", error.message || error);
        process.exit(1);
    }
}

runSecurityTests();
