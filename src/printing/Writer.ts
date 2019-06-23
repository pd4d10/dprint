import { throwError } from "../utils";

interface IndentState {
    hangingIndentLevel: number | undefined;
    indentLevel: number;
}

export interface WriterState {
    currentLineColumn: number;
    currentLineNumber: number;
    lastLineIndentLevel: number;
    indentLevel: number;
    indentText: string;
    hangingIndentLevel: number | undefined;
    expectNewLineNext: boolean;
    uncommitedItems: string[]; // todo: only fill this once the higher level printer says to
    indentStates: IndentState[];
    hangingIndentStates: IndentState[];
}

export class Writer {
    private readonly comittedItems: string[] = [];
    private readonly singleIndentationText: string;
    private fireOnNewLine?: () => void;

    private state: WriterState;

    constructor(private readonly options: { indentSize: number; newLineKind: "\r\n" | "\n" }) {
        this.singleIndentationText = " ".repeat(options.indentSize);
        this.state = {
            currentLineColumn: 0,
            currentLineNumber: 0,
            lastLineIndentLevel: 0,
            indentLevel: 0,
            indentText: "",
            hangingIndentLevel: undefined,
            expectNewLineNext: false,
            uncommitedItems: [],
            indentStates: [],
            hangingIndentStates: []
        };
    }

    onNewLine(action: () => void) {
        if (this.fireOnNewLine != null)
            throwError(`Cannot call ${nameof(this.onNewLine)} multiple times.`);
        this.fireOnNewLine = action;
    }

    getState(): Readonly<WriterState> {
        return Writer.cloneState(this.state);
    }

    setState(lineState: Readonly<WriterState>) {
        this.state = Writer.cloneState(lineState);
    }

    private static cloneState(lineState: Readonly<WriterState>): WriterState {
        const state: MakeRequired<WriterState> = {
            currentLineColumn: lineState.currentLineColumn,
            currentLineNumber: lineState.currentLineNumber,
            lastLineIndentLevel: lineState.lastLineIndentLevel,
            expectNewLineNext: lineState.expectNewLineNext,
            hangingIndentLevel: lineState.hangingIndentLevel,
            indentLevel: lineState.indentLevel,
            indentText: lineState.indentText,
            uncommitedItems: [...lineState.uncommitedItems],
            indentStates: [...lineState.indentStates],
            hangingIndentStates: [...lineState.hangingIndentStates]
        };
        return state;
    }

    private get currentLineColumn() {
        return this.state.currentLineColumn;
    }

    private set currentLineColumn(value: number) {
        this.state.currentLineColumn = value;
    }

    private get currentLineNumber() {
        return this.state.currentLineNumber;
    }

    private set currentLineNumber(value: number) {
        this.state.currentLineNumber = value;
    }

    private get lastLineIndentLevel() {
        return this.state.lastLineIndentLevel;
    }

    private set lastLineIndentLevel(value: number) {
        this.state.lastLineIndentLevel = value;
    }

    private get expectNewLineNext() {
        return this.state.expectNewLineNext;
    }

    private set expectNewLineNext(value: boolean) {
        this.state.expectNewLineNext = value;
    }

    private get hangingIndentLevel() {
        return this.state.hangingIndentLevel;
    }

    private set hangingIndentLevel(value: number | undefined) {
        this.state.hangingIndentLevel = value;
    }

    private get indentLevel() {
        return this.state.indentLevel;
    }

    private set indentLevel(level: number) {
        if (this.indentLevel === level)
            return;

        this.state.indentLevel = level;
        this.state.indentText = this.singleIndentationText.repeat(level);
    }

    private get indentText() {
        return this.state.indentText;
    }

    private get indentStates() {
        return this.state.indentStates;
    }

    private get hangingIndentStates() {
        return this.state.hangingIndentStates;
    }

    write(text: string) {
        this.validateText(text);
        const isNewLine = text === "\n" || text === "\r\n";

        if (isNewLine) {
            if (this.hangingIndentLevel != null) {
                this.indentLevel = this.hangingIndentLevel;
                this.hangingIndentLevel = undefined;
            }
        }

        this.baseWrite(text);
    }

    private validateText(text: string) {
        // todo: this check should only be done when running the tests... otherwise
        // it should be turned off for performance reasons
        if (text === "\n" || text === "\r\n")
            return;

        if (text.includes("\n"))
            throwError("Printer error: The parser should write")
    }

    baseWrite(text: string) {
        const isNewLine = text[0] === "\n" || text[0] === "\r" && text[1] === "\n";
        if (this.expectNewLineNext) {
            this.expectNewLineNext = false;
            if (!isNewLine) {
                this.baseWrite(this.options.newLineKind);
                this.baseWrite(text);
                return;
            }
        }

        if (this.currentLineColumn === 0 && !isNewLine && this.indentLevel > 0)
            text = this.indentText + text;

        for (let i = 0; i < text.length; i++) {
            if (text[i] === "\n") {
                this.currentLineColumn = 0;
                this.currentLineNumber++;
                this.lastLineIndentLevel = this.indentLevel;
                this.fireOnNewLine!(); // expect this to be set
            }
            else
                this.currentLineColumn++;
        }

        this.state.uncommitedItems.push(text);
    }

    startIndent() {
        this.indentStates.push({
            hangingIndentLevel: this.hangingIndentLevel,
            indentLevel: this.indentLevel
        });
        this.indentLevel++;
    }

    finishIndent(): void {
        const originalIndentState = this.indentStates.pop();
        if (originalIndentState == null)
            return throwError(`For some reason ${nameof(this.finishIndent)} was called without a corresponding ${nameof(this.startIndent)}.`);

        this.hangingIndentLevel = originalIndentState.hangingIndentLevel;
        this.indentLevel = originalIndentState.indentLevel;
    }

    startHangingIndent() {
        this.hangingIndentStates.push({
            hangingIndentLevel: this.hangingIndentLevel,
            indentLevel: this.indentLevel
        });
        this.hangingIndentLevel = this.indentLevel + 1;
    }

    finishHangingIndent(): void {
        const originalHangingIndentState = this.hangingIndentStates.pop();
        if (originalHangingIndentState == null)
            return throwError(`For some reason ${nameof(this.finishHangingIndent)} was called without a corresponding ${nameof(this.startHangingIndent)}.`);

        this.hangingIndentLevel = originalHangingIndentState.hangingIndentLevel;
        this.indentLevel = originalHangingIndentState.indentLevel;
    }

    markExpectNewLine() {
        this.expectNewLineNext = true;
    }

    getLineStartIndentLevel() {
        return this.lastLineIndentLevel;
    }

    getIndentationLevel() {
        return this.indentLevel;
    }

    /** Gets the zero-indexed line column. */
    getLineColumn() {
        if (this.currentLineColumn === 0)
            return this.indentText.length;
        return this.currentLineColumn;
    }

    /** Gets the zero-index line number. */
    getLineNumber() {
        return this.currentLineNumber;
    }

    commit() {
        this.comittedItems.push(...this.state.uncommitedItems);
        this.state.uncommitedItems.length = 0;
    }

    toString() {
        if (this.state.uncommitedItems.length > 0)
            throwError("Printer error: Ensure commit() is called before calling toString()");

        return this.comittedItems.join("");
    }
}
