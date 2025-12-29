/**
 * Minimap - Shows overview of entire graph with viewport indicator
 */
export class Minimap {
    constructor(container, { graph, renderer, width = 200, height = 150 } = {}) {
        this.graph = graph;
        this.renderer = renderer;
        this.width = width;
        this.height = height;

        // Create canvas element
        this.canvas = document.createElement("canvas");
        this.canvas.id = "minimap";
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.position = "fixed";
        this.canvas.style.bottom = "20px";
        this.canvas.style.right = "20px";
        this.canvas.style.border = "2px solid #444";
        this.canvas.style.borderRadius = "8px";
        this.canvas.style.background = "rgba(20, 20, 23, 0.9)";
        this.canvas.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.5)";
        this.canvas.style.pointerEvents = "none"; // Don't block clicks

        this.ctx = this.canvas.getContext("2d");

        // Add to container
        container.appendChild(this.canvas);
    }

    /**
     * Render the minimap
     */
    render() {
        const { graph, renderer, ctx, width: w, height: h } = this;

        // Clear
        ctx.fillStyle = "#141417";
        ctx.fillRect(0, 0, w, h);

        if (graph.nodes.size === 0) return;

        // Calculate bounds of all nodes
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        for (const node of graph.nodes.values()) {
            const { x, y, w: nw, h: nh } = node.computed;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + nw);
            maxY = Math.max(maxY, y + nh);
        }

        // Add margin to the bounds
        const margin = 100; // World units margin
        const graphWidth = Math.max(300, maxX - minX + margin * 2);
        const graphHeight = Math.max(200, maxY - minY + margin * 2);

        // Adjust minX and minY to center the content
        minX -= margin;
        minY -= margin;

        const padding = 10;

        const scale = Math.min(
            (w - padding * 2) / graphWidth,
            (h - padding * 2) / graphHeight
        );

        const offsetX = (w - graphWidth * scale) / 2;
        const offsetY = (h - graphHeight * scale) / 2;

        // Draw edges first (so they appear behind nodes)
        ctx.strokeStyle = "rgba(127, 140, 255, 0.5)"; // Semi-transparent edge color
        ctx.lineWidth = 1;
        for (const edge of graph.edges.values()) {
            const fromNode = graph.nodes.get(edge.fromNode);
            const toNode = graph.nodes.get(edge.toNode);
            if (!fromNode || !toNode) continue;

            // Get center points of nodes
            const x1 = fromNode.computed.x + fromNode.computed.w / 2;
            const y1 = fromNode.computed.y + fromNode.computed.h / 2;
            const x2 = toNode.computed.x + toNode.computed.w / 2;
            const y2 = toNode.computed.y + toNode.computed.h / 2;

            // Transform to minimap coordinates
            const mx1 = (x1 - minX) * scale + offsetX;
            const my1 = (y1 - minY) * scale + offsetY;
            const mx2 = (x2 - minX) * scale + offsetX;
            const my2 = (y2 - minY) * scale + offsetY;

            ctx.beginPath();
            ctx.moveTo(mx1, my1);
            ctx.lineTo(mx2, my2);
            ctx.stroke();
        }

        // Draw nodes
        ctx.fillStyle = "#6cf";
        for (const node of graph.nodes.values()) {
            const { x, y, w: nw, h: nh } = node.computed;
            const mx = (x - minX) * scale + offsetX;
            const my = (y - minY) * scale + offsetY;
            const mw = nw * scale;
            const mh = nh * scale;

            if (node.type === "core/Group") {
                ctx.fillStyle = "rgba(102, 204, 255, 0.2)";
                ctx.strokeStyle = "#6cf";
                ctx.lineWidth = 1;
                ctx.fillRect(mx, my, mw, mh);
                ctx.strokeRect(mx, my, mw, mh);
            } else {
                ctx.fillStyle = "#6cf";
                ctx.fillRect(mx, my, Math.max(2, mw), Math.max(2, mh));
            }
        }

        // Draw viewport rectangle
        const vx0 = -renderer.offsetX / renderer.scale;
        const vy0 = -renderer.offsetY / renderer.scale;
        const vw = renderer.canvas.width / renderer.scale;
        const vh = renderer.canvas.height / renderer.scale;

        const vmx = (vx0 - minX) * scale + offsetX;
        const vmy = (vy0 - minY) * scale + offsetY;
        const vmw = vw * scale;
        const vmh = vh * scale;

        ctx.strokeStyle = "#ff6b6b";
        ctx.lineWidth = 2;
        ctx.strokeRect(vmx, vmy, vmw, vmh);
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.canvas.parentElement) {
            this.canvas.parentElement.removeChild(this.canvas);
        }
    }
}
