import { TILE_WIDTH, SPRITE_WIDTH, WORLD_WIDTH, WORLD_HEIGHT } from './constants';
import { perlin2 } from "./lib/Perlin";
import { Graph } from "./lib/AStar";
import { createCanvasContext } from './lib/Canvas';
export class Game {
  #entities = [];
  #grid = [];
  #map = [];
  #worldCanvas = null;
  #graph = null;

  /**
   * Main game class
   * @param {HTMLCanvasElement} canvas
   * @param {number} gridSize
   */
  constructor(canvas, gridSize = 100) {
    // Canvas
    const resize = () => {
      const width = parseInt(window.innerWidth, 10);
      const height = parseInt(window.innerHeight, 10);

      const { context } = createCanvasContext(width, height, canvas);
      this.renderer = context;

      canvas.style.width = width;
      canvas.style.height = height;
      canvas.style.cursor = 'crosshair';

      this.#prepareMap(width, height);      

      // Draw cached world
      const { canvas: worldCanvas, context: worldContext } = createCanvasContext(width, height);
      this.#worldCanvas = worldCanvas;
      this.#drawWorld(worldContext);
    }
    resize();
    canvas.addEventListener('click', this.handleClickEvent.bind(this));
    canvas.addEventListener('mousemove', this.caputureMousePos.bind(this));
    window.addEventListener('resize', resize);  
  }

  #prepareMap(width, height) {
    console.log('grid size', Math.ceil(width / SPRITE_WIDTH), Math.ceil(height / SPRITE_WIDTH));
    this.#grid = Array.from(Array(Math.floor(height / SPRITE_WIDTH)), () => new Array(Math.floor(width / SPRITE_WIDTH)).fill(1));
    this.#map = Array.from(Array(Math.ceil(height / TILE_WIDTH)), () => new Array(Math.ceil(width / TILE_WIDTH)).fill(0));

    const getPerlinValue = (x, y) => (perlin2(x / 40, y / 40) * 100) + 10;  

    for(let y=0; y<this.#map.length; y++) {
      for (let x=0; x<this.#map[y].length; x++) {
        const perlinValue = getPerlinValue(x, y);
        this.#map[y][x] = perlinValue;
        const gradY = Math.floor(y/SPRITE_WIDTH);
        const gradX = Math.floor(x/SPRITE_WIDTH);
        if (perlinValue < -40) {
          this.#grid[gradY][gradX] = 0;
        }
        if (perlinValue > 40) {
          this.#grid[gradY][gradX] = perlinValue;
        }
      }
    }
  }

  get grid() {
    return this.#grid;
  }

  addObstacle(x, y) {
    this.#grid[y][x] = 0;
  }

  caputureMousePos(e) {
    const [x, y] = [Math.floor(e.pageX / SPRITE_WIDTH), Math.floor(e.pageY / SPRITE_WIDTH)];
    this.mouseX = x;
    this.mouseY = y;
  }

  /**
   * Handle user click
   * @param {MouseEvent} e 
   */
  handleClickEvent(e) {
    const [x, y] = [Math.floor(e.pageX / SPRITE_WIDTH), Math.floor(e.pageY / SPRITE_WIDTH)];
    const targets = this.#findTargetRegion(x, y, this.#entities.length, this.#grid);
    this.#graph = new Graph(this.#grid, { diagonal: false });
    for (const entity of this.#entities) {
      const pos = targets.shift();
      entity.move(this.#graph, pos[0], pos[1]);
    }
  }

  #drawCursor(x, y) {
    this.renderer.beginPath();
    this.renderer.ellipse(x * SPRITE_WIDTH + SPRITE_WIDTH / 2, y * SPRITE_WIDTH + SPRITE_WIDTH / 2, SPRITE_WIDTH / 2, SPRITE_WIDTH / 2, 0, 0, 2 * Math.PI);
    this.renderer.fillStyle = 'rgba(255, 255, 255, .5)';
    this.renderer.fill();
    this.renderer.strokeStyle = 'rgba(0, 0, 0, .5)';
    this.renderer.stroke();
    this.renderer.closePath();
  }

  /**
   * Main loop
   * @param {number} timestamp 
   */
  loop(timestamp) {
    this.renderer.clearRect(0, 0, this.renderer.canvas.clientWidth, this.renderer.canvas.clientHeight);
    this.renderer.drawImage(this.#worldCanvas, 0, 0, this.renderer.canvas.clientWidth, this.renderer.canvas.clientHeight);
    // this.#drawCollisions(this.renderer);
    for(const entity of this.#entities) {
      if (entity.step) entity.step(timestamp);
      if (entity.draw) entity.draw(this.renderer);
    }
    this.#drawCursor(this.mouseX, this.mouseY);
    window.requestAnimationFrame(this.loop.bind(this));
  }

  add(entity) {
    this.#entities.push(entity);
  }

  /**
   * Draw world noise
   * @param {CanvasRenderingContext2D} ctx 
   */
  #drawWorld(ctx) {
    const gridHeight = this.#map.length;
    const gridWidth = this.#map[0].length;
    const color = (value) => {
      if (value <= -60) return '#0b1660';
      if (value > -60 && value <= -50) return '#16247f';
      if (value > -50 && value <= -40) return '#2e40b2';
      if (value > -40 && value <= -25) return '#0b753e';
      if (value >- 25 && value <= 0) return '#15913c';
      if (value > 0 && value <= 30) return '#7b9b36';
      if (value > 30 && value <= 50) return '#9ca092';
      if (value > 50 && value <= 60) return '#c0c9ad';
      if (value > 60 && value <= 70) return '#FFFFFF';
      return '#FFFFFF';
    }
    for (let y=0; y<gridHeight; y++) {
      for (let x=0; x<gridWidth; x++) {
        ctx.fillStyle = color(this.#map[y][x]);
        ctx.fillRect(x*TILE_WIDTH, y*TILE_WIDTH, TILE_WIDTH, TILE_WIDTH);
      }
    }
  }

  /**
   * Draw game walls
   * @param {CanvasRenderingContext2D} ctx 
   */
  #drawCollisions(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    const gridLen = this.#grid.length;
    for (let y=0; y<gridLen; y++) {
      for (let x=0; x<gridLen; x++) {
        if (this.#grid[y][x] === 0) {
          ctx.fillRect(x*SPRITE_WIDTH, y*SPRITE_WIDTH, SPRITE_WIDTH, SPRITE_WIDTH);
        }
      }
    }
  }

  #findTargetRegion(x, y, entitiesLength, grid) {
    const spiralDirections = [
      [0, 1],  // right
      [1, 0],  // down
      [0, -1], // left
      [-1, 0]  // up
    ];
  
    let currentRow = y;
    let currentCol = x;
    let directionIndex = 0;
    let stepsCount = 1;
    let stepsTaken = 0;
    
    const selectedNodes = [];
  
    while (selectedNodes.length < entitiesLength) {
      if (currentRow >= 0 && currentCol >= 0 && currentRow < grid.length && currentCol < grid[0].length && grid[currentRow][currentCol] > 0) {
        selectedNodes.push([currentCol, currentRow]);
      }
  
      currentRow += spiralDirections[directionIndex][0];
      currentCol += spiralDirections[directionIndex][1];
      stepsTaken++;
  
      if (stepsTaken === stepsCount) {
        stepsTaken = 0;
        directionIndex = (directionIndex + 1) % 4;
        if (directionIndex % 2 === 0) {
          stepsCount++;
        }
      }
    }
  
    return selectedNodes;    
  }
}