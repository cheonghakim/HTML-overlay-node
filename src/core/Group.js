import { randomUUID } from "../utils/utils";

export class Group {
  constructor({
    id,
    title = "",
    x = 0,
    y = 0,
    width = 120,
    height = 80,
    color = "#888",
    state = {},
  } = {}) {
    // ← 인수 미전달 방지
    this.id = id ?? randomUUID();
    this.title = title;
    this.pos = { x, y };
    this.size = { width, height };
    this.color = color;
    this.state = state;
  }

  // status
  getStatus() {
    return this.state;
  }
  setStatus(state = {}) {
    this.state = state;
  }

  // position
  getPosition() {
    return this.pos;
  }
  setPosition(a, b) {
    // 객체/튜플/숫자 2개 모두 허용하면서 '교체'가 아니라 '변경'만
    if (typeof a === "object" && a !== null) {
      const { x, y } = a;
      if (Number.isFinite(x)) this.pos.x = x;
      if (Number.isFinite(y)) this.pos.y = y;
    } else {
      if (Number.isFinite(a)) this.pos.x = a;
      if (Number.isFinite(b)) this.pos.y = b;
    }
  }

  // size
  getSize() {
    return this.size;
  }
  setSize(a, b) {
    if (typeof a === "object" && a !== null) {
      const { width, height } = a;
      if (Number.isFinite(width)) this.size.width = width;
      if (Number.isFinite(height)) this.size.height = height;
    } else {
      if (Number.isFinite(a)) this.size.width = a;
      if (Number.isFinite(b)) this.size.height = b;
    }
  }

  // color
  getColor() {
    return this.color;
  }
  setColor(color) {
    this.color = color;
  }

  // title
  getTitle() {
    return this.title;
  }
  setTitle(title) {
    this.title = title;
  }
}
