import { execSync } from 'child_process';

const scripts = [
    'test_phase4.mjs',
    'test_phase5.mjs',
    'test_phase6.mjs',
    'test_phase7.mjs',
    'test_phase9.mjs',
    'test_phase10.mjs',
    'test_phase11.mjs',
    'test_phase12.mjs',
    'test_phase13.mjs',
    'test_phase14_security.mjs'
];

let failed = false;

for (const script of scripts) {
    console.log(`\n\n--- RUNNING ${script} ---`);
    try {
        execSync(`node ${script}`, { stdio: 'inherit' });
    } catch (e) {
        console.error(`\n❌ ${script} failed!`);
        failed = true;
        break; // Stop on first failure
    }
}

if (failed) {
    process.exit(1);
} else {
    console.log('\n\n✅✅✅ ALL REGRESSION TESTS PASSED ✅✅✅');
    process.exit(0);
}
