// src/core/CommandStack.js
export class CommandStack {
  constructor({ maxHistory = 200 } = {}) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = maxHistory;
  }
  exec(cmd) {
    cmd.do();
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }
  undo() {
    const c = this.undoStack.pop();
    if (c) {
      c.undo();
      this.redoStack.push(c);
    }
  }
  redo() {
    const c = this.redoStack.pop();
    if (c) {
      c.do();
      this.undoStack.push(c);
    }
  }
}
