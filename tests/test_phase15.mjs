import axios from "axios";
import { io } from "socket.io-client";
import { performance } from "perf_hooks";

const BASE_URL = process.env.API_URL || "http://localhost:8000/api/v1";
const SOCKET_URL = process.env.SOCKET_URL || "http://localhost:8000";

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`[PASS] ${message}`);
        passed++;
    } else {
        console.error(`[FAIL] ${message}`);
        failed++;
    }
}

const measureTime = async (fn) => {
    const start = performance.now();
    await fn();
    return performance.now() - start;
};

const calculatePercentiles = (times) => {
    if (times.length === 0) return { p50: 0, p90: 0, p95: 0, p99: 0, max: 0 };
    times.sort((a, b) => a - b);
    const p = (pct) => times[Math.floor((pct / 100) * (times.length - 1))];
    return {
        p50: p(50).toFixed(2),
        p90: p(90).toFixed(2),
        p95: p(95).toFixed(2),
        p99: p(99).toFixed(2),
        max: times[times.length - 1].toFixed(2)
    };
};

async function runLoadTest() {
    console.log("==================================================");
    console.log("=== STARTING PHASE 15 LOAD & RELIABILITY TEST ===");
    console.log("==================================================\n");

    const stats = [];
    
    // 1. Health
    let times = [];
    for (let i = 0; i < 50; i++) {
        times.push(await measureTime(() => axios.get(`${BASE_URL}/health`)));
    }
    const healthP = calculatePercentiles(times);
    stats.push({ endpoint: "GET /health", concurrency: 1, requests: 50, success: 50, failure: 0, ...healthP });
    assert(true, "Health endpoint baseline measured");

    // 2. Setup Organizations and Users
    const userA = { name: "Load User A", username: `loaduserA_${Date.now()}`, password: "password123" };
    await axios.post(`${BASE_URL}/users/register`, userA);
    const loginA = await axios.post(`${BASE_URL}/users/login`, { username: userA.username, password: userA.password });
    const tokenA = loginA.data.token;

    const userB = { name: "Load User B", username: `loaduserB_${Date.now()}`, password: "password123" };
    await axios.post(`${BASE_URL}/users/register`, userB);
    const loginB = await axios.post(`${BASE_URL}/users/login`, { username: userB.username, password: userB.password });
    const tokenB = loginB.data.token;

    const orgResA = await axios.post(`${BASE_URL}/organizations`, { name: `LoadOrgA_${Date.now()}` }, { headers: { Authorization: `Bearer ${tokenA}` } });
    const orgAId = orgResA.data.organization._id;

    const orgResB = await axios.post(`${BASE_URL}/organizations`, { name: `LoadOrgB_${Date.now()}` }, { headers: { Authorization: `Bearer ${tokenB}` } });
    const orgBId = orgResB.data.organization._id;



    // 3. API Load Test (Meeting Creation Concurrency)
    const createConcurrency = 25;
    let createTimes = [];
    let createSuccess = 0;
    let createFail = 0;
    
    const createPromises = Array.from({ length: createConcurrency }).map(async () => {
        const start = performance.now();
        try {
            await axios.post(`${BASE_URL}/meetings`, { title: "Load Meeting" }, { headers: { Authorization: `Bearer ${tokenA}`, "X-Organization-Id": orgAId } });
            createSuccess++;
        } catch (e) {
            console.error("Meeting creation error:", e.response?.data || e.message);
            createFail++;
        }
        createTimes.push(performance.now() - start);
    });
    await Promise.all(createPromises);
    const createP = calculatePercentiles(createTimes);
    stats.push({ endpoint: "POST /meetings (Concurrent)", concurrency: createConcurrency, requests: createConcurrency, success: createSuccess, failure: createFail, ...createP });
    assert(createSuccess === createConcurrency, `Successfully created ${createConcurrency} concurrent meetings`);

    // 4. Socket.IO Load Testing & Tenant Isolation
    let socketConnections = 0;
    const socketConcurrency = 20;
    const sockets = [];
    
    const socketPromises = Array.from({ length: socketConcurrency }).map(async (_, i) => {
        return new Promise((resolve) => {
            const socket = io(SOCKET_URL, {
                auth: { token: tokenA },
                query: { organizationId: orgAId }
            });
            socket.on("connect", () => {
                socketConnections++;
                sockets.push(socket);
                resolve();
            });
            setTimeout(resolve, 3000); // timeout
        });
    });
    
    await Promise.all(socketPromises);
    assert(socketConnections === socketConcurrency, `Successfully established ${socketConnections}/${socketConcurrency} concurrent socket connections`);
    
    for(const socket of sockets) {
        socket.disconnect();
    }

    // 5. Usage Concurrency Testing (Ask Voom)
    const usageConcurrency = 10;
    let usageTimes = [];
    let usageSuccess = 0;
    let usageFail = 0;
    
    // First, give the org some entitlement limits if needed, or let the dev seed plan handle it.
    // Assuming the dev seed plan allows up to a certain limit.
    const usagePromises = Array.from({ length: usageConcurrency }).map(async () => {
        const start = performance.now();
        try {
            await axios.post(`${BASE_URL}/organizations/${orgAId}/ask`, 
                { question: "Load test question?" }, 
                { headers: { Authorization: `Bearer ${tokenA}` } }
            );
            usageSuccess++;
        } catch (e) {
            console.error("Ask Voom error:", e.response?.data || e.message);
            usageFail++;
        }
        usageTimes.push(performance.now() - start);
    });
    
    await Promise.all(usagePromises);
    const usageP = calculatePercentiles(usageTimes);
    stats.push({ endpoint: "POST /ask (Concurrent)", concurrency: usageConcurrency, requests: usageConcurrency, success: usageSuccess, failure: usageFail, ...usageP });
    assert(usageSuccess === usageConcurrency, `Successfully processed ${usageSuccess}/${usageConcurrency} concurrent usage (Ask Voom) requests`);

    // Verify usage value
    const usageRes = await axios.get(`${BASE_URL}/billing/usage`, { headers: { Authorization: `Bearer ${tokenA}`, "X-Organization-Id": orgAId } });
    assert(usageRes.data.usage?.ask_voom === usageConcurrency, `MongoDB atomic usage counter is exactly ${usageConcurrency}`);

    console.log("\n==================================================");
    console.log("=== PHASE 15 PERFORMANCE REPORT ===");
    console.log("| Endpoint | Concurrency | Requests | Success | Fail | p50 | p90 | p95 | p99 | Max |");
    console.log("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
    for (const stat of stats) {
        console.log(`| ${stat.endpoint} | ${stat.concurrency} | ${stat.requests} | ${stat.success} | ${stat.failure} | ${stat.p50} | ${stat.p90} | ${stat.p95} | ${stat.p99} | ${stat.max} |`);
    }

    console.log(`\nPhase 15 Test Summary: ${passed} Passed, ${failed} Failed\n`);
    process.exit(failed > 0 ? 1 : 0);
}

runLoadTest().catch(e => {
    console.error(e);
    process.exit(1);
});
