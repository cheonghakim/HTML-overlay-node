import { randomUUID } from "../utils/utils.js";

// src/core/Edge.js

/**
 * Edge represents a connection between two node ports
 */
export class Edge {
  /**
   * Create a new Edge
   * @param {Object} options - Edge configuration
   * @param {string} [options.id] - Unique identifier (auto-generated if not provided)
   * @param {string} options.fromNode - Source node ID
   * @param {string} options.fromPort - Source port ID
   * @param {string} options.toNode - Target node ID
   * @param {string} options.toPort - Target port ID
   */
  constructor({ id, fromNode, fromPort, toNode, toPort }) {
    if (!fromNode || !fromPort || !toNode || !toPort) {
      throw new Error("Edge requires fromNode, fromPort, toNode, and toPort");
    }
    this.id = id ?? randomUUID();
    this.fromNode = fromNode;
    this.fromPort = fromPort;
    this.toNode = toNode;
    this.toPort = toPort;
  }
}
