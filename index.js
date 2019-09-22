'use strict';
const logUpdate = require('log-update');
const chalk = require('chalk');
const figures = require('figures');
const indentString = require('indent-string');
const cliTruncate = require('cli-truncate');
const stripAnsi = require('strip-ansi');
const utils = require('./lib/utils');

const prepareData = (data) => {
	if (typeof data === 'string') {
		data = stripAnsi(data.trim().split('\n').filter(Boolean).pop());

		if (data === '') {
			data = undefined;
		}
	}
	return data;
}

const renderHelper = (tasks, options, level) => {
	level = level || 0;

	let output = [];

	let completedTasks = 0;
	let pendingTasks = 0;
	let skippedTasks = 0;
	for (const task of tasks) {
		if (task.isPending()) {
			pendingTasks++;
		}
		if (task.isCompleted()) {
			completedTasks++;
		}
		if (task.isSkipped()) {
			skippedTasks++;
		}
	}

	// Hide all completed tasks once the parent is complete
	let limitCompleted = Infinity;
	if (Array.isArray(options.limitCompleted)) {
		if (level < options.limitCompleted.length) {
			limitCompleted = options.limitCompleted[level];
		}
	} else {
		limitCompleted = options.limitCompleted;
	}
	let tasksToHide = limitCompleted < Infinity && pendingTasks === 0 ? tasks.length : completedTasks - limitCompleted;

	const skipReason = {};

	for (const task of tasks) {
		if (task.isEnabled() && utils.getSymbol(task, options) !== ' ') {
			if (task.isCompleted() && --tasksToHide >= 0) {
				continue;
			}
			if (task.isSkipped() && skippedTasks > limitCompleted) {
				const data = prepareData(task.output);
				skipReason[data] = skipReason[data] || 0;
				skipReason[data]++;
				continue;
			}
			const skipped = task.isSkipped() ? ` ${chalk.dim('[skipped]')}` : '';

			output.push(indentString(` ${utils.getSymbol(task, options)} ${task.title}${skipped}`, level, '  '));

			if ((task.isPending() || task.isSkipped() || task.hasFailed()) && utils.isDefined(task.output)) {
				const data = prepareData(task.output);

				if (utils.isDefined(data)) {
					const out = indentString(`${figures.arrowRight} ${data}`, level, '  ');
					output.push(`   ${chalk.gray(cliTruncate(out, process.stdout.columns - 3))}`);
				}
			}

			if ((task.isPending() || task.hasFailed() || options.collapse === false) && (task.hasFailed() || options.showSubtasks !== false) && task.subtasks.length > 0) {
				output = output.concat(renderHelper(task.subtasks, options, level + 1));
			}
		}
	}

	if (skippedTasks > limitCompleted) {
		for (let reason of Object.keys(skipReason)) {
			output.push(indentString(` ${chalk.yellow(figures.arrowDown)} ${skipReason[reason]} ${chalk.dim('[skipped]')} with reason: ${chalk.yellow(reason)}`, level, '  '));
		}
	}

	return output.join('\n');
};

const render = (tasks, options) => {
	logUpdate(renderHelper(tasks, options));
};

class UpdateRenderer {
	constructor(tasks, options) {
		this._tasks = tasks;
		this._options = Object.assign({
			showSubtasks: true,
			collapse: true,
			limitCompleted: Infinity,
			clearOutput: false
		}, options);
	}

	render() {
		if (this._id) {
			// Do not render if we are already rendering
			return;
		}

		this._id = setInterval(() => {
			render(this._tasks, this._options);
		}, 100);
	}

	end(err) {
		if (this._id) {
			clearInterval(this._id);
			this._id = undefined;
		}

		render(this._tasks, this._options);

		if (this._options.clearOutput && err === undefined) {
			logUpdate.clear();
		} else {
			logUpdate.done();
		}
	}
}

module.exports = UpdateRenderer;
