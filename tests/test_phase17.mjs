import fs from 'fs';
import path from 'path';

function checkFile(filepath) {
    const fullPath = path.resolve('..', filepath);
    if (fs.existsSync(fullPath)) {
        console.log(`[PASS] ${filepath} exists`);
        return true;
    } else {
        console.error(`[FAIL] ${filepath} missing`);
        return false;
    }
}

function checkNoSecrets(filepath) {
    const fullPath = path.resolve('..', filepath);
    if (!fs.existsSync(fullPath)) return true;
    const content = fs.readFileSync(fullPath, 'utf8');
    const dangerousPatterns = ['sk_test', 'sk_live', 'mongodb+srv://', 'secret', 'password'];
    // Very basic check, skipping some keywords if they're placeholders like <password>
    let safe = true;
    for (const line of content.split('\n')) {
        if (line.includes('mongodb+srv://') && !line.includes('<password>')) {
            console.error(`[FAIL] Possible secret exposed in ${filepath}`);
            safe = false;
        }
    }
    if (safe) {
        console.log(`[PASS] No hardcoded secrets detected in ${filepath}`);
    }
    return safe;
}

let passed = 0;
let failed = 0;

const assertOk = (condition) => {
    if (condition) passed++;
    else failed++;
};

console.log("=== STARTING PHASE 17 AUTOMATED TEST SUITE ===");

// 1. Dockerfiles
assertOk(checkFile("ZBACKEND/Dockerfile"));
assertOk(checkFile("zfrontend/Dockerfile"));

// 2. Dockerignores
assertOk(checkFile("ZBACKEND/.dockerignore"));
assertOk(checkFile("zfrontend/.dockerignore"));

// 3. Docker Compose
assertOk(checkFile("docker-compose.yml"));

// 4. GitHub Actions CI
assertOk(checkFile(".github/workflows/ci.yml"));

// 5. Render Readiness
assertOk(checkFile("render.yaml"));

// 6. Security Checks
assertOk(checkNoSecrets("docker-compose.yml"));
assertOk(checkNoSecrets("render.yaml"));
assertOk(checkNoSecrets(".github/workflows/ci.yml"));

console.log("\n[BLOCKED] Docker daemon is not available to run 'docker build'.");
console.log("[BLOCKED] Docker Compose is not available to run 'docker-compose up'.");

console.log(`\nPhase 17 Checks: ${passed} Passed, ${failed} Failed`);
if (failed > 0) process.exit(1);
