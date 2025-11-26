// src/core/Registry.js

/**
 * Registry for managing node type definitions
 */
export class Registry {
  constructor() {
    this.types = new Map();
  }

  /**
   * Register a new node type
   * @param {string} type - Unique type identifier (e.g., "core/Note")
   * @param {Object} def - Node definition
   * @param {string} [def.title] - Display title
   * @param {Object} [def.size] - Default size {w, h}
   * @param {Array} [def.inputs] - Input port definitions
   * @param {Array} [def.outputs] - Output port definitions
   * @param {Function} [def.onCreate] - Called when node is created
   * @param {Function} [def.onExecute] - Called each execution cycle
   * @param {Function} [def.onDraw] - Custom drawing function
   * @param {Object} [def.html] - HTML overlay configuration
   * @throws {Error} If type is already registered or invalid
   */
  register(type, def) {
    if (!type || typeof type !== 'string') {
      throw new Error(`Invalid node type: type must be a non-empty string, got ${typeof type}`);
    }
    if (!def || typeof def !== 'object') {
      throw new Error(`Invalid definition for type "${type}": definition must be an object`);
    }
    if (this.types.has(type)) {
      throw new Error(`Node type "${type}" is already registered. Use unregister() first to replace it.`);
    }
    this.types.set(type, def);
  }

  /**
   * Unregister a node type
   * @param {string} type - Type identifier to unregister
   * @throws {Error} If type doesn't exist
   */
  unregister(type) {
    if (!this.types.has(type)) {
      throw new Error(`Cannot unregister type "${type}": type is not registered`);
    }
    this.types.delete(type);
  }

  /**
   * Remove all registered node types
   */
  removeAll() {
    this.types.clear();
  }

  /**
   * Get the definition for a registered node type
   * @param {string} type - Type identifier
   * @returns {Object} Node definition
   * @throws {Error} If type is not registered
   */
  createInstance(type) {
    const def = this.types.get(type);
    if (!def) {
      const available = Array.from(this.types.keys()).join(', ') || 'none';
      throw new Error(`Unknown node type: "${type}". Available types: ${available}`);
    }
    return def;
  }
}
