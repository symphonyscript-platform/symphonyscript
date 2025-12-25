module.exports = {
    transform: {
        '^.+\\.(t|j)sx?$': '@swc/jest',
    },
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^@symphonyscript/dsp$': '<rootDir>/../dsp/src/index.ts',
        '^@symphonyscript/kernel$': '<rootDir>/../kernel/src/index.ts',
    },
    setupFiles: ['<rootDir>/src/setup-tests.ts'],
};
