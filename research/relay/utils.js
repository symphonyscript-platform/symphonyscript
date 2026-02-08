const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const chalk = require('chalk');
const boxen = require('boxen');
const ora = require('ora');

const PROJ_ROOT = path.resolve(__dirname, '../../');
const WORKFLOW_ROOT = path.join(PROJ_ROOT, 'research/workflow');

// Boxen options
const BOX_OPTS = {
    padding: 1,
    margin: 1,
    borderStyle: 'double',
    borderColor: 'blue',
    titleAlignment: 'center'
};

/**
 * Gets the current feature context (e.g., 'composer')
 * Defaults to 'composer' for now, but could be dynamic
 */
function getContext() {
    return 'composer'; // hardcoded for now as requested
}

/**
 * Scans communication folder for the latest state of a specific task
 */
function getTaskState(taskId, feature = 'composer') {
    const commDir = path.join(WORKFLOW_ROOT, feature, 'communication');
    const pattern = `${taskId}-by-*.md`;
    const files = glob.sync(pattern, { cwd: commDir });

    if (files.length === 0) return null;

    // Sort by sequence number (last part, e.g. -0001.md)
    files.sort((a, b) => {
        const seqA = parseInt(a.match(/-(\d{4})\.md$/)[1]);
        const seqB = parseInt(b.match(/-(\d{4})\.md$/)[1]);
        return seqA - seqB;
    });

    const lastFile = files[files.length - 1];

    // Parse roles
    const lastAuthor = lastFile.includes('-by-architect') ? 'ARCHITECT' :
        lastFile.includes('-by-engineer') ? 'ENGINEER' :
            lastFile.includes('-by-reviewer') ? 'REVIEWER' : 'UNKNOWN';

    // Parse status type
    const lastType = lastFile.includes('-directive') ? 'DIRECTIVE' :
        lastFile.includes('-implementation') ? 'IMPLEMENTATION' :
            lastFile.includes('-rejection') ? 'REJECTION' :
                lastFile.includes('-approval') ? 'APPROVAL' :
                    lastFile.includes('-complete') ? 'COMPLETE' : 'UNKNOWN';

    const lastSeq = parseInt(lastFile.match(/-(\d{4})\.md$/)[1]);

    return {
        taskId,
        lastFile,
        lastFullPath: path.join(commDir, lastFile),
        lastAuthor,
        lastType,
        lastSeq
    };
}

/**
 * Determines whose turn it is
 */
function getTurn(state) {
    if (!state) return 'ARCHITECT'; // No files = Architect start

    if (state.lastAuthor === 'ARCHITECT') {
        if (state.lastType === 'DIRECTIVE') return 'ENGINEER';
        // Architect approval -> Done? Or Reviewer? Usually Architect approval ends it.
        return 'IDLE';
    }

    if (state.lastAuthor === 'ENGINEER') {
        if (state.lastType === 'IMPLEMENTATION' || state.lastType === 'FIXES') return 'REVIEWER';
        if (state.lastType === 'COMPLETE') return 'IDLE'; // Waiting for next task
    }

    if (state.lastAuthor === 'REVIEWER') {
        if (state.lastType === 'REJECTION') return 'ENGINEER';
        if (state.lastType === 'APPROVAL') return 'ARCHITECT'; // Back to architect to acknowledge? Or done?
        if (state.lastType === 'DIRECTIVE') return 'ENGINEER';
    }

    return 'IDLE';
}

/**
 * Prints a standardized banner for the agent
 */
function printBanner(role, action, details) {
    console.log(boxen(
        chalk.bold(`${role.toUpperCase()} AGENT INTERFACE`) +
        `\n\n${chalk.green('STATUS:')} ${action}` +
        (details ? `\n${details}` : ''),
        { ...BOX_OPTS, borderColor: role === 'architect' ? 'magenta' : role === 'reviewer' ? 'red' : 'blue' }
    ));
}

/**
 * Reads file content
 */
function readFile(filePath) {
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
    }
    return null;
}

/**
 * Scans for ANY active task that needs this role
 */
function findWorkForRole(role) {
    // 1. Get all task IDs from tasks folder
    const feature = getContext();
    const taskDir = path.join(WORKFLOW_ROOT, feature, 'tasks');
    const taskFiles = glob.sync('*.md', { cwd: taskDir });

    // Extract IDs (e.g. "051" from "051-implement...")
    const taskIds = taskFiles.map(f => f.split('-')[0]).filter(id => /^\d{3}$/.test(id));

    // Sort tasks to prioritize latest (or earliest? Usually earliest pending)
    // Let's prioritize latest active
    taskIds.sort().reverse();

    for (const id of taskIds) {
        const state = getTaskState(id, feature);
        if (!state) continue; // Architect hasn't started communication yet

        const turn = getTurn(state);
        if (turn === role.toUpperCase()) {
            return state;
        }
    }

    return null;
}

/**
 * Generates the NEXT filename for the agent to write to
 */
function getNextFilename(state, role, type) {
    const nextSeq = String(state.lastSeq + 1).padStart(4, '0');
    return `${state.taskId}-by-${role.toLowerCase()}-${type}-${nextSeq}.md`;
}

/**
 * Reads the relay configuration
 */
function getConfig() {
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {
            console.error('Error parsing config.json:', e.message);
        }
    }
    return { activeTask: null, context: '', requirements: [] };
}

module.exports = {
    PROJ_ROOT,
    WORKFLOW_ROOT,
    getContext,
    getTaskState,
    getTurn,
    printBanner,
    readFile,
    findWorkForRole,
    getNextFilename,
    getConfig
};
