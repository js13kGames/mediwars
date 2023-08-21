import { TILE_WIDTH } from "./constants";
import { astar, Graph } from "./lib/AStar";

export class Unit {
  #path = [];

  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  /**
   * 
   * @param {EventTarget} emitter 
   */
  setup(grid, emitter) {
    emitter.addEventListener('world:click', e => {
      const graph = new Graph(grid, { diagonal: false });
      this.#path = astar.search(graph, graph.getNode(this.x, this.y), graph.getNode(e.detail.x, e.detail.y));
    });
  }

  step() {
    if (this.#path.length) {
      this.x = this.#path[0].x;
      this.y = this.#path[0].y;
      this.#path.shift();
    }
  }

  /**
   * Draw on game world
   * @param {CanvasRenderingContext2D} ctx 
   */
  draw(ctx) {
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(this.x * TILE_WIDTH, this.y * TILE_WIDTH, TILE_WIDTH, TILE_WIDTH);
  }
}