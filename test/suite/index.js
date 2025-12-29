const path = require('path');
const Mocha = require('mocha');
const { glob } = require('glob');

function run() {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000
    });

    const testsRoot = path.resolve(__dirname, '../..');
    const outTestsRoot = path.resolve(testsRoot, 'out', 'test');

    return new Promise((resolve, reject) => {
        // Use glob with promises (modern API)
        glob('unit/**/*.test.js', { cwd: outTestsRoot })
            .then(files => {
                console.log(`Found ${files.length} test files in ${outTestsRoot}`);
                files.forEach(f => {
                    console.log(`  Loading: ${f}`);
                    mocha.addFile(path.resolve(outTestsRoot, f));
                });

                try {
                    // Run the mocha test
                    mocha.run(failures => {
                        if (failures > 0) {
                            reject(new Error(`${failures} tests failed.`));
                        } else {
                            resolve();
                        }
                    });
                } catch (err) {
                    console.error(err);
                    reject(err);
                }
            })
            .catch(err => reject(err));
    });
}

module.exports = { run };
