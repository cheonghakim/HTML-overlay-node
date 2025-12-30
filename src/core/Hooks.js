export function createHooks(names) {
  const map = Object.fromEntries(names.map((n) => [n, new Set()]));
  return {
    on(name, fn) {
      if (!map[name]) map[name] = new Set();
      map[name].add(fn);
      return () => map[name].delete(fn);
    },
    off(name, fn) {
      if (map[name]) {
        map[name].delete(fn);
      }
    },
    emit(name, ...args) {
      if (!map[name]) return;
      for (const fn of map[name]) fn(...args);
    },
  };
}
