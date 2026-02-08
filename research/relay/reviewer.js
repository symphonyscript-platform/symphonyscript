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
    const allFiles = require('glob').sync('*', { cwd: taskDir });
    const taskIds = [...new Set(allFiles.map(f => f.split('-')[0]))];

    let workFound = null;

    let candidateIds = taskIds;
    if (config.activeTask) {
        if (taskIds.includes(config.activeTask)) {
            candidateIds = [config.activeTask];
        } else {
            candidateIds = [];
        }
    }

    for (const taskId of candidateIds) {
        if (!/^\d{3}$/.test(taskId)) continue;

        const state = getTaskState(taskId, feature);
        if (!state) continue;

        // Turn logic for Reviewer:
        // Engineer Implementation -> Reviewer Turn
        // Engineer Fixes -> Reviewer Turn
        // Engineer Complete -> Reviewer Turn (?)
        if (state.lastAuthor === 'ENGINEER' && (
            state.lastType === 'IMPLEMENTATION' ||
            state.lastType === 'FIXES' ||
            state.lastType === 'COMPLETE'
        )) {
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
        console.log(chalk.blue('\nNo submitted work found for REVIEWER.'));
        console.log('\nCurrent status: Waiting for ENGINEER.');
        console.log('\nINSTRUCTIONS:');
        console.log('1. Do NOT hallucinate work.');
        console.log('2. Do NOT write any files.');
        console.log('3. Wait 10 seconds.');
        console.log('4. Run this script again.');
        return;
    }

    const taskContent = readFile(workFound.lastFullPath);

    console.log(chalk.red('================================================================'));
    console.log(chalk.red('                       🛑 ATTENTION AGENT 🛑                       '));
    console.log(chalk.red('================================================================'));

    console.log(`\nYOUR ROLE: ${chalk.bold('REVIEWER')}`);
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

    console.log(`\n--- SUBMISSION START ---`);
    console.log(chalk.gray(taskContent));
    console.log(`--- SUBMISSION END ---`);

    console.log(chalk.yellow('\nINSTRUCTIONS:'));
    console.log('1. Read the submission above and the modified code.');
    console.log('2. Find flaws. Be hostile. Be brief.');
    console.log('3. If flaws -> REJECTION. If perfect -> APPROVAL.');

    const nextSeq = String(workFound.lastSeq + 1).padStart(4, '0');
    // Note: User must choose type (rejection/approval)
    // We can't predict filename type exactly, but we can give the pattern
    const patternStart = path.join(taskDir, `${workFound.taskId}-by-reviewer-`);

    console.log(`4. Write your response to:`);
    console.log(`   ${chalk.cyan(patternStart + '<TYPE>-' + nextSeq + '.md')}`);
    console.log(`   Replace <TYPE> with 'rejection' or 'approval'`);

    console.log(chalk.magenta('\nWHEN FINISHED:'));
    console.log('Run this script again.');
});

program.parse(process.argv);
