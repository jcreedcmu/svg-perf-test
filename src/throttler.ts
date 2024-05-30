// This is used to throttle rerenders arising from, e.g. point moves.
// I probably should move them to another layer for performance
// reasons anyhow.
export class Throttler {
  cb: () => void;
  lastTime: number = 0;
  id: any | null = null; // XXX should be timeout type or something?

  constructor(cb: () => void) {
    this.cb = cb;
  }

  maybe() {
    if (Date.now() - this.lastTime < 20) {
      if (this.id != null) {
        clearTimeout(this.id);
        this.id = null;
      }
      this.id = setTimeout(() => (this.cb)(), 40);
    }
    else {
      (this.cb)();
    }
  }

  reset() {
    this.lastTime = Date.now();
    if (this.id != null) {
      clearTimeout(this.id);
      this.id = null;
    }
  }
}
