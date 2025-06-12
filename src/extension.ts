import * as vscode from 'vscode';

interface Template {
	name: string;
	content: string;
}

class TemplateProvider implements vscode.TreeDataProvider<Template> {
	private _onDidChangeTreeData: vscode.EventEmitter<Template | undefined | null | void> = new vscode.EventEmitter<Template | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<Template | undefined | null | void> = this._onDidChangeTreeData.event;

	private templates: Template[] = [];
	private pendingTemplateName: string | null = null;

	constructor(private context: vscode.ExtensionContext) {
		this.loadTemplates();
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Template): vscode.TreeItem {
		const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
		item.contextValue = 'template';
		item.tooltip = `Template: ${element.name}`;

		if (this.pendingTemplateName === element.name) {
			item.iconPath = new vscode.ThemeIcon('copy');
			item.description = 'クリックして保存';
			item.command = {
				title: 'Save Template',
				command: 'template-manager.saveTemplate',
				arguments: [element]
			};
		} else {
			item.iconPath = new vscode.ThemeIcon('file-text');
		}

		return item;
	}

	getChildren(element?: Template): Thenable<Template[]> {
		if (!element) {
			return Promise.resolve(this.templates);
		}
		return Promise.resolve([]);
	}

	addPendingTemplate(name: string) {
		this.pendingTemplateName = name;
		this.templates.push({ name, content: '' });
		this.refresh();
	}

	saveTemplate(template: Template) {
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			vscode.window.showErrorMessage('アクティブなエディターが見つかりません');
			return;
		}

		const content = activeEditor.document.getText();
		const index = this.templates.findIndex(t => t.name === template.name);
		if (index !== -1) {
			this.templates[index].content = content;
			this.pendingTemplateName = null;
			this.saveTemplates();
			this.refresh();
			vscode.window.showInformationMessage(`テンプレート "${template.name}" を保存しました`);
		}
	}

	pasteTemplate(template: Template) {
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			vscode.window.showErrorMessage('アクティブなエディターが見つかりません');
			return;
		}

		const selection = activeEditor.selection;
		activeEditor.edit(editBuilder => {
			if (selection.isEmpty) {
				editBuilder.insert(selection.start, template.content);
			} else {
				editBuilder.replace(selection, template.content);
			}
		});

		vscode.window.showInformationMessage(`テンプレート "${template.name}" をペーストしました`);
	}

	deleteTemplate(template: Template) {
		const index = this.templates.findIndex(t => t.name === template.name);
		if (index !== -1) {
			this.templates.splice(index, 1);
			if (this.pendingTemplateName === template.name) {
				this.pendingTemplateName = null;
			}
			this.saveTemplates();
			this.refresh();
			vscode.window.showInformationMessage(`テンプレート "${template.name}" を削除しました`);
		}
	}

	private loadTemplates() {
		const stored = this.context.globalState.get<Template[]>('templates');
		if (stored) {
			this.templates = stored;
		}
	}

	private saveTemplates() {
		this.context.globalState.update('templates', this.templates);
	}
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Template Manager が有効化されました');

	const templateProvider = new TemplateProvider(context);
	vscode.window.createTreeView('templateManager', {
		treeDataProvider: templateProvider,
		showCollapseAll: false
	});

	// テンプレート追加コマンド
	const addTemplateCommand = vscode.commands.registerCommand('template-manager.addTemplate', async () => {
		const name = await vscode.window.showInputBox({
			prompt: 'テンプレート名を入力してください',
			placeHolder: 'テンプレート名'
		});

		if (name && name.trim()) {
			templateProvider.addPendingTemplate(name.trim());
		}
	});

	// テンプレート保存コマンド
	const saveTemplateCommand = vscode.commands.registerCommand('template-manager.saveTemplate', (template: Template) => {
		templateProvider.saveTemplate(template);
	});

	// テンプレートペーストコマンド
	const pasteTemplateCommand = vscode.commands.registerCommand('template-manager.pasteTemplate', (template: Template) => {
		templateProvider.pasteTemplate(template);
	});

	// テンプレート削除コマンド
	const deleteTemplateCommand = vscode.commands.registerCommand('template-manager.deleteTemplate', (template: Template) => {
		templateProvider.deleteTemplate(template);
	});

	// Tree itemクリックイベント
	const treeViewClickCommand = vscode.commands.registerCommand('template-manager.onTemplateClick', (template: Template) => {
		if (templateProvider['pendingTemplateName'] === template.name) {
			templateProvider.saveTemplate(template);
		}
	});

	context.subscriptions.push(
		addTemplateCommand,
		saveTemplateCommand,
		pasteTemplateCommand,
		deleteTemplateCommand,
		treeViewClickCommand
	);
}

export function deactivate() { }
