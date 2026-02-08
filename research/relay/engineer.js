#!/usr/bin/env node

const { program } = require('commander');
const { getTaskState, readFile, WORKFLOW_ROOT, getContext, getConfig } = require('./utils');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

program.version('1.0.0');

program.action(async () => {
    const config = getConfig();
    const feature = getContext();
    const taskDir = path.join(WORKFLOW_ROOT, feature, 'communication');

    // Scan all files
    const allFiles = require('glob').sync('*', { cwd: taskDir });
    const taskIds = [...new Set(allFiles.map(f => f.split('-')[0]))];

    let workFound = null;

    // Filter by active task if set
    let candidateIds = taskIds;
    if (config.activeTask) {
        if (taskIds.includes(config.activeTask)) {
            candidateIds = [config.activeTask];
        } else {
            // Active task might be new and have no files yet? 
            // Engineer waits for directives, so if no files, no work.
            candidateIds = [];
        }
    }

    // Iterate tasks to find latest state
    for (const taskId of candidateIds) {
        if (!/^\d{3}$/.test(taskId)) continue;

        const state = getTaskState(taskId, feature);
        if (!state) continue;

        // Turn logic: Architect Directive OR Reviewer Rejection
        if (state.lastAuthor === 'ARCHITECT' && state.lastType === 'DIRECTIVE') {
            workFound = state;
            break;
        }
        if (state.lastAuthor === 'REVIEWER' && state.lastType === 'REJECTION') {
            workFound = state;
            break;
        }
    }

    if (!workFound) {
        console.log(chalk.gray('================================================================'));
        console.log(chalk.gray('                       szZ SLEEP MODE szZ                       '));
        console.log(chalk.gray('================================================================'));
        if (config.activeTask) {
            console.log(chalk.yellow(`\nFocused on Active Task: ${config.activeTask}`));
        }
        console.log(chalk.red('\nNo active directives found for ENGINEER.'));
        console.log('\nCurrent status: Waiting for ARCHITECT or REVIEWER.');
        console.log('\nINSTRUCTIONS:');
        console.log('1. Do NOT hallucinate a task.');
        console.log('2. Do NOT write any files.');
        console.log('3. Wait 10 seconds.');
        console.log('4. Run this script again.');
        return;
    }

    // Work Found!
    const taskContent = readFile(workFound.lastFullPath);

    console.log(chalk.green('================================================================'));
    console.log(chalk.green('                       🛑 ATTENTION AGENT 🛑                       '));
    console.log(chalk.green('================================================================'));

    console.log(`\nYOUR ROLE: ${chalk.bold('ENGINEER')}`);
    console.log(`STATUS:    ${chalk.bold.green('WORK FOUND')}`);
    console.log(`TASK ID:   ${chalk.bold(workFound.taskId)}`);
    console.log(`TYPE:      ${chalk.bold(workFound.lastType)}`);
    console.log(`FROM:      ${chalk.bold(workFound.lastAuthor)}`);

    if (config.context) {
        console.log(chalk.cyan(`\nGLOBAL CONTEXT: ${config.context}`));
    }

    if (config.requirements && config.requirements.length > 0) {
        console.log(chalk.cyan('\nGLOBAL REQUIREMENTS:'));
        config.requirements.forEach(req => console.log(chalk.cyan(`- ${req}`)));
    }

    console.log(`\n--- CONTENT START ---`);
    console.log(chalk.gray(taskContent));
    console.log(`--- CONTENT END ---`);

    console.log(chalk.yellow('\nINSTRUCTIONS:'));
    console.log('1. Read the task above.');
    console.log('2. Implement it (or fix it).');
    console.log('3. Run `pnpm build && pnpm test`.');

    // Determine next file name
    // If directive -> implementation
    // If rejection -> fixes
    const nextType = workFound.lastType === 'REJECTION' ? 'fixes' : 'implementation';
    // Logic: seq + 1
    const nextSeq = String(workFound.lastSeq + 1).padStart(4, '0');
    const nextFile = `${workFound.taskId}-by-engineer-${nextType}-${nextSeq}.md`;
    const fullNextPath = path.join(taskDir, nextFile);

    console.log(`4. Write your response to: ${chalk.cyan(fullNextPath)}`);

    console.log(chalk.magenta('\nWHEN FINISHED:'));
    console.log('Run this script again.');
});

program.parse(process.argv);
