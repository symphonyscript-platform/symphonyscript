const path = require('path');
const { pathsToModuleNameMapper } = require('ts-jest');
const tsconfig = require('../../tsconfig.base.json');

module.exports = {
    transform: {
        '^.+\\.(t|j)sx?$': ['@swc/jest'],
    },
    moduleNameMapper: {
        ...pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
            prefix: path.resolve(__dirname, '../..') + '/',
        }),
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    testPathIgnorePatterns: ['/node_modules/', '\\.d\\.ts$'],
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
};
