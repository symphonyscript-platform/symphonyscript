const { program } = require('commander');
const { getTaskState, readFile, WORKFLOW_ROOT, getContext, getConfig } = require('./utils');
const path = require('path');
const fs = require('fs-extra');
// Fix: Chalk 5+ is ESM only. We need to use dynamic import or downgrade.
// Re-installing chalk@4 is the best fix.
let chalk;
try { chalk = require('chalk'); } catch (e) { }


program.version('1.0.0');

program.action(async () => {
    // Architect is special. Architect CREATEs work. 
    // It doesn't necessarily wait for work, although it could wait for "COMPLETE" status to acknowledge.

    // For now, let's keep it simple: Architect checks if there are any active tasks that need attention.
    // Or, Architect is used to bootstrap a new task.

    console.log(chalk.magenta('================================================================'));
    console.log(chalk.magenta('                       🏛️  ARCHITECT CONSOLE 🏛️                       '));
    console.log(chalk.magenta('================================================================'));

    const config = getConfig();
    if (config.activeTask) {
        console.log(chalk.yellow(`\n🎯 ACTIVE TASK: ${config.activeTask}`));
    } else {
        console.log(chalk.gray(`\n💤 NO ACTIVE TASK SET (Edit research/relay/config.json)`));
    }

    if (config.context) {
        console.log(chalk.cyan(`📝 CONTEXT: ${config.context}`));
    }
    console.log(''); // spacer

    // Check for "COMPLETE" tasks that need final sign-off?
    // Or check if system is idle?

    const feature = getContext();
    const taskDir = path.join(WORKFLOW_ROOT, feature, 'communication');

    // Scan for any tasks in progress
    // If no tasks -> "CREATE NEW TASK"

    // For this MVP, let's just output instructions on how to start a task
    console.log('\nCURRENT STATUS: Monitoring System...\n');

    // Future: Scan for "APPROVAL" from Reviewer and mark task as CLOSED?
    // Let's implement that logic.

    const allFiles = require('glob').sync('*', { cwd: taskDir });
    const taskIds = [...new Set(allFiles.map(f => f.split('-')[0]))];

    let approvalFound = false;

    for (const taskId of taskIds) {
        if (!/^\d{3}$/.test(taskId)) continue;
        const state = getTaskState(taskId, feature);

        if (state && state.lastAuthor === 'REVIEWER' && state.lastType === 'APPROVAL') {
            console.log(`${chalk.green('✔')} Task ${taskId} is APPROVED by Reviewer.`);
            console.log(`  Action: Architect should verify or close.`);
            approvalFound = true;
        }
    }

    if (!approvalFound) {
        console.log('System IDLE. No pending approvals.');
    }

    console.log(chalk.yellow('\nINSTRUCTIONS:'));
    console.log('To start a new task:');
    console.log('1. Write a plan/task file in `research/workflow/composer/tasks/`');
    console.log('2. Write a directive file:');
    console.log(`   ${chalk.cyan('research/workflow/composer/communication/<TASKID>-by-architect-directive-0001.md')}`);

    console.log(chalk.magenta('\nWHEN FINISHED:'));
    console.log('Run this script again to monitor progress.');
});

program.parse(process.argv);
