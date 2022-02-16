// Global Mocha test hooks.

import * as util from 'util';

const original = {
    log: console.log,
    error: console.error,
};

beforeEach(function () {
    const currentTest = this.currentTest as {
        consoleOutputs?: string[];
        consoleErrors?: string[];
    };
    console.log = function captureLog() {
        original.log.apply(console, arguments as any);
        const formatted = util.format.apply(util, arguments as any);
        currentTest.consoleOutputs = (currentTest.consoleOutputs || []).concat(formatted);
    };
    console.error = function captureError() {
        original.error.apply(console, arguments as any);
        const formatted = util.format.apply(util, arguments as any);
        currentTest.consoleErrors = (currentTest.consoleErrors || []).concat(formatted);
    };
});

afterEach(function () {
    console.log = original.log;
    console.error = original.error;
});