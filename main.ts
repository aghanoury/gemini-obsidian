import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	SuggestModal,
	Setting,
} from "obsidian";
import { EditorView } from '@codemirror/view'
import { StateField, StateEffect } from '@codemirror/state'
import { nanoid } from 'nanoid'
import { GoogleGenerativeAI } from "@google/generative-ai";
import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";


// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	geminiAPIKey: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	geminiAPIKey: "default",
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"dice",
			"Sample Plugin",
			(evt: MouseEvent) => {
				// Called when the user clicks the icon.
				new Notice(this.settings.geminiAPIKey);
			},
		);
		// Perform additional things with the ribbon
		ribbonIconEl.addClass("my-plugin-ribbon-class");

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Status Bar Text");

		// This adds a simple command that can be triggered anywhere
		// this.addCommand({
		// 	id: "open-sample-modal-simple",
		// 	name: "Open sample modal (simple)",
		// 	callback: () => {
		// 		new ExampleModal(this.app).open();
		// 	},
		// });
		// This adds an editor command that can perform some operation on the current editor instance
		// this.addCommand({
		// 	id: "sample-editor-command",
		// 	name: "Sample editor command",
		// 	editorCallback: (editor: Editor, view: MarkdownView) => {
		// 		console.log(editor.getSelection());
		// 		editor.replaceSelection(
		// 			`Sample Editor Command -> ${editor.getSelection()}`,
		// 		);
		// 	},
		// });
		this.addCommand({
			id: "gemini-generate",
			name: "gemini-generate",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				// new InvokeGenerativeAI(this.settings, view, editor).generate(editor.getSelection());
				new GeminiModal(this, this.settings, view, editor).open();
			}

		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		// this.addCommand({
		// 	id: "open-sample-modal-complex",
		// 	name: "Open sample modal (complex)",
		// 	checkCallback: (checking: boolean) => {
		// 		// Conditions to check
		// 		const markdownView =
		// 			this.app.workspace.getActiveViewOfType(MarkdownView);
		// 		if (markdownView) {
		// 			// If checking is true, we're simply "checking" if the command can be run.
		// 			// If checking is false, then we want to actually perform the operation.
		// 			if (!checking) {
		// 				new SampleModal(this.app, this.settings).open();
		// 			}

		// 			// This command will only show up in Command Palette when the check function returns true
		// 			return true;
		// 		}
		// 	},
		// });

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			console.log("click", evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000),
		);
	}

	onunload() { }

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class InvokeGenerativeAI {
	settings: MyPluginSettings;
	view: MarkdownView;
	editor: Editor;

	constructor(settings: MyPluginSettings, view: MarkdownView, editor: Editor) {
		this.settings = settings
		this.view = view
		this.editor = editor
	}


	public async generate(query: string, selection: string) {
		// Access your API key as an environment variable (see "Set up your API key" above)
		const genAI = new GoogleGenerativeAI(this.settings.geminiAPIKey);

		const safetySettings = [
			{
				category: HarmCategory.HARM_CATEGORY_HARASSMENT,
				threshold: HarmBlockThreshold.BLOCK_NONE,
			},
			{
				category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
				threshold: HarmBlockThreshold.BLOCK_NONE,
			},
			{
				category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
				threshold: HarmBlockThreshold.BLOCK_NONE,
			},
			{
				category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
				threshold: HarmBlockThreshold.BLOCK_NONE,
			},
		];


		const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });

		console.log(query, selection);
		const prompt = query +': ' + selection;

		const result = await model.generateContentStream(prompt);


		// this.editor.setLine(this.editor.getCursor().line+1, '\n');
		// // this.editor.replaceRange('\n' + text, this.editor.getRange());

		this.editor.replaceSelection(this.editor.getSelection() + '\n\n');

		for await (const chunk of result.stream) {
			// split the chunk by space (not newlines)
			this.editor.replaceSelection(chunk.text());
			this.editor.refresh();
			await new Promise(resolve => setTimeout(resolve, 30));

		}
	}
}

class SampleModal extends Modal {
	settings: MyPluginSettings;
	constructor(app: App, settings: MyPluginSettings
	) {
		super(app);
		this.settings = settings;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText(this.settings.geminiAPIKey);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("API Key")
			.setDesc("Google API Key")
			.addText((text) =>
				text
					.setPlaceholder("API Keywack")
					.setValue(this.plugin.settings.geminiAPIKey)
					.onChange(async (value) => {
						this.plugin.settings.geminiAPIKey = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}

export const addGemini = StateEffect.define<{
	id: string
	from: number
	to: number
	prompt: any
}>({
	map: (value, change) => {
		return {
			from: change.mapPos(value.from),
			to: change.mapPos(value.to, 1),
			prompt,
			id: value.id,
		}
	},
})



interface Book {
	title: string;
	author: string;
}

const ALL_BOOKS = [
	{
		title: "Prompt and Replace text",
		author: "Testing 1",
	},
];

export class GeminiModal extends SuggestModal<Book> {

	settings: MyPluginSettings;
	view: MarkdownView;
	editor: Editor;
	ev: EditorView;

	// Returns all available suggestions.
	private query: any = ''
	plugin: MyPlugin

	constructor(plugin: MyPlugin, settings: MyPluginSettings, view: MarkdownView, editor: Editor) {
		super(plugin.app);

		this.plugin = plugin
		this.settings = settings
		this.view = view
		this.editor = editor
	}

	getSuggestions(query: string): Book[] {
		this.query = query
		return ALL_BOOKS
		//   return ALL_BOOKS.filter((book) =>
		// 	book.title.toLowerCase().includes(query.toLowerCase())
		//   );

	}

	// Renders each suggestion item.
	renderSuggestion(book: Book, el: HTMLElement) {
		el.createEl("div", { text: book.title });
		// el.createEl("small", { text: book.author });
	}

	// Perform action on the selected suggestion.
	async onChooseSuggestion(book: Book, evt: MouseEvent | KeyboardEvent) {
		new Notice(`Selected ${this.query}`);
		new InvokeGenerativeAI(this.plugin.settings, this.view, this.editor).generate(this.query, this.editor.getSelection());
		this.query = ''
	}
}