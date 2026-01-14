import { randomUUID } from "../utils/utils.js";

// src/core/Node.js

/**
 * Node represents a single node in the graph
 */
export class Node {
  /**
   * Create a new Node
   * @param {Object} options - Node configuration
   * @param {string} [options.id] - Unique identifier (auto-generated if not provided)
   * @param {string} options.type - Node type identifier
   * @param {string} [options.title] - Display title (defaults to type)
   * @param {number} [options.x=0] - X position
   * @param {number} [options.y=0] - Y position
   * @param {number} [options.width=160] - Node width
   * @param {number} [options.height=60] - Node height
   */
  constructor({ id, type, title, x = 0, y = 0, width = 160, height = 60 }) {
    if (!type) {
      throw new Error("Node type is required");
    }
    this.id = id ?? randomUUID();
    this.type = type;
    this.title = title ?? type;
    this.pos = { x, y };
    this.size = { width, height };
    this.inputs = []; // {id,name,datatype,portType,dir}
    this.outputs = []; // {id,name,datatype,portType,dir}
    this.state = {}; // User state data

    // Tree Structure
    this.parent = null; // Parent Node (or null if root)
    this.children = new Set(); // Set<Node>
    this.computed = { x: 0, y: 0, w: 0, h: 0 }; // World Transform
  }

  /**
   * Add an input port to this node
   * @param {string} name - Port name
   * @param {string} [datatype="any"] - Data type for the port
   * @param {string} [portType="data"] - Port type: "exec" or "data"
   * @returns {Object} The created port
   */
  /**
   * Recalculate minimum size based on ports
   */
  _updateMinSize() {
    const HEADER_HEIGHT = 28;
    const PORT_SPACING = 24;
    const BOTTOM_PADDING = 10;

    // Calculate required height for inputs and outputs
    const inHeight = HEADER_HEIGHT + 10 + this.inputs.length * PORT_SPACING + BOTTOM_PADDING;
    const outHeight = HEADER_HEIGHT + 10 + this.outputs.length * PORT_SPACING + BOTTOM_PADDING;

    const minHeight = Math.max(inHeight, outHeight, 60); // Minimum 60px base

    if (this.size.height < minHeight) {
      this.size.height = minHeight;
    }
  }

  addInput(name, datatype = "any", portType = "data") {
    // ... existing validation ...
    if (typeof name !== "string" || (portType === "data" && !name)) {
      throw new Error("Input port name must be a string (non-empty for data ports)");
    }
    const port = { id: randomUUID(), name, datatype, portType, dir: "in" };
    this.inputs.push(port);
    this._updateMinSize();
    return port;
  }

  addOutput(name, datatype = "any", portType = "data") {
    // ... existing validation ...
    if (typeof name !== "string" || (portType === "data" && !name)) {
      throw new Error("Output port name must be a string (non-empty for data ports)");
    }
    const port = { id: randomUUID(), name, datatype, portType, dir: "out" };
    this.outputs.push(port);
    this._updateMinSize();
    return port;
  }
}
