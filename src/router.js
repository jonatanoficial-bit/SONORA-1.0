// Simple hashless router using History API
export class Router {
  constructor({ onRoute }) {
    this.onRoute = onRoute;
    window.addEventListener("popstate", () => this.handle(location.pathname));
    document.addEventListener("click", (e) => {
      const a = e.target.closest("[data-route]");
      if (!a) return;
      e.preventDefault();
      const path = a.getAttribute("data-route");
      this.go(path);
    });
  }

  start(defaultPath="/home") {
    const path = location.pathname === "/" ? defaultPath : location.pathname;
    this.handle(path);
  }

  go(path) {
    if (location.pathname === path) return;
    history.pushState({}, "", path);
    this.handle(path);
  }

  handle(path) {
    this.onRoute(path);
  }
}
